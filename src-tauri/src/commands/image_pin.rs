use std::sync::Arc;
use tauri::State;

use crate::services::image_pin_service::ImagePinService;

/// 卡片将一组图片加载到后端内存并常驻
///
/// 引用计数跨卡片共享。返回每个 URL 对应的 base64 data URL。
#[tauri::command]
pub async fn pin_images(
    state: State<'_, Arc<ImagePinService>>,
    card_id: String,
    urls: Vec<String>,
) -> Result<Vec<String>, String> {
    state
        .pin_images(&card_id, &urls)
        .await
        .map_err(|e| e.to_string())
}

/// 卡片释放一组图片，引用计数归零时后端释放内存
#[tauri::command]
pub async fn unpin_images(
    state: State<'_, Arc<ImagePinService>>,
    card_id: String,
    urls: Vec<String>,
) -> Result<(), String> {
    state.unpin_images(&card_id, &urls);
    Ok(())
}
