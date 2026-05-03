use serde::{Deserialize, Serialize};

/// 登录请求模型（密码登录）
#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct LoginRequest {
    pub phone: String,
    pub password: String,
}

/// 发送验证码请求模型
#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct SendCodeRequest {
    pub phone: String,
    #[serde(rename = "type")]
    pub code_type: i32,
}

/// 验证码登录请求模型
#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct CodeLoginRequest {
    pub phone: String,
    pub code: String,
}
