use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use crate::services::avatar_cache_service::AvatarCacheService;
use crate::services::char_detail_service::CharDetailService;
use crate::services::char_wiki_detail_service::CharWikiDetailService;
use crate::services::char_wiki_service::CharWikiService;
use crate::services::data_query::{self, DataApi};
use crate::services::skland_service::SklandService;
use crate::utils::AppError;
use crate::{log_debug, log_error};

// 重新导出，保持向后兼容
pub use crate::services::char_detail_service::PreloadRoleInfo;

/// 网络数据服务 —— 统一数据查询入口，持有各子服务
pub struct NetworkService {
    skland_service: Arc<SklandService>,
    char_detail_service: CharDetailService,
    char_wiki_service: CharWikiService,
    char_wiki_detail_service: CharWikiDetailService,
    current_role_id: Arc<Mutex<Option<String>>>,
}

impl NetworkService {
    pub fn new(
        skland_service: Arc<SklandService>,
        avatar_cache_service: Arc<AvatarCacheService>,
    ) -> Self {
        Self {
            char_detail_service: CharDetailService::new(
                skland_service.clone(),
                avatar_cache_service,
            ),
            char_wiki_service: CharWikiService::new(skland_service.clone()),
            char_wiki_detail_service: CharWikiDetailService::new(skland_service.clone()),
            skland_service,
            current_role_id: Arc::new(Mutex::new(None)),
        }
    }

    pub fn skland_service(&self) -> &Arc<SklandService> {
        &self.skland_service
    }

    pub fn char_detail_service(&self) -> &CharDetailService {
        &self.char_detail_service
    }

    pub fn char_wiki_service(&self) -> &CharWikiService {
        &self.char_wiki_service
    }

    pub fn char_wiki_detail_service(&self) -> &CharWikiDetailService {
        &self.char_wiki_detail_service
    }

    pub fn get_current_role_id(&self) -> Option<String> {
        self.current_role_id.lock().unwrap().clone()
    }

    pub async fn set_current_role_id(&self, role_id: Option<String>, lazy_load_enabled: bool) {
        let mut current = self.current_role_id.lock().unwrap();
        let old_role_id = current.clone();
        *current = role_id.clone();

        if lazy_load_enabled {
            if let (Some(old_id), Some(new_id)) = (old_role_id, role_id) {
                if old_id != new_id {
                    self.char_detail_service.remove(&old_id);
                }
            }
        }
    }

    /// 保留指定角色的详情缓存，清除其他所有
    pub fn retain_only_char_detail(&self, role_id: Option<String>) {
        self.char_detail_service.retain_only(role_id);
    }

    /// 预加载所有角色详情
    pub async fn preload_all_char_details(
        &self,
        role_infos: &[PreloadRoleInfo],
    ) -> Result<(), AppError> {
        self.char_detail_service.preload_all(role_infos).await
    }

    /// 预加载全部 wiki 详情
    pub async fn preload_wiki_detail(
        &self,
        catalog: &serde_json::Value,
        cred: &str,
        token: &str,
    ) {
        self.char_wiki_detail_service
            .preload_all(catalog, cred, token)
            .await;
    }

    /// 清空 wiki 详情缓存
    pub fn clear_wiki_detail_cache(&self) {
        self.char_wiki_detail_service.clear();
    }

    /// 统一数据查询入口
    pub async fn query_role_data(
        &self,
        role_id: &str,
        api_name: &str,
        paths: &[String],
        cred: &str,
        token: &str,
        server_id: &str,
        user_id: &str,
    ) -> Result<HashMap<String, serde_json::Value>, AppError> {
        log_debug!(
            "query_role_data: role_id={}, api_name={}, paths_count={}",
            role_id,
            api_name,
            paths.len()
        );

        let api = api_name.parse::<DataApi>().map_err(|e| {
            log_error!("Invalid API name '{}': {}", api_name, e);
            AppError::ConfigError {
                message: format!("Invalid API name: {}", e),
            }
        })?;

        let data_value = match api {
            DataApi::CharDetail => {
                self.char_detail_service
                    .get_processed(role_id, cred, token, server_id, user_id)
                    .await?
            }
            DataApi::CharWikiList => {
                // wiki 列表不依赖 role_id，typeMainId/typeSubId 固定为 1
                self.char_wiki_service
                    .get_processed("1", "1", cred, token)
                    .await?
            }
            DataApi::CharWikiDetail => {
                if paths.is_empty() {
                    self.char_wiki_detail_service.get_processed()?
                } else {
                    let mut result = HashMap::new();
                    for item_id in paths {
                        match self
                            .char_wiki_detail_service
                            .get_item(item_id, cred, token)
                            .await
                        {
                            Ok(val) => {
                                result.insert(item_id.clone(), val);
                            }
                            Err(e) => {
                                log_error!("Failed to fetch wiki detail for item {}: {}", item_id, e);
                                result.insert(item_id.clone(), serde_json::Value::Null);
                            }
                        }
                    }
                    return Ok(result);
                }
            }
        };

        if paths.is_empty() {
            let mut result = HashMap::new();
            result.insert("__full__".to_string(), data_value);
            return Ok(result);
        }

        let mut result = HashMap::new();
        for path in paths {
            let segments = data_query::parse_path(path);
            let value = data_query::get_value_by_path(&data_value, &segments);
            result.insert(path.clone(), value.unwrap_or(serde_json::Value::Null));
        }

        Ok(result)
    }
}
