use std::sync::{Arc, Mutex};
use tauri::State;

use crate::models::account::{AccountInfo, AccountLoginResult, AccountRefreshResult};
use crate::models::login::LoginRequest;
use crate::services::account_service::AccountService;

/// 获取所有账户
#[tauri::command]
pub async fn get_accounts(
    state: State<'_, Arc<Mutex<AccountService>>>,
) -> Vec<AccountInfo> {
    let service = state.lock().unwrap();
    service.get_accounts().await
}

/// 添加账户（登录）
#[tauri::command]
pub async fn add_account(
    state: State<'_, Arc<Mutex<AccountService>>>,
    login_request: LoginRequest,
) -> Result<AccountLoginResult, String> {
    let service = state.lock().map_err(|e| e.to_string())?;
    service.add_account(login_request).await.map_err(|e| e.to_string())
}

/// 登出单个账户
#[tauri::command]
pub async fn logout_account(
    state: State<'_, Arc<Mutex<AccountService>>>,
    account_id: String,
) -> bool {
    let service = state.lock().unwrap();
    service.logout_account(account_id).await
}

/// 批量登出账户
#[tauri::command]
pub async fn batch_logout(
    state: State<'_, Arc<Mutex<AccountService>>>,
    account_ids: Vec<String>,
) -> bool {
    let service = state.lock().unwrap();
    service.batch_logout(account_ids).await
}

/// 刷新账户数据
#[tauri::command]
pub async fn refresh_accounts(
    state: State<'_, Arc<Mutex<AccountService>>>,
) -> AccountRefreshResult {
    let service = state.lock().unwrap();
    service.refresh_accounts().await
}
