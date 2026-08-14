use std::path::PathBuf;

const APP_DIR: &str = "cn.msk-network.endprotocol";

/// 返回应用根数据目录（统一使用 Local，不同步到 Roaming）
/// Windows: %LOCALAPPDATA%\cn.msk-network.endprotocol
pub fn app_data_dir() -> Result<PathBuf, &'static str> {
    dirs::data_local_dir()
        .map(|d| d.join(APP_DIR))
        .ok_or("Failed to get local app data directory")
}

/// 图片缓存目录
pub fn image_cache_dir() -> Result<PathBuf, &'static str> {
    app_data_dir().map(|d| d.join("image_cache"))
}

/// Wiki 详情缓存目录
pub fn wiki_detail_cache_dir() -> Result<PathBuf, &'static str> {
    app_data_dir().map(|d| d.join("wiki_detail_cache"))
}

/// 日志目录
pub fn log_dir() -> Result<PathBuf, &'static str> {
    app_data_dir().map(|d| d.join("logs"))
}

/// 配置文件路径
pub fn config_file_path() -> Result<PathBuf, &'static str> {
    app_data_dir().map(|d| d.join("app_config.json"))
}

/// 抽卡记录文件路径（gacha_records 子目录，按 userId+serverId 区分）
pub fn gacha_records_file_path(user_id: &str, server_id: &str) -> Result<PathBuf, &'static str> {
    app_data_dir().map(|d| {
        d.join("gacha_records")
            .join(format!("gacha_records_{}_{}.json", user_id, server_id))
    })
}

/// 旧版抽卡记录文件路径（与 app_config.json 同级），仅用于存量数据兼容读取
pub fn gacha_records_file_path_legacy(user_id: &str, server_id: &str) -> Result<PathBuf, &'static str> {
    app_data_dir().map(|d| d.join(format!("gacha_records_{}_{}.json", user_id, server_id)))
}
