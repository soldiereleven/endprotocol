use crate::utils::capture::{self, CapturePage, CaptureSessionMeta, CaptureStatus};

#[tauri::command]
pub async fn capture_start() -> Result<CaptureStatus, String> {
    capture::start()
}

#[tauri::command]
pub async fn capture_stop() -> Result<CaptureStatus, String> {
    capture::stop()
}

#[tauri::command]
pub async fn capture_status() -> Result<CaptureStatus, String> {
    Ok(capture::status())
}

#[tauri::command]
pub async fn capture_list_sessions() -> Result<Vec<CaptureSessionMeta>, String> {
    capture::list_sessions()
}

#[tauri::command]
pub async fn capture_read_entries(
    id: String,
    offset: u64,
    limit: u64,
) -> Result<CapturePage, String> {
    capture::read_entries(&id, offset, limit)
}

#[tauri::command]
pub async fn capture_delete_session(id: String) -> Result<(), String> {
    capture::delete_session(&id)
}

#[tauri::command]
pub async fn capture_dir() -> Result<String, String> {
    let dir = capture::capture_root()?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.to_string_lossy().to_string())
}
