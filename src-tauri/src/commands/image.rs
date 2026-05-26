use std::fs;

/// 读取本地图片文件，返回字节数组
#[tauri::command]
pub fn read_image_file(path: String) -> Result<Vec<u8>, String> {
    fs::read(&path).map_err(|e| format!("Failed to read image file '{}': {}", path, e))
}
