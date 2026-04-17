mod commands;

use commands::printer::{open_cash_drawer, print_receipt, test_print};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![print_receipt, open_cash_drawer, test_print])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
