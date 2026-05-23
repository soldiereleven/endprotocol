use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use crate::services::avatar_cache_service::{ImageCacheService, ImageType};
use crate::utils::AppError;
use crate::{log_debug};

/// 图片常驻内存管理服务
///
/// 允许卡片通过 cardId 将特定图片 pin 到内存中。
/// 引用计数跨卡片共享：同一 URL 被多张卡片 pin 时，
/// 只有所有卡片都 unpin 后才会释放内存。
pub struct ImagePinService {
    /// 磁盘缓存服务（用于下载图片）
    image_cache: Arc<ImageCacheService>,
    /// url → (base64_data, 总引用计数)
    pinned: Arc<Mutex<HashMap<String, (String, i32)>>>,
    /// card_id → 该卡片 pin 的 url 列表
    card_pins: Arc<Mutex<HashMap<String, Vec<String>>>>,
}

impl ImagePinService {
    pub fn new(image_cache: Arc<ImageCacheService>) -> Self {
        Self {
            image_cache,
            pinned: Arc::new(Mutex::new(HashMap::new())),
            card_pins: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// 卡片 pin 一组图片，返回 base64 列表
    pub async fn pin_images(
        &self,
        card_id: &str,
        urls: &[String],
    ) -> Result<Vec<String>, AppError> {
        let mut result = Vec::with_capacity(urls.len());

        // 先获取已有的 pin 记录
        let old_pinned = {
            let card_pins = self.card_pins.lock().unwrap();
            card_pins
                .get(card_id)
                .cloned()
                .unwrap_or_default()
        };

        let mut new_pinned = old_pinned.clone();

        for url in urls {
            // 已经 pin 过，直接取
            if old_pinned.contains(url) {
                let base64 = {
                    let pinned = self.pinned.lock().unwrap();
                    pinned.get(url).map(|(b, _)| b.clone())
                };
                if let Some(b) = base64 {
                    result.push(b);
                    continue;
                }
            }

            // 尚未 pin → 下载并存入内存
            if !new_pinned.contains(url) {
                // 用磁盘缓存下载/读取
                let base64 = self
                    .image_cache
                    .get_or_download_image_base64(url, ImageType::Avatar)
                    .await?;

                let mut pinned = self.pinned.lock().unwrap();
                let entry = pinned.entry(url.clone()).or_insert((base64.clone(), 0));
                entry.1 = entry.1.saturating_add(1);
                result.push(base64);
                new_pinned.push(url.clone());

                log_debug!(
                    "[ImagePin] Pinned '{}' for card '{}', refcount={}",
                    url,
                    card_id,
                    entry.1
                );
            }
        }

        // 更新卡片 pin 记录
        {
            let mut card_pins = self.card_pins.lock().unwrap();
            card_pins.insert(card_id.to_string(), new_pinned);
        }

        Ok(result)
    }

    /// 卡片 unpin 一组图片，引用计数归零时释放内存
    pub fn unpin_images(&self, card_id: &str, urls: &[String]) {
        let mut pinned = self.pinned.lock().unwrap();
        let mut card_pins = self.card_pins.lock().unwrap();

        let Some(record) = card_pins.get_mut(card_id) else {
            log_debug!("[ImagePin] No pinned records for card '{}'", card_id);
            return;
        };

        for url in urls {
            if let Some(pos) = record.iter().position(|u| u == url) {
                record.remove(pos);

                if let Some((_, refcount)) = pinned.get_mut(url) {
                    *refcount = refcount.saturating_sub(1);
                    if *refcount <= 0 {
                        pinned.remove(url);
                        log_debug!("[ImagePin] Freed '{}' (refcount=0)", url);
                    } else {
                        log_debug!(
                            "[ImagePin] Unpinned '{}' for card '{}', refcount={}",
                            url,
                            card_id,
                            *refcount
                        );
                    }
                }
            }
        }

        if record.is_empty() {
            card_pins.remove(card_id);
        }
    }
}
