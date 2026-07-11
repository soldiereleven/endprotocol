use std::fs;

/// 读取本地图片文件，返回字节数组
#[tauri::command]
pub fn read_image_file(path: String) -> Result<Vec<u8>, String> {
    fs::read(&path).map_err(|e| format!("Failed to read image file '{}': {}", path, e))
}

/// 从 URL 下载图片，返回字节数组
#[tauri::command]
pub async fn download_image_url(url: String) -> Result<Vec<u8>, String> {
    let client = crate::utils::http_client::create_client();
    let response = client
        .get(&url)
        .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
        .header("Referer", "https://bbs.hycdn.cn/")
        .send()
        .await
        .map_err(|e| format!("Failed to download image: {}", e))?;
    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("Failed to read image bytes: {}", e))?;
    Ok(bytes.to_vec())
}
