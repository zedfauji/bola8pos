//! ESC/POS thermal receipt printing (58mm / 32 columns).
//! Line content (all labels, locale-translated) is built in TypeScript —
//! `bar-pos/src/shared/lib/receipt-format.ts` via `receiptDataToPrinterLines()`.
//! This module only ESC/POS-encodes the pre-formatted lines it receives; it
//! holds zero receipt-label strings.

use std::fs;
use std::io::Write;
use std::time::{SystemTime, UNIX_EPOCH};

const ESC: u8 = 0x1B;
const GS: u8 = 0x1D;

/// Drawer kick: ESC p 0 0x19 0xFA
const DRAWER_PULSE: [u8; 5] = [ESC, 0x70, 0x00, 0x19, 0xFA];

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
pub fn print_receipt(lines: Vec<String>) -> Result<(), String> {
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
