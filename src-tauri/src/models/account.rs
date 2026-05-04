use serde::{Deserialize, Serialize};

/// 账户信息模型
#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct AccountInfo {
    pub id: String, // roleId
    pub avatar: String,
    pub nickname: String,
    pub level: i32,
    pub server: String,
    pub status: String, // online/offline/loading
    pub sync_status: Option<String>, // SYNCING/FAILED/null (null 表示正常)
    pub cred: Option<String>,
    pub token: Option<String>,
    pub user_id: Option<String>,
    pub server_id: Option<String>,
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
