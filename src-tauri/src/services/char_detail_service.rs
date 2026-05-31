use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use crate::models::char_detail::CharDetailData;
use crate::services::avatar_cache_service::{AvatarCacheService, ImageCacheService, ImageType};
use crate::services::skland_service::SklandService;
use crate::utils::AppError;
use crate::{log_debug, log_error, log_info, log_warn};

/// 用于预加载的角色信息
pub struct PreloadRoleInfo {
    pub role_id: String,
    pub server_id: String,
    pub user_id: String,
    pub cred: String,
    pub token: String,
}

pub struct CharDetailService {
    skland_service: Arc<SklandService>,
    avatar_cache_service: Arc<AvatarCacheService>,
    cache: Arc<Mutex<HashMap<String, CharDetailData>>>,
    processed_cache: Arc<Mutex<HashMap<String, serde_json::Value>>>,
}

impl CharDetailService {
    pub fn new(
        skland_service: Arc<SklandService>,
        avatar_cache_service: Arc<AvatarCacheService>,
    ) -> Self {
        Self {
            skland_service,
            avatar_cache_service,
            cache: Arc::new(Mutex::new(HashMap::new())),
            processed_cache: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn cache(&self) -> &Arc<Mutex<HashMap<String, CharDetailData>>> {
        &self.cache
    }

    pub fn processed_cache(&self) -> &Arc<Mutex<HashMap<String, serde_json::Value>>> {
        &self.processed_cache
    }

    /// 获取角色详情（带缓存）
    pub async fn get_with_cache(
        &self,
        role_id: &str,
        cred: &str,
        token: &str,
        server_id: &str,
        user_id: &str,
    ) -> Result<Option<CharDetailData>, AppError> {
        {
            let cache = self.cache.lock().unwrap();
            if let Some(detail) = cache.get(role_id) {
                log_debug!("Cache hit for role detail: {}", role_id);
                return Ok(Some(detail.clone()));
            }
        }

        log_info!("Loading char detail from API: {}", role_id);

        match self
            .skland_service
            .get_role_detail(cred, token, role_id, server_id, user_id)
            .await
        {
            Ok(response) => {
                let detail = response.data.detail;
                let mut cache = self.cache.lock().unwrap();
                cache.insert(role_id.to_string(), detail.clone());
                log_info!("Cached char detail for role: {}", role_id);
                Ok(Some(detail))
            }
            Err(e) => {
                log_error!("Failed to fetch char detail: {}", e);
                Err(e)
            }
        }
    }

    /// 预加载所有角色详情
    pub async fn preload_all(&self, role_infos: &[PreloadRoleInfo]) -> Result<(), AppError> {
        log_info!("Preloading all character details...");

        for info in role_infos {
            {
                let cache = self.cache.lock().unwrap();
                if cache.contains_key(&info.role_id) {
                    continue;
                }
            }

            match self
                .skland_service
                .get_role_detail(
                    &info.cred,
                    &info.token,
                    &info.role_id,
                    &info.server_id,
                    &info.user_id,
                )
                .await
            {
                Ok(response) => {
                    let detail = response.data.detail;
                    let mut cache = self.cache.lock().unwrap();
                    cache.insert(info.role_id.clone(), detail);
                    log_debug!("Preloaded char detail for: {}", info.role_id);
                }
                Err(e) => {
                    log_warn!("Failed to preload char detail for {}: {}", info.role_id, e);
                }
            }
        }

        log_info!(
            "Preload completed, cached {} roles",
            self.cache.lock().unwrap().len()
        );
        Ok(())
    }

    /// 保留指定角色的详情缓存，清除其他所有
    pub fn retain_only(&self, role_id: Option<String>) {
        let mut cache = self.cache.lock().unwrap();
        let mut processed = self.processed_cache.lock().unwrap();
        if let Some(ref id) = role_id {
            let retained = cache.remove(id);
            cache.clear();
            if let Some(detail) = retained {
                cache.insert(id.clone(), detail);
            }
            let retained_proc = processed.remove(id);
            processed.clear();
            if let Some(v) = retained_proc {
                processed.insert(id.clone(), v);
            }
        } else {
            cache.clear();
            processed.clear();
        }
        log_info!(
            "Cleared char detail cache (lazy load enabled), remaining: {}",
            cache.len()
        );
    }

    /// 移除指定角色的缓存
    pub fn remove(&self, role_id: &str) {
        {
            let mut cache = self.cache.lock().unwrap();
            cache.remove(role_id);
        }
        {
            let mut processed = self.processed_cache.lock().unwrap();
            processed.remove(role_id);
        }
        log_debug!("Released char detail cache for role: {}", role_id);
    }

    /// 获取处理后的角色详情（包含图片本地缓存替换）
    ///
    /// 处理后的结果会被缓存到 processed_cache，后续调用跳过图片处理和序列化。
    pub async fn get_processed(
        &self,
        role_id: &str,
        cred: &str,
        token: &str,
        server_id: &str,
        user_id: &str,
    ) -> Result<serde_json::Value, AppError> {
        log_debug!("get_char_detail_processed: role_id={}", role_id);

        {
            let processed = self.processed_cache.lock().unwrap();
            if let Some(cached) = processed.get(role_id) {
                log_debug!("Processed cache hit for role: {}", role_id);
                return Ok(cached.clone());
            }
        }

        let detail = match self
            .get_with_cache(role_id, cred, token, server_id, user_id)
            .await?
        {
            Some(d) => d,
            None => {
                log_warn!("No detail found for role_id={}", role_id);
                return Err(AppError::ConfigError {
                    message: format!("Character detail not found for role_id: {}", role_id),
                });
            }
        };

        let mut detail = detail.clone();
        self.process_images(&mut detail).await?;

        let json_value = serde_json::to_value(&detail).map_err(|e| {
            log_error!("Failed to serialize: {}", e);
            AppError::ConfigError {
                message: format!("Failed to serialize character detail: {}", e),
            }
        })?;

        let mut processed = self.processed_cache.lock().unwrap();
        processed.insert(role_id.to_string(), json_value.clone());

        Ok(json_value)
    }

    /// 处理角色详情中的所有图片URL，替换为本地缓存路径
    async fn process_images(&self, detail: &mut CharDetailData) -> Result<(), AppError> {
        log_debug!("Processing images for {} chars", detail.chars.len());

        let image_cache = ImageCacheService::new().map_err(|e| {
            log_error!("Failed to create image cache: {}", e);
            AppError::ConfigError {
                message: format!("Failed to create image cache: {}", e),
            }
        })?;

        for char in detail.chars.iter_mut() {
            if let Some(char_data) = &mut char.char_data {
                let char_name = char_data.name.as_deref().unwrap_or("unknown");

                if let Some(ref mut url) = char_data.avatar_sq_url {
                    if !url.is_empty() && !url.starts_with("http://asset.localhost") {
                        let url_clone = url.clone();
                        match image_cache
                            .get_or_download_image(&url_clone, ImageType::Avatar)
                            .await
                        {
                            Ok(p) => *url = p,
                            Err(e) => {
                                log_warn!("Failed to cache square avatar for {}: {}", char_name, e);
                            }
                        }
                    }
                }
                if let Some(ref mut url) = char_data.avatar_rt_url {
                    if !url.is_empty() && !url.starts_with("http://asset.localhost") {
                        let url_clone = url.clone();
                        match image_cache
                            .get_or_download_image(&url_clone, ImageType::Avatar)
                            .await
                        {
                            Ok(p) => *url = p,
                            Err(e) => {
                                log_warn!("Failed to cache rectangular avatar for {}: {}", char_name, e);
                            }
                        }
                    }
                }
                if let Some(ref mut url) = char_data.illustration_url {
                    if !url.is_empty() && !url.starts_with("http://asset.localhost") {
                        let url_clone = url.clone();
                        match image_cache
                            .get_or_download_image(&url_clone, ImageType::Illustration)
                            .await
                        {
                            Ok(p) => *url = p,
                            Err(e) => {
                                log_warn!("Failed to cache illustration for {}: {}", char_name, e);
                            }
                        }
                    }
                }

                if let Some(ref mut skills) = char_data.skills {
                    for skill in skills.iter_mut() {
                        if !skill.icon_url.is_empty()
                            && !skill.icon_url.starts_with("http://asset.localhost")
                        {
                            let url_clone = skill.icon_url.clone();
                            match image_cache
                                .get_or_download_image(&url_clone, ImageType::SkillIcon)
                                .await
                            {
                                Ok(p) => skill.icon_url = p,
                                Err(e) => {
                                    log_warn!("Failed to cache skill icon for {}: {}", char_name, e);
                                }
                            }
                        }
                    }
                }

                for talents in [&mut char_data.ability_talents, &mut char_data.combat_talents] {
                    if let Some(ref mut list) = talents {
                        for t in list.iter_mut() {
                            if !t.icon_url.is_empty()
                                && !t.icon_url.starts_with("http://asset.localhost")
                            {
                                let url_clone = t.icon_url.clone();
                                match image_cache
                                    .get_or_download_image(&url_clone, ImageType::SkillIcon)
                                    .await
                                {
                                    Ok(p) => t.icon_url = p,
                                    Err(e) => {
                                        log_warn!("Failed to cache talent icon for {}: {}", char_name, e);
                                    }
                                }
                            }
                            if !t.locked_icon_url.is_empty()
                                && !t.locked_icon_url.starts_with("http://asset.localhost")
                            {
                                let url_clone = t.locked_icon_url.clone();
                                match image_cache
                                    .get_or_download_image(&url_clone, ImageType::SkillIcon)
                                    .await
                                {
                                    Ok(p) => t.locked_icon_url = p,
                                    Err(e) => {
                                        log_warn!("Failed to cache locked talent icon for {}: {}", char_name, e);
                                    }
                                }
                            }
                        }
                    }
                }

                if let Some(ref mut list) = char_data.cultivation_talents {
                    for t in list.iter_mut() {
                        if !t.icon_url.is_empty()
                            && !t.icon_url.starts_with("http://asset.localhost")
                        {
                            let url_clone = t.icon_url.clone();
                            match image_cache
                                .get_or_download_image(&url_clone, ImageType::SkillIcon)
                                .await
                            {
                                Ok(p) => t.icon_url = p,
                                Err(e) => {
                                    log_warn!("Failed to cache cultivation talent icon for {}: {}", char_name, e);
                                }
                            }
                        }
                        if !t.locked_icon_url.is_empty()
                            && !t.locked_icon_url.starts_with("http://asset.localhost")
                        {
                            let url_clone = t.locked_icon_url.clone();
                            match image_cache
                                .get_or_download_image(&url_clone, ImageType::SkillIcon)
                                .await
                            {
                                Ok(p) => t.locked_icon_url = p,
                                Err(e) => {
                                    log_warn!("Failed to cache locked cultivation talent icon for {}: {}", char_name, e);
                                }
                            }
                        }
                    }
                }
            }
        }

        log_debug!("Completed image processing");
        Ok(())
    }
}
