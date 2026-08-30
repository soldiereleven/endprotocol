use std::fs;
use std::io::Write;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::Emitter;

static DOWNLOAD_CANCELLED: AtomicBool = AtomicBool::new(false);

/// Write binary data to a file at the specified path.
#[tauri::command]
pub fn write_file(path: String, data: Vec<u8>) -> Result<(), String> {
    let file_path = PathBuf::from(&path);
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

/// Signal cancellation for the current download. The next progress check in
/// the download loop will break out.
#[tauri::command]
pub fn cancel_download() {
    DOWNLOAD_CANCELLED.store(true, Ordering::SeqCst);
}

/// Reset the cancellation flag (call before starting a new download).
#[tauri::command]
pub fn reset_download_cancel() {
    DOWNLOAD_CANCELLED.store(false, Ordering::SeqCst);
}

/// Download a file from a URL to a local path, emitting progress events.
/// Supports cancellation via the cancel_download command.
/// Returns the total bytes written, or an error if cancelled or failed.
#[tauri::command]
pub async fn download_file(
    app: tauri::AppHandle,
    url: String,
    path: String,
) -> Result<u64, String> {
    // Reset cancellation flag at start
    DOWNLOAD_CANCELLED.store(false, Ordering::SeqCst);

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
        // Check cancellation flag
        if DOWNLOAD_CANCELLED.load(Ordering::SeqCst) {
            // Clean up partial file
            drop(file);
            let _ = fs::remove_file(&file_path);
            return Err("Download cancelled".into());
        }

        let chunk = chunk.map_err(|e| format!("Download stream error: {}", e))?;
        file.write_all(&chunk)
            .map_err(|e| format!("Failed to write to file: {}", e))?;
        downloaded += chunk.len() as u64;

        // Emit progress every ~256KB
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

/// Run an installer file silently (NSIS /S flag), wait for it to finish, then restart the app.
#[tauri::command]
pub async fn run_installer(app: tauri::AppHandle, path: String) -> Result<(), String> {
    let status = std::process::Command::new(&path)
        .args(["/S"])
        .spawn()
        .map_err(|e| format!("Failed to run installer '{}': {}", path, e))?
        .wait()
        .map_err(|e| format!("Installer process error: {}", e))?;

    if !status.success() {
        return Err(format!("Installer exited with status: {}", status));
    }

    app.restart();
}
