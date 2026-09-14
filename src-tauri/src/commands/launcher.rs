use std::sync::Arc;
use tauri::Emitter;
use tokio::sync::Mutex;

use crate::models::game::*;
use crate::services::game_launcher_service::GameLauncherService;

/// 获取游戏安装状态
#[tauri::command]
pub async fn launcher_check_status(
    service: tauri::State<'_, Arc<Mutex<GameLauncherService>>>,
    channel: String,
    install_path: String,
) -> Result<GameStatus, String> {
    let ch = parse_channel(&channel)?;
    let svc = service.lock().await;
    svc.check_status(&ch, &install_path).await
}

/// 安装或更新游戏
#[tauri::command]
pub async fn launcher_install_or_update(
    app: tauri::AppHandle,
    service: tauri::State<'_, Arc<Mutex<GameLauncherService>>>,
    channel: String,
    install_path: String,
) -> Result<LauncherResult, String> {
    tracing::info!(
        "[cmd] launcher_install_or_update: channel={}, install_path={}",
        channel, install_path
    );
    let ch = parse_channel(&channel)?;
    let svc = service.lock().await;

    let app_handle = app.clone();
    let progress_cb = Arc::new(move |progress: DownloadProgress| {
        tracing::debug!(
            "[progress] stage={}, downloaded={}, total={}, file={:?}, {}/{}",
            progress.stage, progress.downloaded, progress.total,
            progress.current_file, progress.file_index, progress.file_count
        );
        let _ = app_handle.emit("launcher-progress", &progress);
    });

    match svc
        .install_or_update(&ch, &install_path, progress_cb)
        .await
    {
        Ok(version) => {
            tracing::info!("[cmd] Install OK: version={}", version);
            Ok(LauncherResult {
                success: true,
                message: format!("Update to {} completed", version),
                version: Some(version),
            })
        }
        Err(e) => {
            tracing::error!("[cmd] Install FAILED: {}", e);
            Ok(LauncherResult {
                success: false,
                message: e,
                version: None,
            })
        }
    }
}

/// 验证游戏文件完整性并修复
#[tauri::command]
pub async fn launcher_verify_and_repair(
    app: tauri::AppHandle,
    service: tauri::State<'_, Arc<Mutex<GameLauncherService>>>,
    channel: String,
    install_path: String,
    max_concurrent: Option<usize>,
    quick: Option<bool>,
) -> Result<LauncherResult, String> {
    let ch = parse_channel(&channel)?;
    let svc = service.lock().await;

    tracing::info!(
        "[launcher] verify_and_repair called: channel={:?}, max_concurrent={:?}, quick={:?}, install_path={}",
        ch, max_concurrent, quick, install_path
    );

    let app_handle = app.clone();
    let progress_cb = Arc::new(move |progress: DownloadProgress| {
        let _ = app_handle.emit("launcher-progress", &progress);
    });

    match svc
        .verify_and_repair(&ch, &install_path, progress_cb, max_concurrent.unwrap_or(4), quick.unwrap_or(false))
        .await
    {
        Ok(msg) => Ok(LauncherResult {
            success: true,
            message: msg,
            version: None,
        }),
        Err(e) => Ok(LauncherResult {
            success: false,
            message: e,
            version: None,
        }),
    }
}

/// 获取远程版本信息
#[tauri::command]
pub async fn launcher_get_remote_version(
    service: tauri::State<'_, Arc<Mutex<GameLauncherService>>>,
    channel: String,
) -> Result<RemotePackage, String> {
    let ch = parse_channel(&channel)?;
    let svc = service.lock().await;
    svc.get_latest_package(&ch).await
}

/// 预下载游戏更新资源
#[tauri::command]
pub async fn launcher_preload_download(
    app: tauri::AppHandle,
    service: tauri::State<'_, Arc<Mutex<GameLauncherService>>>,
    channel: String,
    install_path: String,
    max_concurrent: Option<usize>,
) -> Result<LauncherResult, String> {
    let ch = parse_channel(&channel)?;
    let svc = service.lock().await;

    let app_handle = app.clone();
    let progress_cb = Arc::new(move |progress: DownloadProgress| {
        let _ = app_handle.emit("launcher-progress", &progress);
    });

    match svc
        .preload_download(&ch, &install_path, progress_cb, max_concurrent.unwrap_or(8))
        .await
    {
        Ok(msg) => Ok(LauncherResult {
            success: true,
            message: msg,
            version: None,
        }),
        Err(e) => Ok(LauncherResult {
            success: false,
            message: e,
            version: None,
        }),
    }
}

/// 获取 payload 状态（上次安装/更新的版本信息）
#[tauri::command]
pub async fn launcher_get_payload_state(
    service: tauri::State<'_, Arc<Mutex<GameLauncherService>>>,
    channel: String,
) -> Result<Option<PayloadState>, String> {
    let ch = parse_channel(&channel)?;
    let svc = service.lock().await;
    Ok(svc.get_payload_state(&ch).await)
}

/// 取消正在进行的下载并清理缓存文件
#[tauri::command]
pub async fn launcher_cancel_download(install_path: Option<String>) -> Result<(), String> {
    crate::services::game_launcher_service::cancel_download();
    if let Some(path) = install_path {
        if !path.is_empty() {
            tracing::info!("[cmd] cancel_download: cleaning staging files for {}", path);
            crate::services::game_launcher_service::cleanup_staging_files(&path);
        }
    }
    Ok(())
}

/// 检查是否存在下载缓存（暂存目录或 .download 文件）
#[tauri::command]
pub async fn launcher_has_download_cache(install_path: String) -> Result<bool, String> {
    Ok(crate::services::game_launcher_service::has_download_cache(&install_path))
}

/// 重置下载取消标志
#[tauri::command]
pub async fn launcher_reset_download_cancel() -> Result<(), String> {
    crate::services::game_launcher_service::reset_download_cancel();
    Ok(())
}

/// 解密鹰角加密文件（用于读取 config.ini 等）
#[tauri::command]
pub async fn launcher_decrypt_file(file_path: String) -> Result<String, String> {
    crate::utils::hg_crypto::decrypt_file_to_string(&file_path)
}

/// 获取 Banner 列表
#[tauri::command]
pub async fn launcher_get_banners(
    service: tauri::State<'_, Arc<Mutex<GameLauncherService>>>,
    channel: String,
) -> Result<Vec<BannerItem>, String> {
    let ch = parse_channel(&channel)?;
    let svc = service.lock().await;
    svc.get_banners(&ch).await
}

/// 获取公告列表
#[tauri::command]
pub async fn launcher_get_announcements(
    service: tauri::State<'_, Arc<Mutex<GameLauncherService>>>,
    channel: String,
) -> Result<Vec<AnnouncementItem>, String> {
    let ch = parse_channel(&channel)?;
    let svc = service.lock().await;
    svc.get_announcements(&ch).await
}

/// 获取启动器公告内容（Banner + 公告合并）
#[tauri::command]
pub async fn launcher_get_notice_content(
    service: tauri::State<'_, Arc<Mutex<GameLauncherService>>>,
    channel: String,
) -> Result<LauncherNoticeContent, String> {
    let ch = parse_channel(&channel)?;
    let svc = service.lock().await;
    svc.get_notice_content(&ch).await
}

/// 获取启动器背景媒体 URL
#[tauri::command]
pub async fn launcher_get_background_image(
    service: tauri::State<'_, Arc<Mutex<GameLauncherService>>>,
    channel: String,
) -> Result<Option<BackgroundMedia>, String> {
    let ch = parse_channel(&channel)?;
    let svc = service.lock().await;
    svc.get_background_image(&ch).await
}

/// 启动游戏（UseShellExecute）
#[tauri::command]
pub async fn launcher_start_game(install_path: String, channel: String) -> Result<LauncherResult, String> {
    let ch = parse_channel(&channel)?;
    let exe_name = ch.executable_name();
    let exe_path = std::path::Path::new(&install_path).join(exe_name);

    if !exe_path.exists() {
        return Ok(LauncherResult {
            success: false,
            message: format!("{} not found in {}", exe_name, install_path),
            version: None,
        });
    }

    // Kill existing game processes first
    let _ = std::process::Command::new("taskkill")
        .args(["/F", "/IM", exe_name])
        .output();

    tokio::time::sleep(std::time::Duration::from_millis(500)).await;

    // Use ShellExecuteW (UseShellExecute = true equivalent)
    #[cfg(target_os = "windows")]
    {
        use std::ffi::OsStr;
        use std::os::windows::ffi::OsStrExt;

        let exe_wide: Vec<u16> = exe_path.as_os_str().encode_wide().chain(std::iter::once(0)).collect();
        let dir_wide: Vec<u16> = OsStr::new(&install_path).encode_wide().chain(std::iter::once(0)).collect();

        unsafe {
            let result = windows_sys::Win32::UI::Shell::ShellExecuteW(
                std::ptr::null_mut(),
                std::ptr::null(),
                exe_wide.as_ptr(),
                std::ptr::null(),
                dir_wide.as_ptr(),
                windows_sys::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL,
            );
            if result as isize > 32 {
                Ok(LauncherResult {
                    success: true,
                    message: format!("{} launched", exe_name),
                    version: None,
                })
            } else {
                Ok(LauncherResult {
                    success: false,
                    message: format!("ShellExecuteW failed with code {}", result as isize),
                    version: None,
                })
            }
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        match std::process::Command::new(&exe_path)
            .current_dir(&install_path)
            .spawn()
        {
            Ok(_) => Ok(LauncherResult {
                success: true,
                message: format!("{} launched", exe_name),
                version: None,
            }),
            Err(e) => Ok(LauncherResult {
                success: false,
                message: format!("Failed to launch {}: {}", exe_name, e),
                version: None,
            }),
        }
    }
}

/// 浏览文件夹
#[tauri::command]
pub fn launcher_browse_folder() -> Result<Option<String>, String> {
    let dialog = rfd::FileDialog::new()
        .set_title("Select Game Directory");

    Ok(dialog.pick_folder().map(|p| p.to_string_lossy().to_string()))
}

/// 磁盘空间信息
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct DiskSpace {
    pub total: u64,
    pub free: u64,
}

/// 获取指定路径所在磁盘的总空间和可用空间（字节）
#[tauri::command]
pub async fn launcher_get_disk_space(path: String) -> Result<DiskSpace, String> {
    let p = std::path::Path::new(&path);
    let root = if let Some(root) = p.ancestors().find(|a| a.exists()) {
        root.to_path_buf()
    } else {
        p.to_path_buf()
    };

    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        let root_str = root.to_str().unwrap_or("C:\\");
        let output = Command::new("powershell")
            .args([
                "-NoProfile",
                "-Command",
                &format!(
                    "$d = Get-PSDrive -Name (Get-Item '{}').PSDrive.Name; \"$($d.Used)|$($d.Free)\"",
                    root_str
                ),
            ])
            .output()
            .map_err(|e| format!("Failed to get disk space: {}", e))?;

        if output.status.success() {
            let s = String::from_utf8_lossy(&output.stdout).trim().to_string();
            let parts: Vec<&str> = s.split('|').collect();
            if parts.len() == 2 {
                let used = parts[0].parse::<u64>().map_err(|_| format!("Invalid used value: {}", parts[0]))?;
                let free = parts[1].parse::<u64>().map_err(|_| format!("Invalid free value: {}", parts[1]))?;
                Ok(DiskSpace { total: used + free, free })
            } else {
                Err(format!("Unexpected output format: {}", s))
            }
        } else {
            Err(String::from_utf8_lossy(&output.stderr).to_string())
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        Ok(DiskSpace { total: u64::MAX, free: u64::MAX })
    }
}

/// 扫描安装目录，检查已有文件的完整性
#[tauri::command]
pub async fn launcher_scan_install_dir(
    service: tauri::State<'_, Arc<Mutex<GameLauncherService>>>,
    channel: String,
    install_path: String,
) -> Result<FileScanResult, String> {
    let ch = parse_channel(&channel)?;
    let svc = service.lock().await;
    svc.scan_install_dir(&ch, &install_path).await
}

/// 根据目录下的文件特征自动识别游戏渠道
#[tauri::command]
pub async fn launcher_detect_channel(install_path: String) -> Result<Option<String>, String> {
    let path = std::path::Path::new(&install_path);

    // 检查基本游戏文件是否存在
    let has_exe = path.join("Endfield.exe").exists();
    let has_data = path.join("Endfield_Data").is_dir();
    let has_config = path.join("config.ini").exists();

    if !has_exe || !has_data || !has_config {
        // 游戏未安装或目录无效
        return Ok(None);
    }

    // 检查渠道特征文件
    let has_hgsdk = path.join("hgsdk.dll").exists();
    let has_pc_sdk = path.join("PCGameSDK.dll").exists();
    let has_gfsdk = path.join("gfsdk.dll").exists();
    let has_gl_foundation = path.join("glfoundation.dll").exists();
    let has_gl_extra = path.join("glextra.dll").exists();
    let has_play_pc_sdk = path.join("play_pc_sdk.dll").exists();
    let has_manifest_xml = path.join("manifest.xml").exists();
    let has_eld_db = path.join("eld_Endfield.db").exists();

    // 渠道识别逻辑：
    // Google Play: glextra.dll + play_pc_sdk.dll + manifest.xml
    // Global: gfsdk.dll + glfoundation.dll (无 PCGameSDK)
    // B服: hgsdk.dll + PCGameSDK.dll + eld_Endfield.db
    // 官服: hgsdk.dll + eld_Endfield.db (无 PCGameSDK)

    if has_gl_extra && has_play_pc_sdk && has_manifest_xml {
        return Ok(Some("google_play".to_string()));
    }

    if has_gfsdk && has_gl_foundation {
        return Ok(Some("global".to_string()));
    }

    if has_hgsdk && has_pc_sdk && has_eld_db {
        return Ok(Some("bilibili".to_string()));
    }

    if has_hgsdk && has_eld_db {
        return Ok(Some("official".to_string()));
    }

    // 无法识别渠道
    Ok(None)
}

/// 检查可执行文件是否存在
#[tauri::command]
pub fn launcher_check_executable(install_path: String, channel: String) -> Result<bool, String> {
    let ch = parse_channel(&channel)?;
    let exe_name = ch.executable_name();
    let exe_path = std::path::Path::new(&install_path).join(exe_name);
    Ok(exe_path.exists())
}

#[tauri::command]
pub fn launcher_check_game_running(channel: String) -> Result<bool, String> {
    let ch = parse_channel(&channel)?;
    let process_name = ch.process_name();
    let output = std::process::Command::new("tasklist")
        .args(["/FI", &format!("IMAGENAME eq {}", process_name), "/NH"])
        .output()
        .map_err(|e| e.to_string())?;
    let stdout = String::from_utf8_lossy(&output.stdout);
    Ok(stdout.contains(process_name))
}

#[tauri::command]
pub async fn launcher_kill_game(channel: String) -> Result<bool, String> {
    let ch = parse_channel(&channel)?;
    let process_name = ch.process_name();
    let output = std::process::Command::new("taskkill")
        .args(["/F", "/IM", process_name])
        .output()
        .map_err(|e| e.to_string())?;
    tokio::time::sleep(std::time::Duration::from_millis(500)).await;
    Ok(output.status.success())
}

fn parse_channel(s: &str) -> Result<GameChannel, String> {
    match s.to_lowercase().as_str() {
        "official" | "cn" => Ok(GameChannel::Official),
        "bilibili" | "b服" | "bili" => Ok(GameChannel::Bilibili),
        "global" | "国际服" => Ok(GameChannel::Global),
        "google_play" | "play" | "gp" => Ok(GameChannel::GooglePlay),
        _ => Err(format!("Unknown channel: '{}'. Use: official, bilibili, global, google_play", s)),
    }
}
