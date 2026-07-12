use std::fs;
use std::path::PathBuf;
use crate::utils::paths;
use crate::{log_info, log_warn};

/// 读取本地图片文件，返回字节数组
#[tauri::command]
pub fn read_image_file(path: String) -> Result<Vec<u8>, String> {
    fs::read(&path).map_err(|e| format!("Failed to read image file '{}': {}", path, e))
}

/// 获取图片缓存目录路径
#[tauri::command]
pub fn get_image_cache_dir() -> Result<String, String> {
    let result = paths::image_cache_dir()
        .map(|p| p.to_string_lossy().to_string())
        .map_err(|e| e.to_string());
    log_info!("[image_cache] get_image_cache_dir: {:?}", result);
    result
}

/// 下载图片到本地缓存目录，返回本地文件路径
/// 如果已缓存则直接返回路径
#[tauri::command]
pub async fn download_image(
    url: String,
    cache_dir: String,
    sub_dir: String,
) -> Result<String, String> {
    log_info!("[download_image] url={}, cache_dir={}, sub_dir={}", url, cache_dir, sub_dir);

    if url.is_empty() {
        log_warn!("[download_image] Empty URL");
        return Err("Empty URL".to_string());
    }

    // 如果已经是本地路径，直接返回
    if url.starts_with("file://") || url.starts_with("http://asset.localhost") {
        log_info!("[download_image] Already local path: {}", url);
        return Ok(url);
    }

    // 从URL提取文件名
    let filename = extract_filename_from_url(&url)
        .ok_or_else(|| {
            let msg = format!("Invalid image URL: {}", url);
            log_warn!("[download_image] {}", msg);
            msg
        })?;
    log_info!("[download_image] Extracted filename: {}", filename);

    // 构建本地路径
    let type_dir = PathBuf::from(&cache_dir).join(&sub_dir);
    log_info!("[download_image] Creating dir: {}", type_dir.display());
    fs::create_dir_all(&type_dir).map_err(|e| {
        let msg = format!("Failed to create cache dir '{}': {}", type_dir.display(), e);
        log_warn!("[download_image] {}", msg);
        msg
    })?;

    let file_path = type_dir.join(&filename);

    // 已缓存则直接返回
    if file_path.exists() {
        log_info!("[download_image] Cache hit: {}", file_path.display());
        return Ok(file_path.to_string_lossy().to_string());
    }

    // 下载图片
    log_info!("[download_image] Downloading from: {}", url);
    let client = reqwest::Client::new();
    let response = client
        .get(&url)
        .header("Referer", "https://game.skland.com/")
        .send()
        .await
        .map_err(|e| {
            let msg = format!("Failed to download image '{}': {}", url, e);
            log_warn!("[download_image] {}", msg);
            msg
        })?;

    let status = response.status();
    log_info!("[download_image] Response status: {}", status);

    let bytes = response
        .bytes()
        .await
        .map_err(|e| {
            let msg = format!("Failed to read response body: {}", e);
            log_warn!("[download_image] {}", msg);
            msg
        })?;

    log_info!("[download_image] Downloaded {} bytes", bytes.len());

    // 保存到本地
    fs::write(&file_path, &bytes).map_err(|e| {
        let msg = format!("Failed to save image to '{}': {}", file_path.display(), e);
        log_warn!("[download_image] {}", msg);
        msg
    })?;

    log_info!("[download_image] Saved to: {}", file_path.display());
    Ok(file_path.to_string_lossy().to_string())
}

/// 从URL提取文件名
fn extract_filename_from_url(url: &str) -> Option<String> {
    // 移除查询参数
    let url_without_query = url.split('?').next()?;
    // 获取路径最后一部分作为文件名
    let filename = url_without_query.rsplit('/').next()?;
    if filename.is_empty() {
        return None;
    }
    Some(filename.to_string())
}
