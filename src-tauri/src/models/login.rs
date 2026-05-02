use serde::{Deserialize, Serialize};

/// 登录请求模型
#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct LoginRequest {
    pub phone: String,
    pub password: String,
}
