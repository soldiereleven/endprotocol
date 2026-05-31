use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

use crate::services::skland_service::SklandService;
use crate::utils::AppError;
use crate::{log_debug, log_error, log_info, log_warn};

/// Wiki 数据常驻内存，应用整个生命周期只加载一次。
pub struct CharWikiService {
    skland_service: Arc<SklandService>,
    cache: Arc<Mutex<HashMap<String, serde_json::Value>>>,
    initialized: AtomicBool,
    init_key: Mutex<String>,
}

impl CharWikiService {
    pub fn new(skland_service: Arc<SklandService>) -> Self {
        Self {
            skland_service,
            cache: Arc::new(Mutex::new(HashMap::new())),
            initialized: AtomicBool::new(false),
            init_key: Mutex::new("1_1".to_string()),
        }
    }

    pub fn cache(&self) -> &Arc<Mutex<HashMap<String, serde_json::Value>>> {
        &self.cache
    }

    pub fn is_initialized(&self) -> bool {
        self.initialized.load(Ordering::Relaxed)
    }

    /// 获取缓存的 catalog 数据，供 detail 服务初始化使用
    pub fn get_catalog(&self) -> Option<serde_json::Value> {
        let cache_key = self.init_key.lock().unwrap().clone();
        let cache = self.cache.lock().unwrap();
        cache.get(&cache_key).cloned()
    }

    /// 初始化 wiki 数据（应用启动时自动调用一次，后续不再刷新）
    pub async fn initialize(&self, cred: &str, token: &str) {
        if self.initialized.swap(true, Ordering::Relaxed) {
            return;
        }

        let cache_key = self.init_key.lock().unwrap().clone();
        log_info!("Initializing char wiki list (once)");

        let path = "/web/v1/wiki/item/catalog";
        let query = "typeMainId=1&typeSubId=1".to_string();

        match self
            .skland_service
            .call_skland_api("GET", path, Some(&query), None, cred, token)
            .await
        {
            Ok(json) => {
                let mut cache = self.cache.lock().unwrap();
                cache.insert(cache_key.clone(), json);
                log_info!("Char wiki list initialized, cached key: {}", cache_key);
            }
            Err(e) => {
                log_warn!("Failed to initialize char wiki list (will retry on first access): {}", e);
                self.initialized.store(false, Ordering::Relaxed);
            }
        }
    }

    /// 获取 wiki 物品分类列表（带缓存）
    pub async fn get_with_cache(
        &self,
        type_main_id: &str,
        type_sub_id: &str,
        cred: &str,
        token: &str,
    ) -> Result<Option<serde_json::Value>, AppError> {
        let cache_key = format!("{}_{}", type_main_id, type_sub_id);

        {
            let cache = self.cache.lock().unwrap();
            if let Some(data) = cache.get(&cache_key) {
                log_debug!("Cache hit for char_wiki_list: {}", cache_key);
                return Ok(Some(data.clone()));
            }
        }

        log_info!("Loading char wiki list from API: {}", cache_key);

        let path = "/web/v1/wiki/item/catalog";
        let query = format!("typeMainId={}&typeSubId={}", type_main_id, type_sub_id);

        match self
            .skland_service
            .call_skland_api("GET", path, Some(&query), None, cred, token)
            .await
        {
            Ok(json) => {
                let mut cache = self.cache.lock().unwrap();
                cache.insert(cache_key.clone(), json.clone());
                log_info!("Cached char wiki list: {}", cache_key);
                Ok(Some(json))
            }
            Err(e) => {
                log_error!("Failed to fetch char wiki list: {}", e);
                Err(e)
            }
        }
    }

    /// 获取处理后的 wiki 列表数据
    pub async fn get_processed(
        &self,
        type_main_id: &str,
        type_sub_id: &str,
        cred: &str,
        token: &str,
    ) -> Result<serde_json::Value, AppError> {
        log_debug!("get_char_wiki_list_processed: typeMainId={}, typeSubId={}", type_main_id, type_sub_id);

        match self
            .get_with_cache(type_main_id, type_sub_id, cred, token)
            .await?
        {
            Some(data) => Ok(data),
            None => Err(AppError::ConfigError {
                message: format!(
                    "Char wiki list not found for typeMainId={}, typeSubId={}",
                    type_main_id, type_sub_id
                ),
            }),
        }
    }
}
