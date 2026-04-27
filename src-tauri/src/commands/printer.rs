//! ESC/POS thermal receipt printing (58mm / 32 columns).
//! Layout mirrors `bar-pos/src/shared/lib/receipt-format.ts` — keep both in sync.

use serde::Deserialize;
use std::fs;
use std::io::Write;
use std::time::{SystemTime, UNIX_EPOCH};

const LINE_WIDTH: usize = 32;

const ESC: u8 = 0x1B;
const GS: u8 = 0x1D;

/// Drawer kick: ESC p 0 0x19 0xFA
const DRAWER_PULSE: [u8; 5] = [ESC, 0x70, 0x00, 0x19, 0xFA];

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ReceiptItemDto {
    name: String,
    quantity: i64,
    line_total: f64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ReceiptPrintDto {
    bar_name: String,
    bar_address: String,
    receipt_number: String,
    customer_name: String,
    cashier_name: String,
    processed_at: String,
    items: Vec<ReceiptItemDto>,
    subtotal: f64,
    tip_amount: f64,
    total: f64,
    payment_method: String,
    tendered_amount: Option<f64>,
    change_amount: Option<f64>,
    terminal_reference: Option<String>,
    footer_text: Option<String>,
}

fn format_money(amount: f64) -> String {
    let is_negative = amount < 0.0;
    let abs_amount = amount.abs();
    let formatted = format!("{abs_amount:.2}");
    if is_negative {
        format!("-${formatted}")
    } else {
        format!("${formatted}")
    }
}

fn pad_right(s: &str, width: usize) -> String {
    let t = if s.chars().count() > width {
        s.chars().take(width).collect::<String>()
    } else {
        s.to_string()
    };
    let pad = width.saturating_sub(t.chars().count());
    format!("{t}{}", " ".repeat(pad))
}

fn line_left_right(left: &str, right: &str) -> String {
    let r: String = if right.chars().count() >= LINE_WIDTH {
        right
            .chars()
            .rev()
            .take(LINE_WIDTH)
            .collect::<String>()
            .chars()
            .rev()
            .collect()
    } else {
        right.to_string()
    };
    let max_left = LINE_WIDTH.saturating_sub(r.chars().count());
    let l = if left.chars().count() > max_left {
        let take = max_left.saturating_sub(1);
        let prefix: String = left.chars().take(take.max(1)).collect();
        format!("{prefix}~")
    } else {
        left.to_string()
    };
    let padded = pad_right(&l, LINE_WIDTH.saturating_sub(r.chars().count()));
    format!("{padded}{r}")
}

fn center_line(text: &str) -> String {
    let count = text.chars().count();
    if count >= LINE_WIDTH {
        return text.chars().take(LINE_WIDTH).collect();
    }
    let pad = (LINE_WIDTH - count) / 2;
    let right_pad = LINE_WIDTH - pad - count;
    format!("{}{}{}", " ".repeat(pad), text, " ".repeat(right_pad))
}

fn divider() -> String {
    "-".repeat(LINE_WIDTH)
}

fn payment_method_label(method: &str) -> &'static str {
    match method {
        "cash" => "Cash",
        "card" => "Card (BBVA Terminal)",
        "rappi" => "Rappi",
        _ => "Payment",
    }
}

/// Plain-text lines (32 cols) — same logic as TS `buildThermalReceiptText`.
fn build_receipt_lines(r: &ReceiptPrintDto) -> Vec<String> {
    let mut lines: Vec<String> = Vec::new();
    let bar = if r.bar_name.trim().is_empty() {
        "Bar".to_string()
    } else {
        r.bar_name.clone()
    };
    lines.push(center_line(&bar));
    if !r.bar_address.trim().is_empty() {
        let addr = r.bar_address.trim();
        let mut i = 0;
        let char_count = addr.chars().count();
        while i < char_count {
            let chunk: String = addr.chars().skip(i).take(LINE_WIDTH).collect();
            lines.push(pad_right(&chunk, LINE_WIDTH));
            i += LINE_WIDTH;
        }
    }
    lines.push(divider());
    lines.push(line_left_right("Date", &r.processed_at));
    lines.push(line_left_right("Cashier", &r.cashier_name));
    lines.push(line_left_right("Customer", &r.customer_name));
    lines.push(divider());
    for item in &r.items {
        let left = format!("{}× {}", item.quantity, item.name);
        let price = format_money(item.line_total);
        lines.push(line_left_right(&left, &price));
    }
    lines.push(divider());
    lines.push(line_left_right("Subtotal", &format_money(r.subtotal)));
    lines.push(line_left_right("Tip", &format_money(r.tip_amount)));
    lines.push(line_left_right("Total", &format_money(r.total)));
    lines.push(line_left_right(
        "Payment",
        payment_method_label(&r.payment_method),
    ));
    if r.payment_method == "cash" {
        if let Some(t) = r.tendered_amount {
            lines.push(line_left_right("Tendered", &format_money(t)));
            let ch = r.change_amount.unwrap_or(0.0);
            lines.push(line_left_right("Change", &format_money(ch)));
        }
    }
    if let Some(ref tr) = r.terminal_reference {
        if !tr.is_empty() {
            lines.push(line_left_right("Ref", tr));
        }
    }
    lines.push(divider());
    lines.push(center_line(&format!("#{}", r.receipt_number)));
    if let Some(ref ft) = r.footer_text {
        if !ft.trim().is_empty() {
            for ln in ft.lines() {
                let mut i = 0;
                let n = ln.chars().count();
                while i < n {
                    lines.push(ln.chars().skip(i).take(LINE_WIDTH).collect());
                    i += LINE_WIDTH;
                }
            }
        }
    }
    lines.push(String::new());
    lines
}

fn lines_to_esc_pos(lines: &[String]) -> Vec<u8> {
    let mut out = Vec::new();
    out.extend_from_slice(&[ESC, b'@']);
    if let Some(first) = lines.first() {
        out.extend_from_slice(&[ESC, b'a', 1]);
        out.extend_from_slice(&[ESC, b'E', 1]);
        out.extend_from_slice(first.as_bytes());
        out.push(b'\n');
    }
    out.extend_from_slice(&[ESC, b'a', 0]);
    out.extend_from_slice(&[ESC, b'E', 0]);
    for line in lines.iter().skip(1) {
        out.extend_from_slice(line.as_bytes());
        out.push(b'\n');
    }
    out.extend_from_slice(&[GS, b'V', 0x42, 0x03]);
    out
}

fn write_fallback_bytes(bytes: &[u8]) -> Result<(), String> {
    let ts = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_millis();
    let path = std::env::temp_dir().join(format!("receipt_{ts}.prn"));
    let mut f = fs::File::create(&path).map_err(|e| e.to_string())?;
    f.write_all(bytes).map_err(|e| e.to_string())?;
    eprintln!(
        "[printer] WARNING: no printer or print failed; wrote ESC/POS bytes to {}",
        path.display()
    );
    Ok(())
}

#[cfg(target_os = "windows")]
mod win_print {
    use windows::core::{HSTRING, PWSTR};
    use windows::Win32::Graphics::Printing::{
        ClosePrinter, DOC_INFO_1W, EndDocPrinter, GetDefaultPrinterW, OpenPrinterW, PRINTER_HANDLE,
        StartDocPrinterW, WritePrinter,
    };

    pub fn default_printer_name() -> Result<HSTRING, String> {
        let mut buf = vec![0u16; 512];
        let mut size = buf.len() as u32;
        let ok = unsafe { GetDefaultPrinterW(Some(PWSTR(buf.as_mut_ptr())), &mut size) };
        if ok.0 == 0 {
            return Err("No default Windows printer is configured.".to_string());
        }
        let end = buf.iter().position(|&c| c == 0).unwrap_or(buf.len());
        let s = String::from_utf16_lossy(&buf[..end]);
        if s.trim().is_empty() {
            return Err("Default printer name is empty.".to_string());
        }
        Ok(HSTRING::from(s))
    }

    pub fn send_raw(bytes: &[u8]) -> Result<(), String> {
        let name = default_printer_name()?;
        let mut handle = PRINTER_HANDLE::default();
        unsafe {
            OpenPrinterW(&name, &mut handle, None)
                .map_err(|e| format!("OpenPrinter failed: {}", e.message()))?;
        }
        let mut doc_name: Vec<u16> = "Receipt\0".encode_utf16().collect();
        let mut datatype: Vec<u16> = "RAW\0".encode_utf16().collect();
        let doc_info = DOC_INFO_1W {
            pDocName: PWSTR(doc_name.as_mut_ptr()),
            pOutputFile: PWSTR::null(),
            pDatatype: PWSTR(datatype.as_mut_ptr()),
        };
        let job = unsafe { StartDocPrinterW(handle, 1, &doc_info) };
        if job == 0 {
            let _ = unsafe { ClosePrinter(handle) };
            return Err("StartDocPrinter failed (returned job id 0).".to_string());
        }
        let mut written: u32 = 0;
        let ok = unsafe {
            WritePrinter(
                handle,
                bytes.as_ptr().cast(),
                bytes.len() as u32,
                std::ptr::addr_of_mut!(written),
            )
        };
        unsafe {
            let _ = EndDocPrinter(handle);
            let _ = ClosePrinter(handle);
        }
        if ok.0 == 0 || written != bytes.len() as u32 {
            return Err("WritePrinter failed or incomplete write.".to_string());
        }
        Ok(())
    }
}

#[cfg(target_os = "windows")]
fn try_send_raw(bytes: &[u8]) -> Result<(), String> {
    win_print::send_raw(bytes)
}

#[cfg(not(target_os = "windows"))]
fn try_send_raw(_bytes: &[u8]) -> Result<(), String> {
    Err("Thermal printer is only supported on Windows.".to_string())
}

#[tauri::command(rename_all = "camelCase")]
pub fn print_receipt(receipt_json: String) -> Result<(), String> {
    let dto: ReceiptPrintDto =
        serde_json::from_str(&receipt_json).map_err(|e| format!("Invalid receipt JSON: {e}"))?;
    let lines = build_receipt_lines(&dto);
    let bytes = lines_to_esc_pos(&lines);

    #[cfg(target_os = "windows")]
    {
        match try_send_raw(&bytes) {
            Ok(()) => Ok(()),
            Err(e) => {
                eprintln!("[printer] WARNING: {e}");
                write_fallback_bytes(&bytes)
            }
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        eprintln!("[printer] WARNING: non-Windows host; writing receipt bytes to temp file");
        write_fallback_bytes(&bytes)
    }
}

#[tauri::command]
pub fn open_cash_drawer() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        try_send_raw(&DRAWER_PULSE)
    }
    #[cfg(not(target_os = "windows"))]
    {
        Err("Thermal printer is only supported on Windows.".to_string())
    }
}

#[tauri::command]
pub fn test_print() -> Result<(), String> {
    let lines = vec![
        "Bar POS".to_string(),
        "TEST PRINT".to_string(),
        String::new(),
    ];
    let bytes = lines_to_esc_pos(&lines);
    #[cfg(target_os = "windows")]
    {
        try_send_raw(&bytes)
    }
    #[cfg(not(target_os = "windows"))]
    {
        Err("Thermal printer is only supported on Windows.".to_string())
    }
}
