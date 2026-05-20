use serde::{Deserialize, Serialize};

/// 精简版账户信息 (仅Account页面展示需要)
#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct AccountSummary {
    pub id: String,        // roleId
    pub avatar: String,
    pub nickname: String,
    pub level: i32,
    pub server: String,
    pub status: String,    // online/offline/loading
    pub sync_status: Option<String>, // SYNCING/FAILED/null
}

/// 完整账户信息模型 (包含认证信息)
#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct AccountInfo {
    pub id: String,        // roleId
    pub avatar: String,
    pub nickname: String,
    pub level: i32,
    pub server: String,
    pub status: String,    // online/offline/loading
    pub sync_status: Option<String>, // SYNCING/FAILED/null
    pub cred: Option<String>,
    pub token: Option<String>,
    pub user_id: Option<String>,
    pub server_id: Option<String>,
}

impl AccountInfo {
    /// 转换为精简版 (移除敏感信息)
    pub fn to_summary(&self) -> AccountSummary {
        AccountSummary {
            id: self.id.clone(),
            avatar: self.avatar.clone(),
            nickname: self.nickname.clone(),
            level: self.level,
            server: self.server.clone(),
            status: self.status.clone(),
            sync_status: self.sync_status.clone(),
        }
    }
}

/// 账户刷新结果
#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct AccountRefreshResult {
    pub success: bool,
    pub error_message: Option<String>,
    pub accounts: Vec<AccountInfo>,
    pub refresh_time: String,
}

/// 账户登录结果
#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct AccountLoginResult {
    pub success: bool,
    pub error_message: Option<String>,
    pub account: Option<AccountInfo>,
    pub available_roles: Option<Vec<crate::models::role::RoleDisplayInfo>>,
    pub cred: Option<String>,
    pub token: Option<String>,
    pub user_id: Option<String>,
}
