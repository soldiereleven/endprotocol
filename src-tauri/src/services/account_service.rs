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

    /// 获取所有账户
    pub async fn get_accounts(&self) -> Vec<AccountInfo> {
        // 先收集所有需要获取详情的角色信息
        let role_infos = {
            let config = self.config_service.lock().unwrap();
            let all_config = config.get_all();

            println!(
                "[DEBUG] get_accounts: all_config keys = {:?}",
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

            println!(
                "[DEBUG] get_accounts: found {} roles to fetch",
                role_infos.len()
            );
            role_infos
            // config 在这里被自动 drop
        };

        // 获取每个角色的详细信息
        let mut accounts = Vec::new();
        for (role_id, server_id, user_id, cred, token) in role_infos {
            if let (Some(cred), Some(token)) = (cred, token) {
                match self
                    .skland_service
                    .get_role_detail(&cred, &token, &role_id, &server_id, &user_id)
                    .await
                {
                    Ok(detail) => {
                        // 下载并缓存头像（返回 base64）
                        let cached_avatar = self
                            .avatar_cache_service
                            .get_or_download_avatar_base64(&detail.avatar_url)
                            .await
                            .unwrap_or_else(|_| detail.avatar_url.clone());

                        let account = AccountInfo {
                            id: role_id,
                            avatar: cached_avatar,
                            nickname: detail.nickname,
                            level: detail.level,
                            server: detail.server_id,
                            status: "online".to_string(),
                            cred: Some(cred),
                            token: Some(token),
                            user_id: Some(user_id),
                            server_id: Some(server_id),
                        };
                        accounts.push(account);
                    }
                    Err(e) => {
                        tracing::warn!("Failed to get role detail for {}: {}", role_id, e);
                        // 创建占位符账户
                        let nickname = format!("Role {}", &role_id[..8.min(role_id.len())]);
                        let account = AccountInfo {
                            id: role_id.clone(),
                            avatar: String::new(),
                            nickname,
                            level: 0,
                            server: server_id.clone(),
                            status: "offline".to_string(),
                            cred: Some(cred),
                            token: Some(token),
                            user_id: Some(user_id),
                            server_id: Some(server_id),
                        };
                        accounts.push(account);
                    }
                }
            }
        }

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

        // Step 4: 获取玩家绑定列表
        let bindings = match self.skland_service.get_player_binding(&cred, &token).await {
            Ok(bindings) => bindings,
            Err(e) => {
                println!("[ERROR] Step 4 failed: {}", e);
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
            println!("[ERROR] No Endfield roles found!");
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
                Ok(detail) => {
                    // 下载并缓存头像（返回 base64）
                    let cached_avatar = self
                        .avatar_cache_service
                        .get_or_download_avatar_base64(&detail.avatar_url)
                        .await
                        .unwrap_or_else(|_| detail.avatar_url.clone());

                    let mut detail_with_cached_avatar = detail;
                    detail_with_cached_avatar.avatar_url = cached_avatar;
                    role_details.push(detail_with_cached_avatar);
                }
                Err(e) => {
                    println!("[ERROR] Failed to get role detail for {}: {}", role_id, e);
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

    /// 刷新账户数据
    pub async fn refresh_accounts(&self) -> AccountRefreshResult {
        let accounts = self.get_accounts().await;

        // 为每个账户获取最新的角色详情
        let mut refreshed_accounts = Vec::new();
        for account in accounts {
            if let (Some(cred), Some(token), Some(user_id), Some(server_id)) = (
                &account.cred,
                &account.token,
                &account.user_id,
                &account.server_id,
            ) {
                match self
                    .skland_service
                    .get_role_detail(
                        cred,
                        token,
                        &account.id, // role_id
                        server_id,
                        user_id,
                    )
                    .await
                {
                    Ok(detail) => {
                        // 下载并缓存头像（返回 base64）
                        let cached_avatar = self
                            .avatar_cache_service
                            .get_or_download_avatar_base64(&detail.avatar_url)
                            .await
                            .unwrap_or_else(|_| detail.avatar_url.clone());

                        let refreshed_account = AccountInfo {
                            id: account.id,
                            avatar: cached_avatar,
                            nickname: detail.nickname,
                            level: detail.level,
                            server: detail.server_id,
                            status: "online".to_string(),
                            cred: account.cred,
                            token: account.token,
                            user_id: account.user_id,
                            server_id: account.server_id,
                        };
                        refreshed_accounts.push(refreshed_account);
                    }
                    Err(e) => {
                        tracing::warn!("Failed to refresh account {}: {}", account.id, e);
                        // 保留旧数据，但标记为离线
                        let mut offline_account = account;
                        offline_account.status = "offline".to_string();
                        refreshed_accounts.push(offline_account);
                    }
                }
            } else {
                // 缺少必要信息，保持原样
                refreshed_accounts.push(account);
            }
        }

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
        let response = client
            .post("https://as.hypergryph.com/general/v1/send_phone_code")
            .json(&json!({
                "phone": request.phone,
                "type": request.code_type
            }))
            .send()
            .await?;

        let json: serde_json::Value = response.json().await?;

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
        let response = client
            .post("https://as.hypergryph.com/user/auth/v2/token_by_phone_code")
            .json(&json!({
                "phone": phone,
                "code": code
            }))
            .send()
            .await?;

        let json: serde_json::Value = response.json().await?;

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
            println!("[ERROR] No Endfield roles found!");
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
        println!(
            "[DEBUG] Step 6: Getting role details for {} roles...",
            endfield_roles.len()
        );
        let mut role_details = Vec::new();
        for (uid, server_id, role_id) in &endfield_roles {
            println!(
                "[DEBUG]   Getting detail for role_id={}, server_id={}",
                role_id, server_id
            );
            match self
                .skland_service
                .get_role_detail(&cred, &token, role_id, server_id, &user_id)
                .await
            {
                Ok(detail) => {
                    println!(
                        "[DEBUG]   Role detail success: nickname={}",
                        detail.nickname
                    );
                    // 下载并缓存头像（返回 base64）
                    let cached_avatar = self
                        .avatar_cache_service
                        .get_or_download_avatar_base64(&detail.avatar_url)
                        .await
                        .unwrap_or_else(|_| detail.avatar_url.clone());

                    let mut detail_with_cached_avatar = detail;
                    detail_with_cached_avatar.avatar_url = cached_avatar;
                    role_details.push(detail_with_cached_avatar);
                }
                Err(e) => {
                    println!("[ERROR] Failed to get role detail for {}: {}", role_id, e);
                    // 跳过失败的角色
                }
            }
        }

        println!(
            "[DEBUG] Step 6 complete: got {} role details",
            role_details.len()
        );

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
        // Step 1: 保存配置（在 MutexGuard 作用域内）
        {
            let mut config = self.config_service.lock().unwrap();

            // 保存或更新 account_token_{user_id}
            let token_key = format!("account_token_{}", user_id);

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

            let token_data = json!({
                "cred": cred,
                "token": token,
                "roles": roles
            });
            config.set(token_key, token_data)?;

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
        let response = client
            .post("https://as.hypergryph.com/user/auth/v1/token_by_phone_password")
            .json(&json!({
                "phone": phone,
                "password": password
            }))
            .send()
            .await?;

        let json: serde_json::Value = response.json().await?;

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
        let response = client
            .post("https://as.hypergryph.com/user/oauth2/v2/grant")
            .json(&json!({
                "token": hy_token,
                "appCode": "4ca99fa6b56cc2ba",
                "type": 0
            }))
            .send()
            .await?;

        let json: serde_json::Value = response.json().await?;

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
        let response = client
            .post("https://zonai.skland.com/api/v1/user/auth/generate_cred_by_code")
            .json(&json!({
                "kind": 1,
                "code": sk_code
            }))
            .send()
            .await?;

        let json: serde_json::Value = response.json().await?;

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
