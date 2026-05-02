use serde_json::json;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use crate::models::account::{AccountInfo, AccountLoginResult, AccountRefreshResult};
use crate::models::login::LoginRequest;
use crate::services::config_service::ConfigService;
use crate::utils::{http_client, AppError};

/// 账户服务
pub struct AccountService {
    config_service: Arc<Mutex<ConfigService>>,
    http_client: reqwest::Client,
}

impl AccountService {
    /// 创建新的账户服务实例
    pub fn new(config_service: Arc<Mutex<ConfigService>>) -> Self {
        let http_client = http_client::create_client();

        // 启动自动刷新定时器
        let service_clone = Arc::new(Mutex::new(Self {
            config_service: config_service.clone(),
            http_client: http_client.clone(),
        }));

        tokio::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_secs(300)); // 5分钟
            loop {
                interval.tick().await;
                // 这里可以调用刷新逻辑
                tracing::debug!("Auto-refresh triggered");
            }
        });

        Self {
            config_service,
            http_client,
        }
    }

    /// 获取所有账户
    pub async fn get_accounts(&self) -> Vec<AccountInfo> {
        let config = self.config_service.lock().unwrap();
        let account_list: Vec<String> = config.get("account_list").unwrap_or_default();

        let mut accounts = Vec::new();
        for user_id in account_list {
            if let Some(token_data) = config.get::<serde_json::Value>(&format!("account_token_{}", user_id)) {
                let account = AccountInfo {
                    id: user_id.clone(),
                    avatar: "".to_string(),
                    nickname: format!("User {}", &user_id[..8.min(user_id.len())]),
                    level: 0,
                    server: "Unknown".to_string(),
                    status: "offline".to_string(),
                    cred: token_data.get("cred").and_then(|v| v.as_str()).map(|s| s.to_string()),
                    token: token_data.get("token").and_then(|v| v.as_str()).map(|s| s.to_string()),
                };
                accounts.push(account);
            }
        }

        accounts
    }

    /// 添加账户（执行三步认证）
    pub async fn add_account(&self, login_request: LoginRequest) -> Result<AccountLoginResult, AppError> {
        // Step 1: 获取 Hypergryph Token
        let hy_token = match self.get_hypergryph_token(&login_request.phone, &login_request.password).await {
            Ok(token) => token,
            Err(e) => {
                return Ok(AccountLoginResult {
                    success: false,
                    error_message: Some(format!("Step 1 failed: {}", e)),
                    account: None,
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
                });
            }
        };

        // 保存账户信息到配置
        {
            let mut config = self.config_service.lock().unwrap();

            // 更新账户列表
            let mut account_list: Vec<String> = config.get("account_list").unwrap_or_default();
            if !account_list.contains(&user_id) {
                account_list.push(user_id.clone());
            }
            config.set("account_list".to_string(), json!(account_list))?;

            // 保存账户凭证
            let token_data = json!({
                "cred": cred,
                "token": token
            });
            config.set(format!("account_token_{}", user_id), token_data)?;
        }

        let account = AccountInfo {
            id: user_id.clone(),
            avatar: "".to_string(),
            nickname: format!("User {}", &user_id[..8.min(user_id.len())]),
            level: 0,
            server: "Unknown".to_string(),
            status: "online".to_string(),
            cred: Some(cred),
            token: Some(token),
        };

        Ok(AccountLoginResult {
            success: true,
            error_message: None,
            account: Some(account),
        })
    }

    /// 登出单个账户
    pub async fn logout_account(&self, account_id: String) -> bool {
        let mut config = self.config_service.lock().unwrap();

        // 从账户列表中移除
        let mut account_list: Vec<String> = config.get("account_list").unwrap_or_default();
        account_list.retain(|id| id != &account_id);
        let _ = config.set("account_list".to_string(), json!(account_list));

        // 删除账户凭证
        config.remove(&format!("account_token_{}", account_id))
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
        AccountRefreshResult {
            success: true,
            error_message: None,
            accounts,
            refresh_time: chrono::Utc::now().to_rfc3339(),
        }
    }

    /// Step 1: 手机号密码 → Hypergryph Token
    async fn get_hypergryph_token(&self, phone: &str, password: &str) -> Result<String, AppError> {
        let response = self.http_client
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
            let msg = json.get("msg").and_then(|v| v.as_str()).unwrap_or("Unknown error");
            Err(AppError::AuthError {
                message: format!("Hypergryph API error: {}", msg),
            })
        }
    }

    /// Step 2: Hypergryph Token → Skland Code
    async fn get_skland_code(&self, hy_token: &str) -> Result<String, AppError> {
        let response = self.http_client
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
            let msg = json.get("msg").and_then(|v| v.as_str()).unwrap_or("Unknown error");
            Err(AppError::AuthError {
                message: format!("Hypergryph OAuth error: {}", msg),
            })
        }
    }

    /// Step 3: Skland Code → Cred + Token + UserId
    async fn get_skland_cred(&self, sk_code: &str) -> Result<(String, String, String), AppError> {
        let response = self.http_client
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

            let cred = data.get("cred").and_then(|v| v.as_str()).ok_or_else(|| AppError::AuthError {
                message: "Cred not found".to_string(),
            })?;

            let token = data.get("token").and_then(|v| v.as_str()).ok_or_else(|| AppError::AuthError {
                message: "Token not found".to_string(),
            })?;

            let user_id = data.get("userId").and_then(|v| v.as_str()).ok_or_else(|| AppError::AuthError {
                message: "UserId not found".to_string(),
            })?;

            Ok((cred.to_string(), token.to_string(), user_id.to_string()))
        } else {
            let msg = json.get("message").and_then(|v| v.as_str()).unwrap_or("Unknown error");
            Err(AppError::AuthError {
                message: format!("Skland API error: {}", msg),
            })
        }
    }
}
