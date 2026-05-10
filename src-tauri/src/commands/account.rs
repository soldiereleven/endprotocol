use std::sync::Arc;
use tauri::State;
use tokio::sync::Mutex;

use crate::models::account::{AccountInfo, AccountLoginResult, AccountRefreshResult};
use crate::models::login::{CodeLoginRequest, LoginRequest, SendCodeRequest};
use crate::models::role::RoleDisplayInfo;
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

/// 保存用户选择的角色
#[tauri::command]
pub async fn save_selected_roles(
    state: State<'_, Arc<Mutex<AccountService>>>,
    cred: String,
    token: String,
    user_id: String,
    selected_roles: Vec<RoleDisplayInfo>,
) -> Result<Vec<AccountInfo>, String> {
    let service = state.lock().await;
    service
        .save_selected_roles(cred, token, user_id, selected_roles)
        .await
        .map_err(|e| e.to_string())
}

/// 获取当前选中的账户 ID
#[tauri::command]
pub async fn get_selected_account(
    state: State<'_, Arc<Mutex<AccountService>>>,
) -> Result<Option<String>, String> {
    let service = state.lock().await;
    let config = service.get_config_service();
    let config_guard = config.lock().unwrap();
    Ok(config_guard.get("selected_account_id"))
}

/// 设置当前选中的账户 ID
#[tauri::command]
pub async fn set_selected_account(
    state: State<'_, Arc<Mutex<AccountService>>>,
    account_id: String,
) -> Result<bool, String> {
    let service = state.lock().await;
    let config = service.get_config_service();
    let mut config_guard = config.lock().unwrap();
    config_guard
        .set(
            "selected_account_id".to_string(),
            serde_json::json!(account_id),
        )
        .map_err(|e| e.to_string())?;
    Ok(true)
}

/// 检查并刷新指定用户的 cred
#[tauri::command]
pub async fn check_and_refresh_cred(
    state: State<'_, Arc<Mutex<AccountService>>>,
    user_id: String,
) -> Result<Option<(String, String)>, String> {
    let service = state.lock().await;
    service
        .check_and_refresh_user_cred(&user_id)
        .await
        .map_err(|e| e.to_string())
}

/// 保存选中的干员 ID
#[tauri::command]
pub async fn save_selected_char_ids(
    state: State<'_, Arc<Mutex<AccountService>>>,
    role_id: String,
    selected_ids: Vec<String>,
) -> Result<bool, String> {
    let service = state.lock().await;
    let config = service.get_config_service();
    let mut config_guard = config.lock().unwrap();

    let config_key = format!("selected_char_ids_{}", role_id);
    config_guard
        .set(config_key, serde_json::json!(selected_ids))
        .map_err(|e| e.to_string())?;

    Ok(true)
}

/// 获取选中的干员 ID
#[tauri::command]
pub async fn get_selected_char_ids(
    state: State<'_, Arc<Mutex<AccountService>>>,
    role_id: String,
) -> Result<Vec<String>, String> {
    let service = state.lock().await;
    let config = service.get_config_service();
    let config_guard = config.lock().unwrap();

    let config_key = format!("selected_char_ids_{}", role_id);
    let selected_ids: Option<Vec<String>> = config_guard.get(&config_key);

    Ok(selected_ids.unwrap_or_default())
}

/// 获取完整的角色详情数据
#[tauri::command]
pub async fn get_char_detail(
    state: State<'_, Arc<Mutex<AccountService>>>,
    role_id: String,
) -> Result<Option<serde_json::Value>, String> {
    use crate::services::avatar_cache_service::{ImageCacheService, ImageType};
    use crate::{log_error, log_info, log_warn};

    let service = state.lock().await;

    // 获取账户信息以获取 cred/token
    let accounts = service.get_accounts().await;
    let account = accounts.iter().find(|acc| acc.id == role_id);

    if let Some(acc) = account {
        if let (Some(cred), Some(token), Some(user_id), Some(server_id)) =
            (&acc.cred, &acc.token, &acc.user_id, &acc.server_id)
        {
            // 获取完整详情
            match service
                .skland_service()
                .get_role_detail(cred, token, &role_id, server_id, user_id)
                .await
            {
                Ok(response) => {
                    let mut detail = response.data.detail;

                    // 创建图片缓存服务
                    let image_cache = ImageCacheService::new()
                        .map_err(|e| format!("Failed to create image cache: {}", e))?;

                    // 下载并缓存所有角色的头像、技能图标、天赋图标和立绘
                    for char in detail.chars.iter_mut() {
                        if let Some(char_data) = &mut char.char_data {
                            // 缓存角色正方形头像
                            if let Some(ref mut avatar_url_opt) = char_data.avatar_sq_url {
                                if !avatar_url_opt.is_empty()
                                    && !avatar_url_opt.starts_with("data:")
                                {
                                    let url_clone = avatar_url_opt.clone();
                                    match image_cache
                                        .get_or_download_image_base64(&url_clone, ImageType::Avatar)
                                        .await
                                    {
                                        Ok(base64_str) => {
                                            *avatar_url_opt = base64_str;
                                        }
                                        Err(e) => {
                                            log_warn!(
                                                "Failed to download avatar for {}: {}",
                                                char_data.name.as_deref().unwrap_or("unknown"),
                                                e
                                            );
                                        }
                                    }
                                }
                            }

                            // 缓存角色长方形头像
                            if let Some(ref mut avatar_rt_url_opt) = char_data.avatar_rt_url {
                                if !avatar_rt_url_opt.is_empty()
                                    && !avatar_rt_url_opt.starts_with("data:")
                                {
                                    let url_clone = avatar_rt_url_opt.clone();
                                    match image_cache
                                        .get_or_download_image_base64(&url_clone, ImageType::Avatar)
                                        .await
                                    {
                                        Ok(base64_str) => {
                                            *avatar_rt_url_opt = base64_str;
                                        }
                                        Err(e) => {
                                            log_warn!(
                                                "Failed to download rectangular avatar for {}: {}",
                                                char_data.name.as_deref().unwrap_or("unknown"),
                                                e
                                            );
                                        }
                                    }
                                }
                            }

                            // 缓存角色立绘
                            if let Some(ref mut illustration_url_opt) = char_data.illustration_url {
                                if !illustration_url_opt.is_empty()
                                    && !illustration_url_opt.starts_with("data:")
                                {
                                    let url_clone = illustration_url_opt.clone();
                                    match image_cache
                                        .get_or_download_image_base64(
                                            &url_clone,
                                            ImageType::Illustration,
                                        )
                                        .await
                                    {
                                        Ok(base64_str) => {
                                            *illustration_url_opt = base64_str;
                                        }
                                        Err(e) => {
                                            log_warn!(
                                                "Failed to download illustration for {}: {}",
                                                char_data.name.as_deref().unwrap_or("unknown"),
                                                e
                                            );
                                        }
                                    }
                                }
                            }

                            // 缓存技能图标
                            if let Some(ref mut skills) = char_data.skills {
                                for skill in skills.iter_mut() {
                                    if !skill.icon_url.is_empty()
                                        && !skill.icon_url.starts_with("data:")
                                    {
                                        let url_clone = skill.icon_url.clone();
                                        match image_cache
                                            .get_or_download_image_base64(
                                                &url_clone,
                                                ImageType::SkillIcon,
                                            )
                                            .await
                                        {
                                            Ok(base64_str) => {
                                                skill.icon_url = base64_str;
                                            }
                                            Err(e) => {
                                                log_warn!(
                                                    "Failed to download skill icon for {}: {}",
                                                    skill.name,
                                                    e
                                                );
                                            }
                                        }
                                    }
                                }
                            }

                            // 缓存天赋图标（ability_talents）
                            if let Some(ref mut ability_talents) = char_data.ability_talents {
                                for talent in ability_talents.iter_mut() {
                                    if !talent.icon_url.is_empty()
                                        && !talent.icon_url.starts_with("data:")
                                    {
                                        let url_clone = talent.icon_url.clone();
                                        match image_cache
                                            .get_or_download_image_base64(
                                                &url_clone,
                                                ImageType::SkillIcon,
                                            )
                                            .await
                                        {
                                            Ok(base64_str) => {
                                                talent.icon_url = base64_str;
                                            }
                                            Err(e) => {
                                                log_warn!("Failed to download ability talent icon for {}: {}", talent.name, e);
                                            }
                                        }
                                    }
                                }
                            }

                            // 缓存天赋图标（combat_talents）
                            if let Some(ref mut combat_talents) = char_data.combat_talents {
                                for talent in combat_talents.iter_mut() {
                                    if !talent.icon_url.is_empty()
                                        && !talent.icon_url.starts_with("data:")
                                    {
                                        let url_clone = talent.icon_url.clone();
                                        match image_cache
                                            .get_or_download_image_base64(
                                                &url_clone,
                                                ImageType::SkillIcon,
                                            )
                                            .await
                                        {
                                            Ok(base64_str) => {
                                                talent.icon_url = base64_str;
                                            }
                                            Err(e) => {
                                                log_warn!("Failed to download combat talent icon for {}: {}", talent.name, e);
                                            }
                                        }
                                    }
                                }
                            }

                            // 缓存天赋图标（cultivation_talents）
                            if let Some(ref mut cultivation_talents) = char_data.cultivation_talents
                            {
                                for talent in cultivation_talents.iter_mut() {
                                    if !talent.icon_url.is_empty()
                                        && !talent.icon_url.starts_with("data:")
                                    {
                                        let url_clone = talent.icon_url.clone();
                                        match image_cache
                                            .get_or_download_image_base64(
                                                &url_clone,
                                                ImageType::SkillIcon,
                                            )
                                            .await
                                        {
                                            Ok(base64_str) => {
                                                talent.icon_url = base64_str;
                                            }
                                            Err(e) => {
                                                log_warn!("Failed to download cultivation talent icon for {}: {}", talent.name, e);
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }

                    log_info!("Cached character data for {}", detail.base.name);

                    // 返回 detail 部分的 JSON
                    match serde_json::to_value(detail) {
                        Ok(value) => Ok(Some(value)),
                        Err(e) => {
                            log_error!("Failed to serialize char detail: {}", e);
                            Ok(None)
                        }
                    }
                }
                Err(e) => {
                    log_error!("Failed to fetch char detail: {}", e);
                    Ok(None)
                }
            }
        } else {
            Ok(None)
        }
    } else {
        Ok(None)
    }
}
