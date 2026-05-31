use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};

use crate::services::skland_service::SklandService;
use crate::utils::AppError;
use crate::{log_info, log_warn};

/// Wiki 物品详情缓存，应用整个生命周期只加载一次。
///
/// 初始化时从 catalog 中提取所有 itemId，逐个请求详情并合并为
/// `{"itemId1": {detail1}, "itemId2": {detail2}}` 的 JSON 对象。
pub struct CharWikiDetailService {
    skland_service: Arc<SklandService>,
    cache: Arc<Mutex<HashMap<String, serde_json::Value>>>,
    merged: Arc<Mutex<serde_json::Value>>,
    initialized: AtomicBool,
    preload_epoch: AtomicU64,
}

impl CharWikiDetailService {
    pub fn new(skland_service: Arc<SklandService>) -> Self {
        Self {
            skland_service,
            cache: Arc::new(Mutex::new(HashMap::new())),
            merged: Arc::new(Mutex::new(serde_json::Value::Object(serde_json::Map::new()))),
            initialized: AtomicBool::new(false),
            preload_epoch: AtomicU64::new(0),
        }
    }

    pub fn is_initialized(&self) -> bool {
        self.initialized.load(Ordering::Relaxed)
    }

    pub fn has_data(&self) -> bool {
        let guard = self.merged.lock().unwrap();
        guard.as_object().map_or(false, |m| !m.is_empty())
    }

    /// 从 catalog JSON 中提取所有 itemId 并逐个获取详情。
    ///
    /// catalog 结构：`data.catalog[].typeSub[].items[].itemId`
    ///
    /// 如果 `preload = true`，则一次性拉取全部；否则仅标记已初始化，后续按需加载。
    pub async fn initialize(
        &self,
        catalog: &serde_json::Value,
        cred: &str,
        token: &str,
        preload: bool,
    ) {
        if self.initialized.swap(true, Ordering::Relaxed) {
            return;
        }

        if !preload {
            log_info!("Lazy mode: wiki details will be fetched on demand");
            return;
        }

        log_info!("Initializing char wiki details (once)");
        self.fetch_all(catalog, cred, token).await;
    }

    /// 强制拉取全部 wiki 详情，可随时调用（不受 initialized 限制）。
    /// 成功时**覆盖**现有 merged 缓存。
    pub async fn preload_all(
        &self,
        catalog: &serde_json::Value,
        cred: &str,
        token: &str,
    ) {
        log_info!("Preloading all wiki details ...");
        self.fetch_all(catalog, cred, token).await;
    }

    /// 清空 wiki 详情缓存，重置 initialized 状态，取消正在进行的拉取。
    pub fn clear(&self) {
        self.preload_epoch.fetch_add(1, Ordering::Relaxed);
        self.cache.lock().unwrap().clear();
        *self.merged.lock().unwrap() = serde_json::Value::Object(serde_json::Map::new());
        self.initialized.store(false, Ordering::Relaxed);
        log_info!("Char wiki detail cache cleared");
    }

    /// 返回合并后的全部详情 JSON `{"itemId": {...}, ...}`（可能为空对象）
    pub fn get_processed(&self) -> Result<serde_json::Value, AppError> {
        let guard = self.merged.lock().unwrap();
        Ok(guard.clone())
    }

    /// 按需获取单个 item 的 wiki 详情。
    /// 如已缓存则直接返回，否则调用 API 获取并同时更新 cache 和 merged。
    async fn fetch_item(
        &self,
        item_id: &str,
        cred: &str,
        token: &str,
    ) -> Result<serde_json::Value, AppError> {
        let path = "/web/v1/wiki/item/info";
        let query = format!("id={}", item_id);
        let json = self
            .skland_service
            .call_skland_api("GET", path, Some(&query), None, cred, token)
            .await?;

        let mut cache = self.cache.lock().unwrap();
        cache.insert(item_id.to_string(), json.clone());
        drop(cache);

        let mut guard = self.merged.lock().unwrap();
        if let serde_json::Value::Object(ref mut map) = *guard {
            map.insert(item_id.to_string(), json.clone());
        }

        Ok(json)
    }

    /// 获取指定 itemId 的详情。如果未初始化或缓存未命中则按需拉取。
    pub async fn get_item(
        &self,
        item_id: &str,
        cred: &str,
        token: &str,
    ) -> Result<serde_json::Value, AppError> {
        {
            let cache = self.cache.lock().unwrap();
            if let Some(data) = cache.get(item_id) {
                return Ok(data.clone());
            }
        }

        self.fetch_item(item_id, cred, token).await
    }

    /// 遍历 itemIds 逐个拉取详情，写入 cache + merged。
    /// 每次 fetch 前和 fetch 后检查 preload_epoch 是否变化，
    /// 检测到变化（clear() 被调用）时立即中止并丢弃部分结果。
    async fn fetch_all(
        &self,
        catalog: &serde_json::Value,
        cred: &str,
        token: &str,
    ) {
        let item_ids = self.extract_item_ids(catalog);
        if item_ids.is_empty() {
            log_warn!("No items found in wiki catalog");
            return;
        }

        let epoch = self.preload_epoch.load(Ordering::Relaxed);
        let path = "/web/v1/wiki/item/info";
        let mut details = serde_json::Map::new();
        let mut failed = 0usize;

        for item_id in &item_ids {
            if self.preload_epoch.load(Ordering::Relaxed) != epoch {
                log_info!("Preload cancelled, stopping");
                return;
            }

            let query = format!("id={}", item_id);
            match self
                .skland_service
                .call_skland_api("GET", path, Some(&query), None, cred, token)
                .await
            {
                Ok(json) => {
                    if self.preload_epoch.load(Ordering::Relaxed) != epoch {
                        log_info!("Preload cancelled, discarding partial result");
                        return;
                    }
                    let mut cache = self.cache.lock().unwrap();
                    cache.insert(item_id.clone(), json.clone());
                    drop(cache);
                    details.insert(item_id.clone(), json);
                }
                Err(e) => {
                    log_warn!("Failed to fetch wiki detail for item {}: {}", item_id, e);
                    failed += 1;
                }
            }
        }

        *self.merged.lock().unwrap() = serde_json::Value::Object(details);

        log_info!(
            "Wiki details fetched: {} succeeded, {} failed",
            item_ids.len() - failed,
            failed
        );
    }

    /// 提取 itemId 列表（支持多 catalog × 多 typeSub）
    fn extract_item_ids(&self, catalog: &serde_json::Value) -> Vec<String> {
        let mut ids = Vec::new();

        if let Some(data) = catalog.get("data") {
            if let Some(catalogs) = data.get("catalog").and_then(|c| c.as_array()) {
                for entry in catalogs {
                    if let Some(subs) = entry.get("typeSub").and_then(|s| s.as_array()) {
                        for sub in subs {
                            if let Some(items) = sub.get("items").and_then(|i| i.as_array()) {
                                for item in items {
                                    if let Some(id) = item.get("itemId").and_then(|i| i.as_str()) {
                                        ids.push(id.to_string());
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        ids
    }
}
