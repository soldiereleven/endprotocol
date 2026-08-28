use std::fs;
use std::path::PathBuf;

/// Write binary data to a file at the specified path.
/// Used for downloading preview update installers.
#[tauri::command]
pub fn write_file(path: String, data: Vec<u8>) -> Result<(), String> {
    let file_path = PathBuf::from(&path);

    // Ensure parent directory exists
    if let Some(parent) = file_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create directory '{}': {}", parent.display(), e))?;
    }

    fs::write(&file_path, data)
        .map_err(|e| format!("Failed to write file '{}': {}", path, e))
}

/// Get the system temporary directory path
#[tauri::command]
pub fn get_temp_dir() -> Result<String, String> {
    Ok(std::env::temp_dir()
        .to_string_lossy()
        .into_owned())
}
