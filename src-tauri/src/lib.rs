use std::sync::Arc;
use tauri::Manager;
use tokio::sync::Mutex;

mod commands;
mod models;
mod services;
mod utils;

use services::account_service::AccountService;
use services::avatar_cache_service::AvatarCacheService;
use services::config_service::ConfigService;
use services::network_service::NetworkService;
use services::skland_service::SklandService;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // 初始化日志系统
    if let Err(e) = utils::logger::init_logger() {
        eprintln!("Failed to initialize logger: {}", e);
    }

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
            commands::account::save_selected_roles,
            commands::account::get_selected_account,
            commands::account::set_selected_account,
            commands::account::check_and_refresh_cred,
            // Card config commands
            commands::card_config::get_card_settings,
            commands::card_config::save_card_settings,
            commands::card_config::remove_card_settings,
            commands::account::query_role_data,
            commands::account::set_lazy_load_enabled,
            commands::account::is_lazy_load_enabled,
            commands::account::set_current_role_id,
            // Image commands
            commands::image::read_image_file,
            // Window commands
            commands::window::minimize_window,
            commands::window::toggle_maximize_window,
            commands::window::close_window,
            // Logger commands
            commands::logs::get_backend_logs,
        ])
        .setup(|app| {
            // 初始化配置服务（使用 std::sync::Mutex，因为它是同步的）
            let config_service = Arc::new(std::sync::Mutex::new(
                ConfigService::new().map_err(|e| e.to_string())?,
            ));
            app.manage(config_service.clone());

            // 初始化 Skland 服务
            let skland_service = Arc::new(SklandService::new(config_service.clone()));

            // 初始化头像缓存服务
            let avatar_cache_service =
                Arc::new(AvatarCacheService::new().map_err(|e| e.to_string())?);

            // 初始化网络数据服务
            let network_service =
                Arc::new(NetworkService::new(skland_service.clone(), avatar_cache_service.clone()));

            // 初始化账户服务（使用 tokio::sync::Mutex，因为它包含异步方法）
            let account_service = AccountService::new(
                config_service.clone(),
                skland_service,
                avatar_cache_service,
                network_service,
            );
            app.manage(Arc::new(Mutex::new(account_service)));

            // 启动自动刷新定时器（此时 tokio runtime 已启动）
            AccountService::start_auto_refresh(config_service);

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
