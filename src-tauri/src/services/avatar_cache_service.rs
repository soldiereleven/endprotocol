use std::fs;
use std::path::PathBuf;

use crate::utils::AppError;
use crate::{log_debug, log_info};
use base64::{engine::general_purpose, Engine as _};

/// 图片缓存类型
#[derive(Debug, Clone, Copy)]
pub enum ImageType {
    Avatar,       // 角色头像
    SkillIcon,    // 技能图标
    WeaponIcon,   // 武器图标
    EquipIcon,    // 装备图标
    Illustration, // 角色立绘
}

impl ImageType {
    /// 获取缓存子目录名称
    pub fn dir_name(&self) -> &str {
        match self {
            ImageType::Avatar => "avatars",
            ImageType::SkillIcon => "skill_icons",
            ImageType::WeaponIcon => "weapon_icons",
            ImageType::EquipIcon => "equip_icons",
            ImageType::Illustration => "illustrations",
        }
    }
}

/// 图片缓存服务
pub struct ImageCacheService {
    cache_dir: PathBuf,
}

impl ImageCacheService {
    pub fn new() -> Result<Self, AppError> {
        let app_data_dir = dirs::data_local_dir().ok_or_else(|| AppError::ConfigError {
            message: "Failed to get local app data directory".to_string(),
        })?;

        let cache_dir = app_data_dir
            .join("cn.msk-network.endprotocol")
            .join("image_cache");

        // 确保主目录存在
        fs::create_dir_all(&cache_dir)?;

        // 创建所有子目录
        for image_type in [
            ImageType::Avatar,
            ImageType::SkillIcon,
            ImageType::WeaponIcon,
            ImageType::EquipIcon,
            ImageType::Illustration,
        ] {
            let type_dir = cache_dir.join(image_type.dir_name());
            fs::create_dir_all(&type_dir)?;
        }

        Ok(Self { cache_dir })
    }

    /// 从 URL 中提取文件名
    fn extract_filename_from_url(&self, url: &str) -> Option<String> {
        // 获取 URL 的最后一段作为文件名
        url.split('/').last().and_then(|s| {
            if s.is_empty() {
                None
            } else {
                Some(s.to_string())
            }
        })
    }

    /// 获取或下载图片（返回 base64 编码）
    pub async fn get_or_download_image_base64(
        &self,
        url: &str,
        image_type: ImageType,
    ) -> Result<String, AppError> {
        let filename =
            self.extract_filename_from_url(url)
                .ok_or_else(|| AppError::ConfigError {
                    message: "Invalid image URL".to_string(),
                })?;

        // 构建特定类型的缓存路径
        let type_dir = self.cache_dir.join(image_type.dir_name());
        let file_path = type_dir.join(&filename);

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

        // 下载图片
        let client = reqwest::Client::new();

        let start_time = std::time::Instant::now();
        log_info!("=== HTTP REQUEST: 下载图片 ({:?}) ===", image_type);
        log_info!("Method: GET");
        log_info!("URL: {}", url);

        let response = client.get(url).send().await?;

        let elapsed = start_time.elapsed();
        let status = response.status();
        let resp_headers = response.headers().clone();

        let bytes = response.bytes().await?;

        log_info!("=== HTTP RESPONSE: 下载图片 ({:?}) ===", image_type);
        log_info!("Status: {}", status);
        log_info!("Time: {:?}", elapsed);
        log_debug!("Response Headers:");
        for (name, value) in resp_headers.iter() {
            if let Ok(value_str) = value.to_str() {
                log_debug!("  {}: {}", name, value_str);
            }
        }
        log_debug!("Response Body: <binary data, {} bytes>", bytes.len());

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

    /// 向后兼容方法：获取或下载头像
    pub async fn get_or_download_avatar_base64(&self, url: &str) -> Result<String, AppError> {
        self.get_or_download_image_base64(url, ImageType::Avatar)
            .await
    }

    /// 清除所有缓存的图片
    pub fn clear_cache(&self) -> Result<(), AppError> {
        if self.cache_dir.exists() {
            fs::remove_dir_all(&self.cache_dir)?;
            fs::create_dir_all(&self.cache_dir)?;

            // 重新创建所有子目录
            for image_type in [
                ImageType::Avatar,
                ImageType::SkillIcon,
                ImageType::WeaponIcon,
                ImageType::EquipIcon,
                ImageType::Illustration,
            ] {
                let type_dir = self.cache_dir.join(image_type.dir_name());
                fs::create_dir_all(&type_dir)?;
            }
        }
        Ok(())
    }
}

// 为了向后兼容，保留旧的类型别名
pub type AvatarCacheService = ImageCacheService;
