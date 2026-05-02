use std::sync::{Arc, Mutex};

mod commands;
mod models;
mod services;
mod utils;

use services::config_service::ConfigService;
use services::account_service::AccountService;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            // Config commands
            commands::config::get_config,
            commands::config::set_config,
            commands::config::remove_config,
            commands::config::get_all_configs,
            // Account commands
            commands::account::get_accounts,
            commands::account::add_account,
            commands::account::logout_account,
            commands::account::batch_logout,
            commands::account::refresh_accounts,
        ])
        .setup(|app| {
            // 初始化配置服务并存储到 state
            let config_service = Arc::new(Mutex::new(ConfigService::new().map_err(|e| e.to_string())?));
            app.manage(config_service.clone());

            // 初始化账户服务
            let account_service = AccountService::new(config_service);
            app.manage(Arc::new(Mutex::new(account_service)));

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
