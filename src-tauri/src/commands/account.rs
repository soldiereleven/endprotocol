use std::sync::Arc;
use tauri::State;
use tokio::sync::Mutex;

use crate::models::account::{AccountInfo, AccountLoginResult, AccountRefreshResult};
use crate::models::login::{CodeLoginRequest, LoginRequest, SendCodeRequest};
use crate::services::account_service::AccountService;

/// 获取所有账户
#[tauri::command]
pub async fn get_accounts(
    state: State<'_, Arc<Mutex<AccountService>>>,
) -> Result<Vec<AccountInfo>, String> {
    let service = state.lock().await;
    Ok(service.get_accounts().await)
}

/// 添加账户（登录）
#[tauri::command]
pub async fn add_account(
    state: State<'_, Arc<Mutex<AccountService>>>,
    login_request: LoginRequest,
) -> Result<AccountLoginResult, String> {
    let service = state.lock().await;
    service
        .add_account(login_request)
        .await
        .map_err(|e| e.to_string())
}

/// 登出单个账户
#[tauri::command]
pub async fn logout_account(
    state: State<'_, Arc<Mutex<AccountService>>>,
    account_id: String,
) -> Result<bool, String> {
    let service = state.lock().await;
    Ok(service.logout_account(account_id).await)
}

/// 批量登出账户
#[tauri::command]
pub async fn batch_logout(
    state: State<'_, Arc<Mutex<AccountService>>>,
    account_ids: Vec<String>,
) -> Result<bool, String> {
    let service = state.lock().await;
    Ok(service.batch_logout(account_ids).await)
}

/// 刷新账户数据
#[tauri::command]
pub async fn refresh_accounts(
    state: State<'_, Arc<Mutex<AccountService>>>,
) -> Result<AccountRefreshResult, String> {
    let service = state.lock().await;
    Ok(service.refresh_accounts().await)
}

/// 发送验证码
#[tauri::command]
pub async fn send_verification_code(
    state: State<'_, Arc<Mutex<AccountService>>>,
    request: SendCodeRequest,
) -> Result<bool, String> {
    let service = state.lock().await;
    service
        .send_verification_code(request)
        .await
        .map_err(|e| e.to_string())
}

/// 通过验证码添加账户
#[tauri::command]
pub async fn add_account_by_code(
    state: State<'_, Arc<Mutex<AccountService>>>,
    login_request: CodeLoginRequest,
) -> Result<AccountLoginResult, String> {
    let service = state.lock().await;
    service
        .add_account_by_code(login_request)
        .await
        .map_err(|e| e.to_string())
}
