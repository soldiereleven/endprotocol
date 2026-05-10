use serde_json::json;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::async_runtime;

use crate::models::account::{AccountInfo, AccountLoginResult, AccountRefreshResult};
use crate::models::login::{CodeLoginRequest, LoginRequest, SendCodeRequest};
use crate::models::role::RoleDisplayInfo;
use crate::services::avatar_cache_service::AvatarCacheService;
use crate::services::config_service::ConfigService;
use crate::services::skland_service::SklandService;
use crate::utils::{http_client, AppError};
use crate::{log_debug, log_error, log_info, log_warn};

/// 用于异步任务的简化版账户服务（避免 Arc<Mutex<>> 的复杂性）
struct AsyncAccountService {
    config_service: Arc<Mutex<ConfigService>>,
    skland_service: Arc<SklandService>,
    avatar_cache_service: Arc<AvatarCacheService>,
}

impl AsyncAccountService {
    /// 检查并刷新用户的 cred（如果需要）
    async fn check_and_refresh_user_cred(
        &self,
        user_id: &str,
    ) -> Result<Option<(String, String)>, AppError> {
        // 获取当前用户的配置
        let token_key = format!("account_token_{}", user_id);

        let (token_data, cred, token, hytoken) = {
            let config = self.config_service.lock().unwrap();
            let token_data: Option<serde_json::Value> = config.get(&token_key);

            let (cred, token, hytoken) = match &token_data {
                Some(data) => {
                    let cred = data
                        .get("cred")
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string());
                    let token = data
                        .get("token")
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string());
                    let hytoken = data
                        .get("hytoken")
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string());
                    (cred, token, hytoken)
                }
                None => return Ok(None),
            };

            (token_data, cred, token, hytoken)
        }; // MutexGuard 在这里被释放

        let cred = match cred {
            Some(c) => c,
            None => return Ok(None),
        };

        let token = match token {
            Some(t) => t,
            None => return Ok(None),
        };

        // 检查 cred 是否有效
        match self.skland_service.check_cred(&cred).await {
            Ok(true) => {
                // cred 有效，无需刷新
                tracing::debug!("Cred is valid for user {}", user_id);
                log_debug!(
                    "check_and_refresh_user_cred: Cred is VALID for user {}",
                    user_id
                );
                Ok(None)
            }
            Ok(false) => {
                // cred 无效，需要刷新
                tracing::info!("Cred expired for user {}, refreshing...", user_id);
                log_info!(
                    "check_and_refresh_user_cred: Cred EXPIRED for user {}, attempting refresh...",
                    user_id
                );

                let hytoken = match hytoken {
                    Some(h) => {
                        log_debug!(
                            "check_and_refresh_user_cred: Found hytoken (len={})",
                            h.len()
                        );
                        h
                    }
                    None => {
                        log_error!("check_and_refresh_user_cred: hytoken NOT FOUND for user {}, cannot refresh", user_id);
                        return Err(AppError::AuthError {
                            message: format!("hytoken not found for user {}, cannot refresh cred. Please re-login.", user_id),
                        });
                    }
                };

                // 使用 hytoken 重新换取 cred 和 token
                log_debug!("check_and_refresh_user_cred: Calling refresh_cred_by_hytoken...");
                match self.skland_service.refresh_cred_by_hytoken(&hytoken).await {
                    Ok((new_cred, new_token, _)) => {
                        log_debug!("check_and_refresh_user_cred: refresh_cred_by_hytoken SUCCESS, new_cred_len={}, new_token_len={}", new_cred.len(), new_token.len());
                        // 更新配置中的 cred 和 token
                        let mut config = self.config_service.lock().unwrap();
                        let mut updated_data = token_data.unwrap();
                        if let Some(obj) = updated_data.as_object_mut() {
                            obj.insert("cred".to_string(), json!(new_cred));
                            obj.insert("token".to_string(), json!(new_token));
                            log_debug!(
                                "check_and_refresh_user_cred: Updated cred and token in config"
                            );
                        }
                        config.set(token_key, updated_data)?;
                        log_debug!("check_and_refresh_user_cred: Config saved successfully");

                        tracing::info!("Cred refreshed successfully for user {}", user_id);
                        Ok(Some((new_cred, new_token)))
                    }
                    Err(e) => {
                        log_error!(
                            "check_and_refresh_user_cred: refresh_cred_by_hytoken FAILED: {}",
                            e
                        );
                        tracing::error!("Failed to refresh cred for user {}: {}", user_id, e);
                        Err(e)
                    }
                }
            }
            Err(e) => {
                // check_cred API 调用失败
                log_error!(
                    "check_and_refresh_user_cred: check_cred API call failed: {}",
                    e
                );
                tracing::warn!(
                    "check_cred API failed for user {}: {}, treating as expired",
                    user_id,
                    e
                );

                let hytoken = match hytoken {
                    Some(h) => {
                        log_debug!("check_and_refresh_user_cred: Found hytoken (len={}), attempting refresh despite API error", h.len());
                        h
                    }
                    None => {
                        log_error!("check_and_refresh_user_cred: hytoken NOT FOUND and check_cred failed, cannot proceed");
                        return Err(AppError::AuthError {
                            message: format!("hytoken not found for user {} and check_cred failed: {}. Please re-login.", user_id, e),
                        });
                    }
                };

                log_debug!(
                    "check_and_refresh_user_cred: Attempting refresh despite check_cred failure..."
                );
                match self.skland_service.refresh_cred_by_hytoken(&hytoken).await {
                    Ok((new_cred, new_token, _)) => {
                        log_debug!("check_and_refresh_user_cred: Refresh succeeded despite check_cred failure");
                        let mut config = self.config_service.lock().unwrap();
                        let mut updated_data = token_data.unwrap();
                        if let Some(obj) = updated_data.as_object_mut() {
                            obj.insert("cred".to_string(), json!(new_cred));
                            obj.insert("token".to_string(), json!(new_token));
                        }
                        config.set(token_key, updated_data)?;

                        tracing::info!(
                            "Cred refreshed successfully for user {} (after check_cred failure)",
                            user_id
                        );
                        Ok(Some((new_cred, new_token)))
                    }
                    Err(refresh_err) => {
                        log_error!(
                            "check_and_refresh_user_cred: Both check_cred and refresh failed: {}",
                            refresh_err
                        );
                        Err(AppError::AuthError {
                            message: format!(
                                "check_cred failed: {}. Refresh also failed: {}. Please re-login.",
                                e, refresh_err
                            ),
                        })
                    }
                }
            }
        }
    }
}

/// 账户服务
pub struct AccountService {
    config_service: Arc<Mutex<ConfigService>>,
    skland_service: Arc<SklandService>,
    avatar_cache_service: Arc<AvatarCacheService>,
}

impl AccountService {
    /// 创建新的账户服务实例
    pub fn new(
        config_service: Arc<Mutex<ConfigService>>,
        skland_service: Arc<SklandService>,
        avatar_cache_service: Arc<AvatarCacheService>,
    ) -> Self {
        Self {
            config_service,
            skland_service,
            avatar_cache_service,
        }
    }

    /// 获取配置服务引用
    pub fn get_config_service(&self) -> &Arc<Mutex<ConfigService>> {
        &self.config_service
    }

    /// 获取 Skland 服务引用
    pub fn skland_service(&self) -> &Arc<SklandService> {
        &self.skland_service
    }

    /// 创建一个可用于 async spawn 的克隆（简化版，仅包含必要的服务引用）
    fn clone_for_async(&self) -> AsyncAccountService {
        AsyncAccountService {
            config_service: self.config_service.clone(),
            skland_service: self.skland_service.clone(),
            avatar_cache_service: self.avatar_cache_service.clone(),
        }
    }

    /// 公开方法：检查并刷新用户的 cred（供 Tauri command 调用）
    pub async fn check_and_refresh_user_cred(
        &self,
        user_id: &str,
    ) -> Result<Option<(String, String)>, AppError> {
        let async_service = self.clone_for_async();
        async_service.check_and_refresh_user_cred(user_id).await
    }

    /// 为指定用户设置 hytoken（在登录成功后调用）
    pub async fn set_hytoken_for_user(&self, user_id: &str, hytoken: &str) -> Result<(), AppError> {
        log_debug!(
            "set_hytoken_for_user: START for user_id={}, hytoken_len={}",
            user_id,
            hytoken.len()
        );
        let mut config = self.config_service.lock().unwrap();
        let token_key = format!("account_token_{}", user_id);

        let mut token_data: serde_json::Value = config.get(&token_key).unwrap_or(json!({}));
        log_debug!(
            "set_hytoken_for_user: Current token_data keys: {:?}",
            token_data
                .as_object()
                .map(|obj| obj.keys().collect::<Vec<_>>())
        );

        if let Some(obj) = token_data.as_object_mut() {
            obj.insert("hytoken".to_string(), json!(hytoken));
            log_debug!("set_hytoken_for_user: hytoken inserted successfully");
        } else {
            log_error!("set_hytoken_for_user: token_data is not an object!");
            return Err(AppError::ConfigError {
                message: "token_data is not a valid JSON object".to_string(),
            });
        }

        config.set(token_key, token_data)?;
        log_debug!("set_hytoken_for_user: Config saved successfully");
        Ok(())
    }

    /// 启动自动刷新定时器（应在 Tauri runtime 启动后调用）
    pub fn start_auto_refresh(_config_service: Arc<Mutex<ConfigService>>) {
        async_runtime::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_secs(300)); // 5分钟
            loop {
                interval.tick().await;
                tracing::debug!("Auto-refresh timer triggered");
                // 注意：实际的刷新操作由前端调用 refresh_accounts 命令触发
            }
        });
    }

    /// 获取所有账户（同步获取完整数据）
    pub async fn get_accounts(&self) -> Vec<AccountInfo> {
        log_debug!("get_accounts: START");

        // 先收集所有需要获取详情的角色信息
        let role_infos = {
            let config = self.config_service.lock().unwrap();
            let all_config = config.get_all();

            log_debug!(
                "get_accounts: all_config keys = {:?}",
                all_config.keys().collect::<Vec<_>>()
            );

            let mut role_infos = Vec::new();

            // 遍历所有 account_token_* 配置项
            for (key, value) in &all_config {
                if key.starts_with("account_token_") {
                    // 提取 userId (key 的格式是 account_token_{userId})
                    let user_id = key.trim_start_matches("account_token_");

                    let cred = value
                        .get("cred")
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string());
                    let token = value
                        .get("token")
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string());

                    log_debug!(
                        "get_accounts: user_id={}, cred_len={}, token_len={}",
                        user_id,
                        cred.as_ref().map(|s| s.len()).unwrap_or(0),
                        token.as_ref().map(|s| s.len()).unwrap_or(0)
                    );

                    // 获取 roles 数组
                    if let Some(roles) = value.get("roles").and_then(|v| v.as_array()) {
                        for role in roles {
                            if let (Some(role_id), Some(server_id)) = (
                                role.get("roleId").and_then(|v| v.as_str()),
                                role.get("serverId").and_then(|v| v.as_str()),
                            ) {
                                role_infos.push((
                                    role_id.to_string(),
                                    server_id.to_string(),
                                    user_id.to_string(),
                                    cred.clone(),
                                    token.clone(),
                                ));
                            }
                        }
                    }
                }
            }

            log_debug!("get_accounts: found {} roles to fetch", role_infos.len());
            role_infos
            // config 在这里被自动 drop
        };

        // 如果没有角色，直接返回空数组
        if role_infos.is_empty() {
            log_debug!("get_accounts: No roles found, returning empty");
            return Vec::new();
        }

        // 同步获取所有账户的完整数据
        let mut accounts = Vec::new();

        for (role_id, server_id, user_id, cred_opt, token_opt) in role_infos {
            if let (Some(cred), Some(token)) = (cred_opt, token_opt) {
                log_debug!(
                    "get_accounts: Processing role_id={}, user_id={}",
                    role_id,
                    user_id
                );

                // 先检查并刷新 cred（如果需要）
                log_debug!("get_accounts: Checking cred for user_id={}", user_id);
                let (final_cred, final_token) = match self
                    .check_and_refresh_user_cred(&user_id)
                    .await
                {
                    Ok(Some((new_cred, new_token))) => {
                        tracing::info!("Cred refreshed for user {}", user_id);
                        log_debug!("get_accounts: Cred refreshed for user {}", user_id);
                        (new_cred, new_token)
                    }
                    Ok(None) => {
                        // cred 仍然有效，使用原有的
                        log_debug!("get_accounts: Cred still valid for user {}", user_id);
                        (cred, token)
                    }
                    Err(e) => {
                        tracing::error!("Failed to check/refresh cred for user {}: {}", user_id, e);
                        log_error!(
                            "get_accounts: Failed to check/refresh cred for user {}: {}",
                            user_id,
                            e
                        );

                        // 判断是否是 hytoken 失效
                        let error_string = e.to_string();
                        let is_hytoken_expired = error_string.contains("hytoken")
                            || error_string.contains("OAuth")
                            || error_string.contains("grant failed");

                        log_debug!("get_accounts: Error string = '{}'", error_string);
                        log_debug!("get_accounts: is_hytoken_expired = {}", is_hytoken_expired);

                        // 刷新失败，创建 FAILED 状态的账户
                        let account = AccountInfo {
                            id: role_id.clone(),
                            avatar: String::new(),
                            nickname: format!("Role {}", &role_id[..8.min(role_id.len())]),
                            level: 0,
                            server: server_id.clone(),
                            status: "offline".to_string(),
                            sync_status: if is_hytoken_expired {
                                Some("HYTOKEN_EXPIRED".to_string()) // hytoken 失效，无法刷新
                            } else {
                                Some("FAILED".to_string()) // 其他错误
                            },
                            cred: Some(cred),
                            token: Some(token),
                            user_id: Some(user_id.clone()),
                            server_id: Some(server_id.clone()),
                        };
                        log_debug!(
                            "get_accounts: Created account with sync_status = {:?}",
                            account.sync_status
                        );
                        accounts.push(account);
                        continue;
                    }
                };

                match self
                    .skland_service
                    .get_role_detail(&final_cred, &final_token, &role_id, &server_id, &user_id)
                    .await
                {
                    Ok(char_detail_response) => {
                        // 从完整响应中提取 AccountInfo 所需字段
                        let base = &char_detail_response.data.detail.base;

                        // 下载并缓存头像（返回 base64）
                        let cached_avatar = self
                            .avatar_cache_service
                            .get_or_download_avatar_base64(&base.avatar_url)
                            .await
                            .unwrap_or_else(|_| base.avatar_url.clone());

                        let account = AccountInfo {
                            id: role_id.clone(),
                            avatar: cached_avatar,
                            nickname: base.name.clone(),
                            level: base.level,
                            server: server_id.clone(),
                            status: "online".to_string(),
                            sync_status: None, // 同步成功，清除状态
                            cred: Some(final_cred),
                            token: Some(final_token),
                            user_id: Some(user_id.clone()),
                            server_id: Some(server_id.clone()),
                        };
                        accounts.push(account);
                    }
                    Err(e) => {
                        tracing::warn!("Failed to get role detail for {}: {}", role_id, e);
                        log_error!(
                            "get_accounts: Failed to get role detail for {}: {}",
                            role_id,
                            e
                        );

                        // 检查是否是 SYNC FAILED 错误，尝试自动刷新 cred
                        let error_string = e.to_string();
                        let is_sync_failed = error_string.contains("API error")
                            || error_string.contains("Failed to parse JSON")
                            || error_string.contains("HTTP request failed");

                        if is_sync_failed {
                            log_debug!("get_accounts: Detected SYNC FAILED, attempting auto-refresh for user {}", user_id);

                            // 尝试使用 hytoken 重新获取 cred
                            let hytoken_key = format!("account_token_{}", user_id);
                            let hytoken: Option<String> = {
                                let config = self.config_service.lock().unwrap();
                                config.get::<serde_json::Value>(&hytoken_key).and_then(|v| {
                                    v.get("hytoken")
                                        .and_then(|h| h.as_str())
                                        .map(|s| s.to_string())
                                })
                            };

                            if let Some(hyt) = hytoken {
                                log_debug!("get_accounts: Found hytoken, attempting refresh...");
                                match self.skland_service.refresh_cred_by_hytoken(&hyt).await {
                                    Ok((new_cred, new_token, _)) => {
                                        log_debug!("get_accounts: Auto-refresh succeeded, retrying get_role_detail...");

                                        // 更新配置中的 cred 和 token
                                        {
                                            let mut config = self.config_service.lock().unwrap();
                                            let mut token_data: serde_json::Value =
                                                config.get(&hytoken_key).unwrap_or(json!({}));
                                            if let Some(obj) = token_data.as_object_mut() {
                                                obj.insert("cred".to_string(), json!(new_cred));
                                                obj.insert("token".to_string(), json!(new_token));
                                            }
                                            let _ = config.set(hytoken_key, token_data);
                                        }

                                        // 重试获取角色详情
                                        match self
                                            .skland_service
                                            .get_role_detail(
                                                &new_cred, &new_token, &role_id, &server_id,
                                                &user_id,
                                            )
                                            .await
                                        {
                                            Ok(char_detail_response) => {
                                                // 从完整响应中提取 AccountInfo 所需字段
                                                let base = &char_detail_response.data.detail.base;

                                                // 下载并缓存头像（返回 base64）
                                                let cached_avatar = self
                                                    .avatar_cache_service
                                                    .get_or_download_avatar_base64(&base.avatar_url)
                                                    .await
                                                    .unwrap_or_else(|_| base.avatar_url.clone());

                                                let account = AccountInfo {
                                                    id: role_id.clone(),
                                                    avatar: cached_avatar,
                                                    nickname: base.name.clone(),
                                                    level: base.level,
                                                    server: server_id.clone(),
                                                    status: "online".to_string(),
                                                    sync_status: None, // 同步成功，清除状态
                                                    cred: Some(new_cred),
                                                    token: Some(new_token),
                                                    user_id: Some(user_id.clone()),
                                                    server_id: Some(server_id.clone()),
                                                };
                                                accounts.push(account);
                                                continue; // 跳过下面的 FAILED 状态创建
                                            }
                                            Err(retry_e) => {
                                                log_error!("get_accounts: Auto-refresh retry also failed: {}", retry_e);
                                                // 重试也失败了，继续创建 FAILED 状态
                                            }
                                        }
                                    }
                                    Err(refresh_e) => {
                                        log_error!(
                                            "get_accounts: Auto-refresh failed: {}",
                                            refresh_e
                                        );
                                        // 刷新失败，继续创建 FAILED 状态
                                    }
                                }
                            } else {
                                log_warn!("get_accounts: No hytoken found for auto-refresh");
                            }
                        }

                        // 创建失败状态的账户
                        let account = AccountInfo {
                            id: role_id.clone(),
                            avatar: String::new(),
                            nickname: format!("Role {}", &role_id[..8.min(role_id.len())]),
                            level: 0,
                            server: server_id.clone(),
                            status: "offline".to_string(),
                            sync_status: Some("FAILED".to_string()),
                            cred: Some(final_cred),
                            token: Some(final_token),
                            user_id: Some(user_id.clone()),
                            server_id: Some(server_id.clone()),
                        };
                        accounts.push(account);
                    }
                }
            }
        }

        log_debug!("get_accounts: Completed with {} accounts", accounts.len());
        accounts
    }

    /// 添加账户（执行三步认证）
    pub async fn add_account(
        &self,
        login_request: LoginRequest,
    ) -> Result<AccountLoginResult, AppError> {
        // Step 1: 获取 Hypergryph Token
        let hy_token = match self
            .get_hypergryph_token(&login_request.phone, &login_request.password)
            .await
        {
            Ok(token) => token,
            Err(e) => {
                return Ok(AccountLoginResult {
                    success: false,
                    error_message: Some(format!("Step 1 failed: {}", e)),
                    account: None,
                    available_roles: None,
                    cred: None,
                    token: None,
                    user_id: None,
                });
            }
        };

        // Step 2: 获取 Skland Code
        let sk_code = match self.get_skland_code(&hy_token).await {
            Ok(code) => code,
            Err(e) => {
                return Ok(AccountLoginResult {
                    success: false,
                    error_message: Some(format!("Step 2 failed: {}", e)),
                    account: None,
                    available_roles: None,
                    cred: None,
                    token: None,
                    user_id: None,
                });
            }
        };

        // Step 3: 获取 Skland Cred 和 Token
        let (cred, token, user_id) = match self.get_skland_cred(&sk_code).await {
            Ok(data) => data,
            Err(e) => {
                return Ok(AccountLoginResult {
                    success: false,
                    error_message: Some(format!("Step 3 failed: {}", e)),
                    account: None,
                    available_roles: None,
                    cred: None,
                    token: None,
                    user_id: None,
                });
            }
        };

        // 保存 hytoken（与 cred 同级存储）
        log_debug!("About to save hytoken for user_id={}", user_id);
        if let Err(e) = self.set_hytoken_for_user(&user_id, &hy_token).await {
            tracing::warn!("Failed to save hytoken for user {}: {}", user_id, e);
            log_error!("Failed to save hytoken: {}", e);
        } else {
            log_debug!("hytoken saved successfully");
        }

        // Step 4: 获取玩家绑定列表
        let bindings = match self.skland_service.get_player_binding(&cred, &token).await {
            Ok(bindings) => bindings,
            Err(e) => {
                log_error!("Step 4 failed: {}", e);
                return Ok(AccountLoginResult {
                    success: false,
                    error_message: Some(format!("Failed to get binding list: {}", e)),
                    account: None,
                    available_roles: None,
                    cred: None,
                    token: None,
                    user_id: None,
                });
            }
        };

        // Step 5: 提取终末地角色
        let endfield_roles = SklandService::extract_endfield_roles(&bindings);

        if endfield_roles.is_empty() {
            log_error!("No Endfield roles found!");
            return Ok(AccountLoginResult {
                success: false,
                error_message: Some("No Endfield roles found in binding list".to_string()),
                account: None,
                available_roles: None,
                cred: Some(cred.clone()),
                token: Some(token.clone()),
                user_id: Some(user_id.clone()),
            });
        }

        // Step 6: 获取每个角色的详情
        let mut role_details = Vec::new();
        for (_uid, server_id, role_id) in &endfield_roles {
            match self
                .skland_service
                .get_role_detail(&cred, &token, role_id, server_id, &user_id)
                .await
            {
                Ok(char_detail_response) => {
                    // 从完整响应中提取 AccountInfo 所需字段
                    let base = &char_detail_response.data.detail.base;

                    // 下载并缓存头像（返回 base64）
                    let cached_avatar = self
                        .avatar_cache_service
                        .get_or_download_avatar_base64(&base.avatar_url)
                        .await
                        .unwrap_or_else(|_| base.avatar_url.clone());

                    let detail = RoleDisplayInfo {
                        role_id: role_id.clone(),
                        user_id: user_id.clone(),
                        server_id: server_id.clone(),
                        nickname: base.name.clone(),
                        level: base.level,
                        avatar_url: cached_avatar,
                    };
                    role_details.push(detail);
                }
                Err(e) => {
                    log_error!("Failed to get role detail for {}: {}", role_id, e);
                    // 跳过失败的角色
                }
            }
        }

        // 返回可用角色列表，等待前端选择
        Ok(AccountLoginResult {
            success: true,
            error_message: None,
            account: None,
            available_roles: Some(role_details),
            cred: Some(cred),
            token: Some(token),
            user_id: Some(user_id),
        })
    }

    /// 登出单个账户
    pub async fn logout_account(&self, account_id: String) -> bool {
        let mut config = self.config_service.lock().unwrap();

        // account_id 实际上是 roleId，我们需要找到它对应的 userId
        // 遍历所有 account_token_* 配置项来找到匹配的 role
        let all_config = config.get_all();
        let mut keys_to_update = Vec::new();
        let mut keys_to_remove = Vec::new();

        for (key, value) in &all_config {
            if key.starts_with("account_token_") {
                if let Some(roles) = value.get("roles").and_then(|v| v.as_array()) {
                    // 检查这个用户是否有该角色
                    let has_role = roles.iter().any(|role| {
                        role.get("roleId").and_then(|v| v.as_str()) == Some(account_id.as_str())
                    });

                    if has_role {
                        // 从 roles 数组中移除该角色
                        let mut updated_value = value.clone();
                        if let Some(roles_array) = updated_value.get_mut("roles") {
                            if let Some(roles_vec) = roles_array.as_array_mut() {
                                roles_vec.retain(|role| {
                                    role.get("roleId").and_then(|v| v.as_str())
                                        != Some(account_id.as_str())
                                });

                                // 如果该用户没有其他角色了，标记删除
                                if roles_vec.is_empty() {
                                    keys_to_remove.push(key.clone());
                                } else {
                                    keys_to_update.push((key.clone(), updated_value));
                                }
                            }
                        }
                    }
                }
            }
        }

        // 更新配置
        for (key, value) in keys_to_update {
            let _ = config.set(key, value);
        }

        // 删除空的用户配置项
        for key in keys_to_remove {
            config.remove(&key);
        }

        // 更新 account_list（如果需要的话）
        let mut account_list: Vec<String> = config.get("account_list").unwrap_or_default();
        account_list.retain(|id| id != &account_id);
        let _ = config.set("account_list".to_string(), json!(account_list));

        true
    }

    /// 批量登出账户
    pub async fn batch_logout(&self, account_ids: Vec<String>) -> bool {
        let mut config = self.config_service.lock().unwrap();

        // 从账户列表中移除
        let mut account_list: Vec<String> = config.get("account_list").unwrap_or_default();
        account_list.retain(|id| !account_ids.contains(id));
        let _ = config.set("account_list".to_string(), json!(account_list));

        // 删除所有指定账户的凭证
        for account_id in &account_ids {
            config.remove(&format!("account_token_{}", account_id));
        }

        true
    }

    /// 刷新账户数据（手动刷新时也会检查 cred）
    pub async fn refresh_accounts(&self) -> AccountRefreshResult {
        log_debug!("refresh_accounts: START");

        // 先收集所有需要刷新的角色信息
        let role_infos = {
            let config = self.config_service.lock().unwrap();
            let all_config = config.get_all();
            let mut role_infos = Vec::new();

            for (key, value) in &all_config {
                if key.starts_with("account_token_") {
                    let user_id = key.trim_start_matches("account_token_");
                    let cred = value
                        .get("cred")
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string());
                    let token = value
                        .get("token")
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string());

                    log_debug!(
                        "refresh_accounts: user_id={}, cred_len={}, token_len={}",
                        user_id,
                        cred.as_ref().map(|s| s.len()).unwrap_or(0),
                        token.as_ref().map(|s| s.len()).unwrap_or(0)
                    );

                    if let Some(roles) = value.get("roles").and_then(|v| v.as_array()) {
                        for role in roles {
                            if let (Some(role_id), Some(server_id)) = (
                                role.get("roleId").and_then(|v| v.as_str()),
                                role.get("serverId").and_then(|v| v.as_str()),
                            ) {
                                role_infos.push((
                                    role_id.to_string(),
                                    server_id.to_string(),
                                    user_id.to_string(),
                                    cred.clone(),
                                    token.clone(),
                                ));
                            }
                        }
                    }
                }
            }
            log_debug!(
                "refresh_accounts: found {} roles to refresh",
                role_infos.len()
            );
            role_infos
        };

        // 为每个账户获取最新的角色详情
        let mut refreshed_accounts = Vec::new();
        for (role_id, server_id, user_id, cred_opt, token_opt) in role_infos {
            if let (Some(cred), Some(token)) = (cred_opt, token_opt) {
                log_debug!(
                    "refresh_accounts: Processing role_id={}, user_id={}",
                    role_id,
                    user_id
                );

                // 先检查并刷新 cred（如果需要）
                log_debug!("refresh_accounts: Checking cred for user_id={}", user_id);
                let (final_cred, final_token) = match self
                    .check_and_refresh_user_cred(&user_id)
                    .await
                {
                    Ok(Some((new_cred, new_token))) => {
                        tracing::info!("Cred refreshed for user {} during manual refresh", user_id);
                        log_debug!("refresh_accounts: Cred refreshed for user {}", user_id);
                        (new_cred, new_token)
                    }
                    Ok(None) => {
                        // cred 仍然有效，使用原有的
                        log_debug!("refresh_accounts: Cred still valid for user {}", user_id);
                        (cred, token)
                    }
                    Err(e) => {
                        tracing::error!("Failed to check/refresh cred for user {}: {}", user_id, e);
                        log_error!(
                            "refresh_accounts: Failed to check/refresh cred for user {}: {}",
                            user_id,
                            e
                        );

                        // 判断是否是 hytoken 失效
                        let is_hytoken_expired = e.to_string().contains("hytoken")
                            || e.to_string().contains("OAuth")
                            || e.to_string().contains("grant failed");

                        // 刷新失败，创建 FAILED 状态的账户
                        let account = AccountInfo {
                            id: role_id.clone(),
                            avatar: String::new(),
                            nickname: format!("Role {}", &role_id[..8.min(role_id.len())]),
                            level: 0,
                            server: server_id.clone(),
                            status: "offline".to_string(),
                            sync_status: if is_hytoken_expired {
                                Some("HYTOKEN_EXPIRED".to_string()) // hytoken 失效，无法刷新
                            } else {
                                Some("FAILED".to_string()) // 其他错误
                            },
                            cred: Some(cred),
                            token: Some(token),
                            user_id: Some(user_id.clone()),
                            server_id: Some(server_id.clone()),
                        };
                        refreshed_accounts.push(account);
                        continue;
                    }
                };

                match self
                    .skland_service
                    .get_role_detail(&final_cred, &final_token, &role_id, &server_id, &user_id)
                    .await
                {
                    Ok(char_detail_response) => {
                        // 从完整响应中提取 AccountInfo 所需字段
                        let base = &char_detail_response.data.detail.base;

                        // 下载并缓存头像（返回 base64）
                        let cached_avatar = self
                            .avatar_cache_service
                            .get_or_download_avatar_base64(&base.avatar_url)
                            .await
                            .unwrap_or_else(|_| base.avatar_url.clone());

                        let refreshed_account = AccountInfo {
                            id: role_id,
                            avatar: cached_avatar,
                            nickname: base.name.clone(),
                            level: base.level,
                            server: server_id.clone(),
                            status: "online".to_string(),
                            sync_status: None, // 同步成功，清除状态
                            cred: Some(final_cred),
                            token: Some(final_token),
                            user_id: Some(user_id),
                            server_id: Some(server_id.clone()),
                        };
                        refreshed_accounts.push(refreshed_account);
                    }
                    Err(e) => {
                        tracing::warn!("Failed to refresh account {}: {}", role_id, e);
                        log_error!(
                            "refresh_accounts: Failed to refresh account {}: {}",
                            role_id,
                            e
                        );

                        // 检查是否是 SYNC FAILED 错误，尝试自动刷新 cred
                        let error_string = e.to_string();
                        let is_sync_failed = error_string.contains("API error")
                            || error_string.contains("Failed to parse JSON")
                            || error_string.contains("HTTP request failed");

                        if is_sync_failed {
                            log_debug!("refresh_accounts: Detected SYNC FAILED, attempting auto-refresh for user {}", user_id);

                            // 尝试使用 hytoken 重新获取 cred
                            let hytoken_key = format!("account_token_{}", user_id);
                            let hytoken: Option<String> = {
                                let config = self.config_service.lock().unwrap();
                                config.get::<serde_json::Value>(&hytoken_key).and_then(|v| {
                                    v.get("hytoken")
                                        .and_then(|h| h.as_str())
                                        .map(|s| s.to_string())
                                })
                            };

                            if let Some(hyt) = hytoken {
                                log_debug!(
                                    "refresh_accounts: Found hytoken, attempting refresh..."
                                );
                                match self.skland_service.refresh_cred_by_hytoken(&hyt).await {
                                    Ok((new_cred, new_token, _)) => {
                                        log_debug!("refresh_accounts: Auto-refresh succeeded, retrying get_role_detail...");

                                        // 更新配置中的 cred 和 token
                                        {
                                            let mut config = self.config_service.lock().unwrap();
                                            let mut token_data: serde_json::Value =
                                                config.get(&hytoken_key).unwrap_or(json!({}));
                                            if let Some(obj) = token_data.as_object_mut() {
                                                obj.insert("cred".to_string(), json!(new_cred));
                                                obj.insert("token".to_string(), json!(new_token));
                                            }
                                            let _ = config.set(hytoken_key, token_data);
                                        }

                                        // 重试获取角色详情
                                        match self
                                            .skland_service
                                            .get_role_detail(
                                                &new_cred, &new_token, &role_id, &server_id,
                                                &user_id,
                                            )
                                            .await
                                        {
                                            Ok(char_detail_response) => {
                                                // 从完整响应中提取 AccountInfo 所需字段
                                                let base = &char_detail_response.data.detail.base;

                                                // 下载并缓存头像（返回 base64）
                                                let cached_avatar = self
                                                    .avatar_cache_service
                                                    .get_or_download_avatar_base64(&base.avatar_url)
                                                    .await
                                                    .unwrap_or_else(|_| base.avatar_url.clone());

                                                let refreshed_account = AccountInfo {
                                                    id: role_id.clone(),
                                                    avatar: cached_avatar,
                                                    nickname: base.name.clone(),
                                                    level: base.level,
                                                    server: server_id.clone(),
                                                    status: "online".to_string(),
                                                    sync_status: None, // 同步成功，清除状态
                                                    cred: Some(new_cred),
                                                    token: Some(new_token),
                                                    user_id: Some(user_id.clone()),
                                                    server_id: Some(server_id.clone()),
                                                };
                                                refreshed_accounts.push(refreshed_account);
                                                continue; // 跳过下面的 FAILED 状态创建
                                            }
                                            Err(retry_e) => {
                                                log_error!("refresh_accounts: Auto-refresh retry also failed: {}", retry_e);
                                                // 重试也失败了，继续创建 FAILED 状态
                                            }
                                        }
                                    }
                                    Err(refresh_e) => {
                                        log_error!(
                                            "refresh_accounts: Auto-refresh failed: {}",
                                            refresh_e
                                        );
                                        // 刷新失败，继续创建 FAILED 状态
                                    }
                                }
                            } else {
                                log_warn!("refresh_accounts: No hytoken found for auto-refresh");
                            }
                        }

                        // 保留旧数据，但标记为离线和 FAILED
                        let account = AccountInfo {
                            id: role_id.clone(),
                            avatar: String::new(),
                            nickname: format!("Role {}", &role_id[..8.min(role_id.len())]),
                            level: 0,
                            server: server_id.clone(),
                            status: "offline".to_string(),
                            sync_status: Some("FAILED".to_string()),
                            cred: Some(final_cred),
                            token: Some(final_token),
                            user_id: Some(user_id.clone()),
                            server_id: Some(server_id),
                        };
                        refreshed_accounts.push(account);
                    }
                }
            }
        }

        log_debug!(
            "refresh_accounts: Completed with {} accounts",
            refreshed_accounts.len()
        );

        AccountRefreshResult {
            success: true,
            error_message: None,
            accounts: refreshed_accounts,
            refresh_time: chrono::Utc::now().to_rfc3339(),
        }
    }

    /// 发送手机验证码
    pub async fn send_verification_code(&self, request: SendCodeRequest) -> Result<bool, AppError> {
        let client = http_client::create_client();
        let payload = json!({
            "phone": request.phone,
            "type": request.code_type
        });

        let start_time = std::time::Instant::now();
        log_info!("=== HTTP REQUEST: 发送验证码 ===");
        log_info!("Method: POST");
        log_info!("URL: https://as.hypergryph.com/general/v1/send_phone_code");
        log_debug!(
            "Request Body: {}",
            serde_json::to_string(&payload).unwrap_or_default()
        );

        let response = client
            .post("https://as.hypergryph.com/general/v1/send_phone_code")
            .json(&payload)
            .send()
            .await?;

        let elapsed = start_time.elapsed();
        let status = response.status();
        let resp_headers = response.headers().clone();

        let json: serde_json::Value = response.json().await?;

        log_info!("=== HTTP RESPONSE: 发送验证码 ===");
        log_info!("Status: {}", status);
        log_info!("Time: {:?}", elapsed);
        log_debug!("Response Headers:");
        for (name, value) in resp_headers.iter() {
            if let Ok(value_str) = value.to_str() {
                log_debug!("  {}: {}", name, value_str);
            }
        }
        log_debug!(
            "Response Body: {}",
            serde_json::to_string(&json).unwrap_or_default()
        );

        if json.get("status").and_then(|v| v.as_i64()) == Some(0) {
            Ok(true)
        } else {
            let msg = json
                .get("msg")
                .and_then(|v| v.as_str())
                .unwrap_or("Unknown error");
            Err(AppError::AuthError {
                message: format!("Failed to send verification code: {}", msg),
            })
        }
    }

    /// 通过验证码登录（获取 Hypergryph Token）
    async fn get_hypergryph_token_by_code(
        &self,
        phone: &str,
        code: &str,
    ) -> Result<String, AppError> {
        let client = http_client::create_client();
        let payload = json!({
            "phone": phone,
            "code": code
        });

        let start_time = std::time::Instant::now();
        log_info!("=== HTTP REQUEST: 验证码登录 ===");
        log_info!("Method: POST");
        log_info!("URL: https://as.hypergryph.com/user/auth/v2/token_by_phone_code");
        log_debug!(
            "Request Body: {}",
            serde_json::to_string(&payload).unwrap_or_default()
        );

        let response = client
            .post("https://as.hypergryph.com/user/auth/v2/token_by_phone_code")
            .json(&payload)
            .send()
            .await?;

        let elapsed = start_time.elapsed();
        let status = response.status();
        let resp_headers = response.headers().clone();

        let json: serde_json::Value = response.json().await?;

        log_info!("=== HTTP RESPONSE: 验证码登录 ===");
        log_info!("Status: {}", status);
        log_info!("Time: {:?}", elapsed);
        log_debug!("Response Headers:");
        for (name, value) in resp_headers.iter() {
            if let Ok(value_str) = value.to_str() {
                log_debug!("  {}: {}", name, value_str);
            }
        }
        log_debug!(
            "Response Body: {}",
            serde_json::to_string(&json).unwrap_or_default()
        );

        if json.get("status").and_then(|v| v.as_i64()) == Some(0) {
            json.get("data")
                .and_then(|d| d.get("token"))
                .and_then(|t| t.as_str())
                .map(|s| s.to_string())
                .ok_or_else(|| AppError::AuthError {
                    message: "Token not found in response".to_string(),
                })
        } else {
            let msg = json
                .get("msg")
                .and_then(|v| v.as_str())
                .unwrap_or("Unknown error");
            Err(AppError::AuthError {
                message: format!("Hypergryph API error: {}", msg),
            })
        }
    }

    /// 通过验证码添加账户
    pub async fn add_account_by_code(
        &self,
        login_request: CodeLoginRequest,
    ) -> Result<AccountLoginResult, AppError> {
        // Step 1: 通过验证码获取 Hypergryph Token
        let hy_token = match self
            .get_hypergryph_token_by_code(&login_request.phone, &login_request.code)
            .await
        {
            Ok(token) => token,
            Err(e) => {
                return Ok(AccountLoginResult {
                    success: false,
                    error_message: Some(format!("Step 1 failed: {}", e)),
                    account: None,
                    available_roles: None,
                    cred: None,
                    token: None,
                    user_id: None,
                });
            }
        };

        // Step 2: 获取 Skland Code
        let sk_code = match self.get_skland_code(&hy_token).await {
            Ok(code) => code,
            Err(e) => {
                return Ok(AccountLoginResult {
                    success: false,
                    error_message: Some(format!("Step 2 failed: {}", e)),
                    account: None,
                    available_roles: None,
                    cred: None,
                    token: None,
                    user_id: None,
                });
            }
        };

        // Step 3: 获取 Skland Cred 和 Token
        let (cred, token, user_id) = match self.get_skland_cred(&sk_code).await {
            Ok(data) => data,
            Err(e) => {
                return Ok(AccountLoginResult {
                    success: false,
                    error_message: Some(format!("Step 3 failed: {}", e)),
                    account: None,
                    available_roles: None,
                    cred: None,
                    token: None,
                    user_id: None,
                });
            }
        };

        // 保存 hytoken（与 cred 同级存储）
        log_debug!("About to save hytoken for user_id={}", user_id);
        if let Err(e) = self.set_hytoken_for_user(&user_id, &hy_token).await {
            tracing::warn!("Failed to save hytoken for user {}: {}", user_id, e);
            log_error!("Failed to save hytoken: {}", e);
        } else {
            log_debug!("hytoken saved successfully");
        }

        // Step 4: 获取玩家绑定列表
        let bindings = match self.skland_service.get_player_binding(&cred, &token).await {
            Ok(bindings) => bindings,
            Err(e) => {
                return Ok(AccountLoginResult {
                    success: false,
                    error_message: Some(format!("Failed to get binding list: {}", e)),
                    account: None,
                    available_roles: None,
                    cred: None,
                    token: None,
                    user_id: None,
                });
            }
        };

        // Step 5: 提取终末地角色
        let endfield_roles = SklandService::extract_endfield_roles(&bindings);

        if endfield_roles.is_empty() {
            log_error!("No Endfield roles found!");
            return Ok(AccountLoginResult {
                success: false,
                error_message: Some("No Endfield roles found in binding list".to_string()),
                account: None,
                available_roles: None,
                cred: Some(cred.clone()),
                token: Some(token.clone()),
                user_id: Some(user_id.clone()),
            });
        }

        // Step 6: 获取每个角色的详情
        log_debug!(
            "Step 6: Getting role details for {} roles...",
            endfield_roles.len()
        );
        let mut role_details = Vec::new();
        for (uid, server_id, role_id) in &endfield_roles {
            log_debug!(
                "  Getting detail for role_id={}, server_id={}",
                role_id,
                server_id
            );
            match self
                .skland_service
                .get_role_detail(&cred, &token, role_id, server_id, &user_id)
                .await
            {
                Ok(char_detail_response) => {
                    // 从完整响应中提取 AccountInfo 所需字段
                    let base = &char_detail_response.data.detail.base;

                    log_debug!("  Role detail success: nickname={}", base.name);
                    // 下载并缓存头像（返回 base64）
                    let cached_avatar = self
                        .avatar_cache_service
                        .get_or_download_avatar_base64(&base.avatar_url)
                        .await
                        .unwrap_or_else(|_| base.avatar_url.clone());

                    let detail = RoleDisplayInfo {
                        role_id: role_id.clone(),
                        user_id: user_id.clone(),
                        server_id: server_id.clone(),
                        nickname: base.name.clone(),
                        level: base.level,
                        avatar_url: cached_avatar,
                    };
                    role_details.push(detail);
                }
                Err(e) => {
                    log_error!("Failed to get role detail for {}: {}", role_id, e);
                    // 跳过失败的角色
                }
            }
        }

        log_debug!("Step 6 complete: got {} role details", role_details.len());

        // 返回可用角色列表，等待前端选择
        Ok(AccountLoginResult {
            success: true,
            error_message: None,
            account: None,
            available_roles: Some(role_details),
            cred: Some(cred),
            token: Some(token),
            user_id: Some(user_id),
        })
    }

    /// 保存用户选择的角色
    pub async fn save_selected_roles(
        &self,
        cred: String,
        token: String,
        user_id: String,
        selected_roles: Vec<crate::models::role::RoleDisplayInfo>,
    ) -> Result<Vec<AccountInfo>, AppError> {
        log_debug!("save_selected_roles: START for user_id={}", user_id);

        // Step 1: 保存配置（在 MutexGuard 作用域内）
        {
            let mut config = self.config_service.lock().unwrap();

            // 保存或更新 account_token_{user_id}
            let token_key = format!("account_token_{}", user_id);

            // 先读取现有配置，保留 hytoken（如果存在）
            let existing_data: Option<serde_json::Value> = config.get(&token_key);
            let hytoken = existing_data
                .as_ref()
                .and_then(|d| d.get("hytoken"))
                .and_then(|h| h.as_str())
                .map(|s| s.to_string());

            log_debug!(
                "save_selected_roles: Existing hytoken exists: {}",
                hytoken.is_some()
            );

            // 构建 roles 列表
            let roles: Vec<serde_json::Value> = selected_roles
                .iter()
                .map(|role| {
                    json!({
                        "userId": role.user_id,
                        "serverId": role.server_id,
                        "roleId": role.role_id
                    })
                })
                .collect();

            // 构建完整的 token_data，包含 hytoken（如果存在）
            let mut token_data_obj = serde_json::Map::new();
            token_data_obj.insert("cred".to_string(), json!(cred));
            token_data_obj.insert("token".to_string(), json!(token));
            token_data_obj.insert("roles".to_string(), json!(roles));
            if let Some(hyt) = hytoken {
                token_data_obj.insert("hytoken".to_string(), json!(hyt));
                log_debug!("save_selected_roles: Preserved hytoken in config");
            }
            let token_data = serde_json::Value::Object(token_data_obj);

            config.set(token_key, token_data)?;
            log_debug!("save_selected_roles: Config saved successfully");

            // 更新 account_list
            let mut account_list: Vec<String> = config.get("account_list").unwrap_or_default();
            for role in &selected_roles {
                if !account_list.contains(&role.role_id) {
                    account_list.push(role.role_id.clone());
                }
            }
            config.set("account_list".to_string(), json!(account_list))?;
        } // MutexGuard 在这里释放

        // Step 2: 获取 base64 编码的头像（在 MutexGuard 释放后）
        let mut accounts = Vec::new();
        for role in &selected_roles {
            // 获取 base64 编码的头像
            let avatar_base64 = if !role.avatar_url.is_empty() {
                match self
                    .avatar_cache_service
                    .get_or_download_avatar_base64(&role.avatar_url)
                    .await
                {
                    Ok(base64_str) => base64_str,
                    Err(e) => {
                        tracing::warn!("Failed to get avatar for {}: {}", role.role_id, e);
                        String::new()
                    }
                }
            } else {
                String::new()
            };

            let account = AccountInfo {
                id: role.role_id.clone(),
                avatar: avatar_base64,
                nickname: role.nickname.clone(),
                level: role.level,
                server: role.server_id.clone(),
                status: "online".to_string(),
                sync_status: None,
                cred: Some(cred.clone()),
                token: Some(token.clone()),
                user_id: Some(role.user_id.clone()),
                server_id: Some(role.server_id.clone()),
            };
            accounts.push(account);
        }

        Ok(accounts)
    }

    /// Step 1: 手机号密码 → Hypergryph Token
    async fn get_hypergryph_token(&self, phone: &str, password: &str) -> Result<String, AppError> {
        let client = http_client::create_client();
        let payload = json!({
            "phone": phone,
            "password": password
        });

        let start_time = std::time::Instant::now();
        log_info!("=== HTTP REQUEST: 密码登录 ===");
        log_info!("Method: POST");
        log_info!("URL: https://as.hypergryph.com/user/auth/v1/token_by_phone_password");
        log_debug!(
            "Request Body: {{\"phone\": \"{}\", \"password\": \"***\"}}",
            phone
        );

        let response = client
            .post("https://as.hypergryph.com/user/auth/v1/token_by_phone_password")
            .json(&payload)
            .send()
            .await?;

        let elapsed = start_time.elapsed();
        let status = response.status();
        let resp_headers = response.headers().clone();

        let json: serde_json::Value = response.json().await?;

        log_info!("=== HTTP RESPONSE: 密码登录 ===");
        log_info!("Status: {}", status);
        log_info!("Time: {:?}", elapsed);
        log_debug!("Response Headers:");
        for (name, value) in resp_headers.iter() {
            if let Ok(value_str) = value.to_str() {
                log_debug!("  {}: {}", name, value_str);
            }
        }
        log_debug!(
            "Response Body: {}",
            serde_json::to_string(&json).unwrap_or_default()
        );

        if json.get("status").and_then(|v| v.as_i64()) == Some(0) {
            json.get("data")
                .and_then(|d| d.get("token"))
                .and_then(|t| t.as_str())
                .map(|s| s.to_string())
                .ok_or_else(|| AppError::AuthError {
                    message: "Token not found in response".to_string(),
                })
        } else {
            let msg = json
                .get("msg")
                .and_then(|v| v.as_str())
                .unwrap_or("Unknown error");
            Err(AppError::AuthError {
                message: format!("Hypergryph API error: {}", msg),
            })
        }
    }

    /// Step 2: Hypergryph Token → Skland Code
    async fn get_skland_code(&self, hy_token: &str) -> Result<String, AppError> {
        let client = http_client::create_client();
        let payload = json!({
            "token": hy_token,
            "appCode": "4ca99fa6b56cc2ba",
            "type": 0
        });

        let start_time = std::time::Instant::now();
        log_info!("=== HTTP REQUEST: OAuth授权 ===");
        log_info!("Method: POST");
        log_info!("URL: https://as.hypergryph.com/user/oauth2/v2/grant");
        log_debug!(
            "Request Body: {}",
            serde_json::to_string(&payload).unwrap_or_default()
        );

        let response = client
            .post("https://as.hypergryph.com/user/oauth2/v2/grant")
            .json(&payload)
            .send()
            .await?;

        let elapsed = start_time.elapsed();
        let status = response.status();
        let resp_headers = response.headers().clone();

        let json: serde_json::Value = response.json().await?;

        log_info!("=== HTTP RESPONSE: OAuth授权 ===");
        log_info!("Status: {}", status);
        log_info!("Time: {:?}", elapsed);
        log_debug!("Response Headers:");
        for (name, value) in resp_headers.iter() {
            if let Ok(value_str) = value.to_str() {
                log_debug!("  {}: {}", name, value_str);
            }
        }
        log_debug!(
            "Response Body: {}",
            serde_json::to_string(&json).unwrap_or_default()
        );

        if json.get("status").and_then(|v| v.as_i64()) == Some(0) {
            json.get("data")
                .and_then(|d| d.get("code"))
                .and_then(|c| c.as_str())
                .map(|s| s.to_string())
                .ok_or_else(|| AppError::AuthError {
                    message: "Code not found in response".to_string(),
                })
        } else {
            let msg = json
                .get("msg")
                .and_then(|v| v.as_str())
                .unwrap_or("Unknown error");
            Err(AppError::AuthError {
                message: format!("Hypergryph OAuth error: {}", msg),
            })
        }
    }

    /// Step 3: Skland Code → Cred + Token + UserId
    async fn get_skland_cred(&self, sk_code: &str) -> Result<(String, String, String), AppError> {
        let client = http_client::create_client();
        let payload = json!({
            "kind": 1,
            "code": sk_code
        });

        let start_time = std::time::Instant::now();
        log_info!("=== HTTP REQUEST: 获取Cred ===");
        log_info!("Method: POST");
        log_info!("URL: https://zonai.skland.com/api/v1/user/auth/generate_cred_by_code");
        log_debug!(
            "Request Body: {}",
            serde_json::to_string(&payload).unwrap_or_default()
        );

        let response = client
            .post("https://zonai.skland.com/api/v1/user/auth/generate_cred_by_code")
            .json(&payload)
            .send()
            .await?;

        let elapsed = start_time.elapsed();
        let status = response.status();
        let resp_headers = response.headers().clone();

        let json: serde_json::Value = response.json().await?;

        log_info!("=== HTTP RESPONSE: 获取Cred ===");
        log_info!("Status: {}", status);
        log_info!("Time: {:?}", elapsed);
        log_debug!("Response Headers:");
        for (name, value) in resp_headers.iter() {
            if let Ok(value_str) = value.to_str() {
                log_debug!("  {}: {}", name, value_str);
            }
        }
        log_debug!(
            "Response Body: {}",
            serde_json::to_string(&json).unwrap_or_default()
        );

        if json.get("code").and_then(|v| v.as_i64()) == Some(0) {
            let data = json.get("data").ok_or_else(|| AppError::AuthError {
                message: "Data not found in response".to_string(),
            })?;

            let cred =
                data.get("cred")
                    .and_then(|v| v.as_str())
                    .ok_or_else(|| AppError::AuthError {
                        message: "Cred not found".to_string(),
                    })?;

            let token =
                data.get("token")
                    .and_then(|v| v.as_str())
                    .ok_or_else(|| AppError::AuthError {
                        message: "Token not found".to_string(),
                    })?;

            let user_id =
                data.get("userId")
                    .and_then(|v| v.as_str())
                    .ok_or_else(|| AppError::AuthError {
                        message: "UserId not found".to_string(),
                    })?;

            Ok((cred.to_string(), token.to_string(), user_id.to_string()))
        } else {
            let msg = json
                .get("message")
                .and_then(|v| v.as_str())
                .unwrap_or("Unknown error");
            Err(AppError::AuthError {
                message: format!("Skland API error: {}", msg),
            })
        }
    }
}
