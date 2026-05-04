use std::fs;
use std::path::PathBuf;

use base64::{engine::general_purpose, Engine as _};
use crate::utils::AppError;

/// 头像缓存服务
pub struct AvatarCacheService {
    cache_dir: PathBuf,
}

impl AvatarCacheService {
    pub fn new() -> Result<Self, AppError> {
        let app_data_dir = dirs::data_local_dir().ok_or_else(|| AppError::ConfigError {
            message: "Failed to get local app data directory".to_string(),
        })?;

        let cache_dir = app_data_dir.join("cn.msk-network.endprotocol").join("avatar_cache");

        // 确保目录存在
        fs::create_dir_all(&cache_dir)?;

        Ok(Self { cache_dir })
    }

    /// 从 URL 中提取文件名
    fn extract_filename_from_url(&self, url: &str) -> Option<String> {
        // 获取 URL 的最后一段作为文件名
        url.split('/')
            .last()
            .and_then(|s| if s.is_empty() { None } else { Some(s.to_string()) })
    }

    /// 获取缓存的头像（返回 base64 编码）
    pub async fn get_or_download_avatar_base64(&self, url: &str) -> Result<String, AppError> {
        let filename = self.extract_filename_from_url(url).ok_or_else(|| {
            AppError::ConfigError {
                message: "Invalid avatar URL".to_string(),
            }
        })?;

        let file_path = self.cache_dir.join(&filename);

        // 如果文件已存在，读取并转换为 base64
        if file_path.exists() {
            let bytes = fs::read(&file_path)?;
            let base64_str = general_purpose::STANDARD.encode(&bytes);
            
            // 检测图片格式
            let mime_type = if filename.ends_with(".png") {
                "image/png"
            } else if filename.ends_with(".jpg") || filename.ends_with(".jpeg") {
                "image/jpeg"
            } else {
                "image/png" // 默认
            };
            
            return Ok(format!("data:{};base64,{}", mime_type, base64_str));
        }

        // 下载头像
        let client = reqwest::Client::new();
        let response = client.get(url).send().await?;
        let bytes = response.bytes().await?;

        // 保存到本地
        fs::write(&file_path, &bytes)?;

        // 转换为 base64
        let base64_str = general_purpose::STANDARD.encode(&bytes);
        
        // 检测图片格式
        let mime_type = if filename.ends_with(".png") {
            "image/png"
        } else if filename.ends_with(".jpg") || filename.ends_with(".jpeg") {
            "image/jpeg"
        } else {
            "image/png" // 默认
        };
        
        Ok(format!("data:{};base64,{}", mime_type, base64_str))
    }

    /// 清除所有缓存的头像
    pub fn clear_cache(&self) -> Result<(), AppError> {
        if self.cache_dir.exists() {
            fs::remove_dir_all(&self.cache_dir)?;
            fs::create_dir_all(&self.cache_dir)?;
        }
        Ok(())
    }
}
