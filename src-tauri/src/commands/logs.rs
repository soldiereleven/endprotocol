use crate::utils::logger::{get_logger, LogEntry};

/// 获取后端当前会话的所有日志
#[tauri::command]
pub fn get_backend_logs() -> Vec<LogEntry> {
    get_logger().get_recent_logs()
}
