use std::sync::Arc;
use tauri::Manager;
use tokio::sync::Mutex;

mod commands;
mod models;
mod services;
mod utils;

use services::account_service::AccountService;
use services::config_service::ConfigService;

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
            commands::account::send_verification_code,
            commands::account::add_account_by_code,
        ])
        .setup(|app| {
            // 初始化配置服务（使用 std::sync::Mutex，因为它是同步的）
            let config_service = Arc::new(std::sync::Mutex::new(
                ConfigService::new().map_err(|e| e.to_string())?,
            ));
            app.manage(config_service.clone());

            // 初始化账户服务（使用 tokio::sync::Mutex，因为它包含异步方法）
            let account_service = AccountService::new(config_service.clone());
            app.manage(Arc::new(Mutex::new(account_service)));

            // 启动自动刷新定时器（此时 tokio runtime 已启动）
            AccountService::start_auto_refresh(config_service);

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
