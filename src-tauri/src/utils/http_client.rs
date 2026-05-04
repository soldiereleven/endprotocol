use reqwest::Client;
use std::time::Duration;

/// 创建配置好的 HTTP 客户端
pub fn create_client() -> Client {
    Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .expect("Failed to create HTTP client")
}
