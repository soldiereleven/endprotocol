use std::fs;
use std::io::Write;
use std::path::PathBuf;
use tauri::Emitter;

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

/// Fetch a URL and return the response body as a string.
/// Uses reqwest (native HTTP client) to bypass CORS restrictions in the webview.
#[tauri::command]
pub async fn fetch_url(url: String) -> Result<String, String> {
    let client = reqwest::Client::new();
    let resp = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Failed to fetch '{}': {}", url, e))?;

    resp.text()
        .await
        .map_err(|e| format!("Failed to read response from '{}': {}", url, e))
}

/// Download a file from a URL to a local path, emitting progress events.
/// Uses reqwest to bypass CORS. Returns the total bytes written.
#[tauri::command]
pub async fn download_file(
    app: tauri::AppHandle,
    url: String,
    path: String,
) -> Result<u64, String> {
    let client = reqwest::Client::new();
    let resp = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Failed to start download from '{}': {}", url, e))?;

    let total = resp.content_length().unwrap_or(0);

    let file_path = PathBuf::from(&path);
    if let Some(parent) = file_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create directory '{}': {}", parent.display(), e))?;
    }

    let mut file = fs::File::create(&file_path)
        .map_err(|e| format!("Failed to create file '{}': {}", path, e))?;

    let mut stream = resp.bytes_stream();
    use futures_util::StreamExt;
    let mut downloaded: u64 = 0;
    let mut last_emit: u64 = 0;

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("Download stream error: {}", e))?;
        file.write_all(&chunk)
            .map_err(|e| format!("Failed to write to file: {}", e))?;
        downloaded += chunk.len() as u64;

        // Emit progress every ~256KB to avoid flooding
        if downloaded - last_emit >= 256 * 1024 || downloaded == total {
            let _ = app.emit(
                "download-progress",
                serde_json::json!({
                    "downloaded": downloaded,
                    "total": total,
                }),
            );
            last_emit = downloaded;
        }
    }

    file.flush().map_err(|e| format!("Failed to flush file: {}", e))?;
    Ok(downloaded)
}

/// Run an installer file using the system shell.
/// Bypasses opener permission restrictions.
#[tauri::command]
pub fn run_installer(path: String) -> Result<(), String> {
    std::process::Command::new("cmd")
        .args(["/C", "start", "", &path])
        .spawn()
        .map_err(|e| format!("Failed to run installer '{}': {}", path, e))?;
    Ok(())
}
