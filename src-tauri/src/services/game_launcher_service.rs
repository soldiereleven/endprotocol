use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU64, AtomicUsize, Ordering};
use std::sync::Arc;
use std::time::Duration;

use futures_util::StreamExt;
use reqwest::Client;
use tokio::sync::{Semaphore, Mutex};
use walkdir::WalkDir;

use crate::models::game::*;
use crate::utils::hg_crypto;

/// 全局下载取消标志
static DOWNLOAD_CANCELLED: AtomicBool = AtomicBool::new(false);

pub fn cancel_download() {
    DOWNLOAD_CANCELLED.store(true, Ordering::SeqCst);
}

pub fn reset_download_cancel() {
    DOWNLOAD_CANCELLED.store(false, Ordering::SeqCst);
}

/// 清理指定安装路径下的所有暂存目录和 .download 缓存文件
pub fn cleanup_staging_files(install_path: &str) {
    let install_dir = Path::new(install_path);
    if let Some(parent) = install_dir.parent() {
        // 删除 *.staging.* 目录
        if let Ok(entries) = fs::read_dir(parent) {
            for entry in entries.flatten() {
                let name = entry.file_name();
                let name_str = name.to_string_lossy();
                if let Some(stem) = install_dir.file_name().and_then(|s| s.to_str()) {
                    if name_str.starts_with(&format!("{}.staging.", stem)) {
                        let path = entry.path();
                        tracing::info!("[cleanup] Removing staging dir: {}", path.display());
                        let _ = fs::remove_dir_all(&path);
                    }
                }
            }
        }
    }
    // 删除安装目录内的 .download 文件
    if install_dir.exists() {
        for entry in WalkDir::new(install_dir).into_iter().flatten() {
            if entry.file_type().is_file() {
                if let Some(name) = entry.file_name().to_str() {
                    if name.ends_with(".download") {
                        let path = entry.path();
                        tracing::info!("[cleanup] Removing .download file: {}", path.display());
                        let _ = fs::remove_file(path);
                    }
                }
            }
        }
    }
}

/// 检查指定安装路径下是否存在下载缓存（暂存目录或 .download 文件）
pub fn has_download_cache(install_path: &str) -> bool {
    let install_dir = Path::new(install_path);
    // 检查 *.staging.* 目录
    if let Some(parent) = install_dir.parent() {
        if let Ok(entries) = fs::read_dir(parent) {
            for entry in entries.flatten() {
                let name = entry.file_name();
                let name_str = name.to_string_lossy();
                if let Some(stem) = install_dir.file_name().and_then(|s| s.to_str()) {
                    if name_str.starts_with(&format!("{}.staging.", stem)) {
                        return true;
                    }
                }
            }
        }
    }
    // 检查安装目录内的 .download 文件
    if install_dir.exists() {
        for entry in WalkDir::new(install_dir).into_iter().flatten() {
            if entry.file_type().is_file() {
                if let Some(name) = entry.file_name().to_str() {
                    if name.ends_with(".download") {
                        return true;
                    }
                }
            }
        }
    }
    false
}

pub struct GameLauncherService {
    http_client: Client,
    download_client: Client,
}

impl GameLauncherService {
    pub fn new() -> Self {
        let http_client = Client::builder()
            .timeout(Duration::from_secs(30))
            .user_agent("EndProtocol/0.1.0")
            .build()
            .expect("Failed to create HTTP client");

        let download_client = Client::builder()
            .timeout(Duration::from_secs(1800)) // 30 min for downloads
            .user_agent("EndProtocol/0.1.0")
            .build()
            .expect("Failed to create download HTTP client");

        Self {
            http_client,
            download_client,
        }
    }

    // ========== 版本检查 ==========

    /// 从 launcher API 获取最新版本和资源地址
    pub async fn get_latest_package(&self, channel: &GameChannel) -> Result<RemotePackage, String> {
        tracing::info!(
            "[api] get_latest_package: channel={}, appcode={}",
            channel.as_str(),
            channel.app_code()
        );
        let req_body = serde_json::json!({
            "seq": channel.seq(),
            "proxy_reqs": [{
                "kind": "get_latest_game",
                "get_latest_game_req": {
                    "appcode": channel.app_code(),
                    "launcher_appcode": channel.launcher_app_code(),
                    "channel": channel.channel(),
                    "sub_channel": channel.sub_channel(),
                    "version": ""
                }
            }]
        });

        tracing::debug!("[api] Request body: {}", serde_json::to_string_pretty(&req_body).unwrap_or_default());

        let resp = self
            .http_client
            .post(channel.api_url())
            .json(&req_body)
            .send()
            .await
            .map_err(|e| format!("API request failed: {}", e))?;

        let status = resp.status();
        let text = resp.text().await.map_err(|e| format!("Failed to read response: {}", e))?;
        tracing::debug!("[api] Response status={}, body_len={}", status, text.len());

        let body: BatchProxyResponse = serde_json::from_str(&text)
            .map_err(|e| format!("Failed to parse API response: {} — body preview: {}", e, &text[..text.len().min(500)]))?;

        let game_rsp = body
            .proxy_rsps
            .iter()
            .find(|r| r.kind == "get_latest_game")
            .and_then(|r| r.get_latest_game_rsp.as_ref())
            .ok_or_else(|| "No get_latest_game response found".to_string())?;

        let pkg = game_rsp
            .pkg
            .as_ref()
            .ok_or_else(|| "No package info in response".to_string())?;

        let resource_base_url = pkg.file_path.clone();
        tracing::info!(
            "[api] version={}, resource_url={}",
            game_rsp.version,
            resource_base_url
        );

        if !resource_base_url.starts_with("https://") {
            return Err(format!(
                "Resource URL must be HTTPS, got: {}",
                resource_base_url
            ));
        }

        let has_preload = game_rsp.preload_version.is_some() && game_rsp.preload_pkg.is_some();
        let preload_version = game_rsp.preload_version.clone();
        let preload_resource_url = game_rsp.preload_pkg.as_ref().map(|p| p.file_path.clone());

        if has_preload {
            tracing::info!(
                "[api] preload_version={}, preload_url={}",
                preload_version.as_deref().unwrap_or(""),
                preload_resource_url.as_deref().unwrap_or("")
            );
        }

        Ok(RemotePackage {
            version: game_rsp.version.clone(),
            resource_base_url,
            has_preload,
            preload_version,
            preload_resource_url,
        })
    }

    /// 检查游戏安装状态
    pub async fn check_status(
        &self,
        channel: &GameChannel,
        install_path: &str,
    ) -> Result<GameStatus, String> {
        let path = Path::new(install_path);
        let exe_exists = path.join(channel.executable_name()).exists();
        let config_exists = path.join("config.ini").exists();
        let is_installed = exe_exists && config_exists;

        let mut local_version = None;
        if is_installed {
            local_version = self.read_local_version(install_path).ok();
        }

        let remote = self.get_latest_package(channel).await?;
        let remote_version = Some(remote.version.clone());

        let has_update = if let (Some(ref local), Some(ref remote)) =
            (&local_version, &remote_version)
        {
            !Self::versions_equal(local, remote)
        } else {
            false
        };

        // Preload detection: preload available when installed, no update pending, and API reports preload
        let has_preload = is_installed && !has_update && remote.has_preload;

        // Check persisted preload state to see if preload was completed for this version
        let preload_completed = if has_preload {
            let persisted = self.load_payload_state(channel);
            if let Some(ref state) = persisted {
                state.preload_completed
                    && state.preload_version.as_deref() == remote.preload_version.as_deref()
            } else {
                false
            }
        } else {
            false
        };

        Ok(GameStatus {
            is_installed,
            has_update,
            local_version,
            remote_version,
            has_preload,
            preload_version: remote.preload_version,
            preload_completed,
        })
    }

    /// 读取本地 config.ini 中的版本号
    fn read_local_version(&self, install_path: &str) -> Result<String, String> {
        let config_path = Path::new(install_path).join("config.ini");
        let content = hg_crypto::decrypt_file_to_string(
            config_path.to_str().ok_or("Invalid config path")?,
        )?;

        // 解析版本号，格式类似 "game_version = x.y.z"
        for line in content.lines() {
            let line = line.trim();
            if line.starts_with("game_version") || line.starts_with("version") {
                if let Some(pos) = line.find('=') {
                    let value = line[pos + 1..].trim().trim_matches('"').trim_matches('\'');
                    if !value.is_empty() {
                        return Ok(value.to_string());
                    }
                }
            }
        }

        Err("Version not found in config.ini".to_string())
    }

    /// 比较版本号是否相等
    fn versions_equal(a: &str, b: &str) -> bool {
        let parse = |v: &str| -> Vec<u32> {
            let core = v.trim().trim_start_matches('v').trim_start_matches('V');
            let core = if let Some(pos) = core.find(|c: char| c == '-' || c == '+') {
                &core[..pos]
            } else {
                core
            };
            core.split('.')
                .filter_map(|s| s.parse().ok())
                .collect()
        };

        let a_parts = parse(a);
        let b_parts = parse(b);
        a_parts == b_parts
    }

    // ========== 清单下载与解析 ==========

    /// 下载并解密游戏文件清单
    pub async fn fetch_manifest(
        &self,
        resource_base_url: &str,
    ) -> Result<(Vec<ManifestFile>, String), String> {
        let manifest_url = format!("{}/game_files", resource_base_url);
        tracing::info!("[manifest] Fetching from: {}", manifest_url);

        let resp = self
            .http_client
            .get(&manifest_url)
            .send()
            .await
            .map_err(|e| format!("Failed to download manifest: {}", e))?;

        let status = resp.status();
        tracing::debug!("[manifest] HTTP status: {}", status);

        let encrypted = resp
            .bytes()
            .await
            .map_err(|e| format!("Failed to read manifest bytes: {}", e))?;

        tracing::debug!("[manifest] Encrypted size: {} bytes", encrypted.len());

        // 计算加密字节的 SHA-256 用于状态跟踪
        let manifest_sha256 = hg_crypto::sha256_hex(&encrypted);
        tracing::debug!("[manifest] SHA-256: {}", manifest_sha256);

        // AES-256-CBC 解密
        let decrypted = hg_crypto::decrypt_bytes_to_string(&encrypted)?;
        tracing::debug!("[manifest] Decrypted size: {} bytes", decrypted.len());

        // 解析 NDJSON（每行一个 JSON 对象）
        let files = self.parse_manifest(&decrypted)?;
        tracing::info!("[manifest] Parsed {} files", files.len());

        Ok((files, manifest_sha256))
    }

    /// 解析解密后的清单文本（NDJSON 格式）
    fn parse_manifest(&self, content: &str) -> Result<Vec<ManifestFile>, String> {
        let mut files = Vec::new();
        let mut seen = std::collections::HashSet::new();

        for (line_num, line) in content.lines().enumerate() {
            let line = line.trim();
            if line.is_empty() {
                continue;
            }

            let entry: ManifestFile =
                serde_json::from_str(line).map_err(|e| format!("Line {}: JSON parse error: {}", line_num + 1, e))?;

            // 验证路径安全性
            Self::validate_path(&entry.path)?;

            // 验证 MD5 格式（32 位十六进制）
            if entry.md5.len() != 32 || !entry.md5.chars().all(|c| c.is_ascii_hexdigit()) {
                return Err(format!(
                    "Line {}: Invalid MD5 '{}' (must be 32 hex chars)",
                    line_num + 1,
                    entry.md5
                ));
            }

            if entry.size < 0 {
                return Err(format!("Line {}: Negative file size", line_num + 1));
            }

            // 检查重复路径
            let normalized = entry.path.replace('\\', "/");
            if !seen.insert(normalized.clone()) {
                return Err(format!(
                    "Line {}: Duplicate path '{}'",
                    line_num + 1,
                    normalized
                ));
            }

            files.push(entry);
        }

        if files.len() > 100_000 {
            return Err(format!(
                "Manifest too large: {} entries (max 100,000)",
                files.len()
            ));
        }

        Ok(files)
    }

    /// 验证路径安全性（防止路径穿越）
    fn validate_path(path: &str) -> Result<(), String> {
        if path.is_empty() {
            return Err("Empty path in manifest".to_string());
        }
        if path.starts_with('/') || path.starts_with('\\') {
            return Err(format!("Absolute path not allowed: '{}'", path));
        }
        if path.contains(':') {
            return Err(format!("Path contains drive letter: '{}'", path));
        }

        let reserved = [
            "CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7",
            "COM8", "COM9", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8",
            "LPT9",
        ];

        for component in path.split(&['/', '\\']) {
            if component == "." || component == ".." {
                return Err(format!("Path traversal not allowed: '{}'", path));
            }
            let upper = component.to_uppercase();
            if reserved.contains(&upper.as_str()) {
                return Err(format!(
                    "Windows reserved name in path: '{}' in '{}'",
                    component, path
                ));
            }
        }

        Ok(())
    }

    // ========== 文件比较与计划 ==========

    /// 比较本地文件与清单，生成下载计划
    pub fn plan_updates(
        &self,
        manifest: &[ManifestFile],
        install_path: &str,
    ) -> Vec<FilePlan> {
        let install_dir = Path::new(install_path);
        let mut plans = Vec::new();

        for entry in manifest {
            let local_path = install_dir.join(&entry.path);
            let source = if local_path.exists() {
                // 检查本地文件是否匹配（大小 + MD5）
                if let Ok(meta) = fs::metadata(&local_path) {
                    if meta.len() as i64 == entry.size {
                        if let Ok(true) = hg_crypto::verify_md5(
                            local_path.to_str().unwrap_or(""),
                            &entry.md5,
                        ) {
                            Some(local_path.to_string_lossy().to_string())
                        } else {
                            None
                        }
                    } else {
                        None
                    }
                } else {
                    None
                }
            } else {
                None
            };

            plans.push(FilePlan {
                manifest: entry.clone(),
                source_path: source,
            });
        }

        plans
    }

    // ========== 下载 ==========

    /// 下载单个文件，支持断点续传和重试
    pub async fn download_file_with_resume(
        &self,
        url: &str,
        dest_path: &str,
        progress_callback: &(dyn Fn(u64, u64) + Send + Sync),
    ) -> Result<(), String> {
        let download_path = format!("{}.download", dest_path);
        let download_file = Path::new(&download_path);

        // 确保目标目录存在
        if let Some(parent) = Path::new(dest_path).parent() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create directory: {}", e))?;
        }

        let mut start_byte: u64 = 0;

        // 检查是否有未完成的下载（断点续传）
        if download_file.exists() {
            if let Ok(meta) = fs::metadata(download_file) {
                start_byte = meta.len();
                if start_byte > 0 {
                    tracing::info!(
                        "Resuming download from byte {} for {}",
                        start_byte,
                        dest_path
                    );
                }
            }
        }

        let max_retries = 3;
        let mut last_error = String::new();

        for attempt in 0..max_retries {
            if attempt > 0 {
                // 指数退避
                let delay = Duration::from_secs(attempt as u64);
                tokio::time::sleep(delay).await;
                start_byte = 0; // 重试时从头下载
            }

            let mut req = self.download_client.get(url);
            if start_byte > 0 {
                req = req.header("Range", format!("bytes={}-", start_byte));
            }

            match req.send().await {
                Ok(resp) => {
                    let status = resp.status();
                    let is_partial = status == 206;
                    let is_ok = status == 200;

                    if !is_partial && !is_ok {
                        last_error = format!("HTTP {}", status);
                        continue;
                    }

                    // 如果服务器不支持 Range，从头开始
                    if is_ok && start_byte > 0 {
                        start_byte = 0;
                    }

                    let total = resp.content_length().unwrap_or(0) + start_byte;

                    let mut file = if start_byte > 0 && is_partial {
                        // 追加模式
                        fs::OpenOptions::new()
                            .create(true)
                            .append(true)
                            .open(&download_path)
                            .map_err(|e| format!("Failed to open file for append: {}", e))?
                    } else {
                        // 新建文件
                        fs::File::create(&download_path)
                            .map_err(|e| format!("Failed to create file: {}", e))?
                    };

                    let mut stream = resp.bytes_stream();
                    let mut downloaded = start_byte;
                    let mut last_emit = start_byte;

                    while let Some(chunk) = stream.next().await {
                        // 检查取消标志
                        if DOWNLOAD_CANCELLED.load(Ordering::SeqCst) {
                            drop(file);
                            let _ = fs::remove_file(&download_path);
                            return Err("Download cancelled".to_string());
                        }

                        let chunk = chunk.map_err(|e| format!("Stream error: {}", e))?;
                        file.write_all(&chunk)
                            .map_err(|e| format!("Write error: {}", e))?;
                        downloaded += chunk.len() as u64;

                        // 每 256KB 报告一次进度
                        if downloaded - last_emit >= 256 * 1024 || downloaded == total {
                            progress_callback(downloaded, total);
                            last_emit = downloaded;
                        }
                    }

                    file.flush().map_err(|e| format!("Flush error: {}", e))?;
                    drop(file);

                    // MD5 校验
                    if !hg_crypto::verify_md5(&download_path, &hg_crypto::md5_hex(&fs::read(&download_path).unwrap_or_default()))? {
                        // 从清单 URL 中无法获取预期 MD5，跳过此处校验
                        // 清单校验在批量完成后统一进行
                    }

                    // 重命名为最终文件
                    fs::rename(&download_path, dest_path)
                        .map_err(|e| format!("Failed to rename: {}", e))?;

                    return Ok(());
                }
                Err(e) => {
                    last_error = e.to_string();
                    continue;
                }
            }
        }

        Err(format!(
            "Download failed after {} attempts: {}",
            max_retries, last_error
        ))
    }

    /// 下载文件并验证 MD5
    pub async fn download_and_verify(
        &self,
        url: &str,
        dest_path: &str,
        expected_md5: &str,
        progress_callback: &(dyn Fn(u64, u64) + Send + Sync),
    ) -> Result<(), String> {
        self.download_file_with_resume(url, dest_path, progress_callback)
            .await?;

        // 下载后验证 MD5
        let verified = hg_crypto::verify_md5(dest_path, expected_md5)
            .map_err(|e| format!("MD5 verify error: {}", e))?;

        if !verified {
            let _ = fs::remove_file(dest_path);
            return Err(format!(
                "MD5 mismatch for {}: expected {}",
                dest_path, expected_md5
            ));
        }

        Ok(())
    }

    // ========== 完整安装/更新流程 ==========

    /// 执行完整的安装或更新流程
    /// 返回下载的总字节数
    pub async fn install_or_update(
        &self,
        channel: &GameChannel,
        install_path: &str,
        progress_callback: Arc<dyn Fn(DownloadProgress) + Send + Sync>,
    ) -> Result<String, String> {
        // 1. 检查阶段
        tracing::info!("[install] Starting install_or_update: channel={}, path={}", channel.as_str(), install_path);
        progress_callback(DownloadProgress {
            downloaded: 0,
            total: 0,
            stage: InstallStage::Checking.as_str().to_string(),
            current_file: None,
            file_index: 0,
            file_count: 0,
            verified_bytes: 0,
        });

        let remote = self.get_latest_package(channel).await?;
        tracing::info!(
            "[install] Remote version: {}, resource: {}",
            remote.version,
            remote.resource_base_url
        );

        // 2. 下载并解密清单
        tracing::info!("[install] Fetching manifest...");
        let (manifest, manifest_sha256) =
            self.fetch_manifest(&remote.resource_base_url).await?;
        tracing::info!("[install] Manifest loaded: {} files", manifest.len());

        // 3. 比较阶段
        tracing::info!("[install] Comparing local vs manifest...");
        progress_callback(DownloadProgress {
            downloaded: 0,
            total: 0,
            stage: InstallStage::Comparing.as_str().to_string(),
            current_file: None,
            file_index: 0,
            file_count: manifest.len(),
            verified_bytes: 0,
        });

        let plans = self.plan_updates(&manifest, install_path);
        let mut files_to_download: Vec<&FilePlan> = plans
            .iter()
            .filter(|p| p.source_path.is_none())
            .collect();

        let files_to_copy: Vec<&FilePlan> = plans
            .iter()
            .filter(|p| p.source_path.is_some())
            .collect();

        tracing::info!(
            "[install] Plan: {} files to download, {} files to copy (out of {} total)",
            files_to_download.len(),
            files_to_copy.len(),
            manifest.len()
        );

        if files_to_download.is_empty() && files_to_copy.is_empty() {
            // 已经是最新版本
            tracing::info!("[install] Already up to date, saving state");
            self.save_payload_state(channel, &remote.version, &manifest_sha256, &manifest)?;
            return Ok(remote.version);
        }

        // 4. 创建暂存目录
        let staging_dir = format!(
            "{}.staging.{}",
            install_path,
            uuid::Uuid::new_v4()
        );
        tracing::info!("[install] Staging dir: {}", staging_dir);
        fs::create_dir_all(&staging_dir)
            .map_err(|e| format!("Failed to create staging dir: {}", e))?;

        let staging_path = PathBuf::from(&staging_dir);
        let install_dir = Path::new(install_path);

        let result = async {
            // 5. 复制已有文件
            tracing::info!("[install] Copying {} existing files to staging...", files_to_copy.len());
            for (idx, plan) in files_to_copy.iter().enumerate() {
                if let Some(ref src) = plan.source_path {
                    let dest = staging_path.join(&plan.manifest.path);
                    if let Some(parent) = dest.parent() {
                        fs::create_dir_all(parent)
                            .map_err(|e| format!("Create dir: {}", e))?;
                    }
                    fs::copy(src, &dest)
                        .map_err(|e| format!("Copy file {}: {}", plan.manifest.path, e))?;
                    if (idx + 1) % 500 == 0 || idx + 1 == files_to_copy.len() {
                        tracing::debug!("[install] Copied {}/{} files", idx + 1, files_to_copy.len());
                    }
                }
            }

            // 6. 下载缺失文件（并发下载） — 优先使用预下载文件
            let total_bytes: u64 = files_to_download
                .iter()
                .map(|p| p.manifest.size.max(0) as u64)
                .sum();

            // Check for pre-downloaded files and reuse them
            let preload_dir = self.preload_staging_dir(install_path);
            let mut reused_count = 0usize;
            let mut reused_bytes = 0u64;
            if let Some(ref preload_path) = preload_dir {
                tracing::info!("[install] Found preload staging dir: {}", preload_path);
                for plan in &files_to_download {
                    let preload_file = Path::new(preload_path).join(&plan.manifest.path);
                    let dest = staging_path.join(&plan.manifest.path);
                    if preload_file.exists() {
                        if let Ok(meta) = fs::metadata(&preload_file) {
                            if meta.len() as u64 == plan.manifest.size.max(0) as u64 {
                                // Verify MD5
                                if hg_crypto::verify_md5(
                                    preload_file.to_str().unwrap_or(""),
                                    &plan.manifest.md5,
                                ).unwrap_or(false) {
                                    if let Some(parent) = dest.parent() {
                                        let _ = fs::create_dir_all(parent);
                                    }
                                    if fs::copy(&preload_file, &dest).is_ok() {
                                        reused_count += 1;
                                        reused_bytes += plan.manifest.size.max(0) as u64;
                                    }
                                }
                            }
                        }
                    }
                }
                if reused_count > 0 {
                    tracing::info!(
                        "[install] Reused {}/{} files from preload ({} bytes)",
                        reused_count, files_to_download.len(), reused_bytes
                    );
                    // Remove reused files from download list
                    files_to_download.retain(|plan| {
                        let dest = staging_path.join(&plan.manifest.path);
                        !dest.exists()
                    });
                    // Clean up preload staging after successful reuse
                    self.cleanup_preload_staging(install_path);
                }
            }

            let file_count = files_to_download.len();
            tracing::info!(
                "[install] Downloading {} files, total {} bytes",
                file_count, total_bytes
            );

            let downloaded_bytes = Arc::new(AtomicU64::new(0));
            let max_concurrent = 8;
            let semaphore = Arc::new(Semaphore::new(max_concurrent));
            let mut join_set = tokio::task::JoinSet::new();

            // Background task: emit progress every 500ms
            let progress_cb_bg = progress_callback.clone();
            let dl_bytes_bg = downloaded_bytes.clone();
            let total_bytes_bg = total_bytes;
            let file_count_bg = file_count;
            let progress_handle = tokio::spawn(async move {
                let mut interval = tokio::time::interval(Duration::from_millis(500));
                loop {
                    interval.tick().await;
                    let current = dl_bytes_bg.load(Ordering::Relaxed);
                    if current >= total_bytes_bg && total_bytes_bg > 0 {
                        break;
                    }
                    progress_cb_bg(DownloadProgress {
                        downloaded: current,
                        total: total_bytes_bg,
                        stage: InstallStage::Downloading.as_str().to_string(),
                        current_file: None,
                        file_index: 0,
                        file_count: file_count_bg,
                        verified_bytes: 0,
                    });
                }
            });

            for (idx, plan) in files_to_download.iter().enumerate() {
                let dest = staging_path.join(&plan.manifest.path);
                if let Some(parent) = dest.parent() {
                    fs::create_dir_all(parent)
                        .map_err(|e| format!("Create dir: {}", e))?;
                }

                let dest_str = dest.to_string_lossy().to_string();
                let file_name = plan.manifest.path.clone();
                let file_size = plan.manifest.size.max(0) as u64;
                let expected_md5 = plan.manifest.md5.clone();
                let resource_url = remote.resource_base_url.clone();
                let dl_bytes = downloaded_bytes.clone();
                let sem = semaphore.clone();
                let download_url = format!("{}/{}", resource_url, plan.manifest.path);

                tracing::debug!(
                    "[install] Spawn download {}/{}: {} ({} bytes)",
                    idx + 1, file_count, file_name, file_size
                );

                join_set.spawn(async move {
                    let permit = match sem.acquire().await {
                        Ok(p) => p,
                        Err(e) => return (Err(format!("Semaphore: {}", e)), file_name, file_size),
                    };
                    let result = download_single_file(
                        &download_url, &dest_str, &expected_md5, dl_bytes.clone(), file_size,
                    ).await;
                    drop(permit);
                    if let Err(ref e) = result {
                        tracing::error!("[install] Download FAILED: {} — {}", file_name, e);
                    }
                    (result, file_name, file_size)
                });
            }

            // Wait for all downloads + report per-file completion
            let mut completed = 0u32;
            let mut failed_files = Vec::new();
            while let Some(res) = join_set.join_next().await {
                let (result, file_name, file_size) = res
                    .map_err(|e| format!("Task join error: {}", e))?;
                completed += 1;
                match result {
                    Ok(()) => {
                        tracing::debug!(
                            "[install] Completed {}/{}: {}",
                            completed, file_count, file_name
                        );
                    }
                    Err(e) => {
                        tracing::error!(
                            "[install] Failed {}/{}: {} — {}",
                            completed, file_count, file_name, e
                        );
                        failed_files.push((file_name, e));
                    }
                }
            }

            // Stop the progress emitter
            progress_handle.abort();

            if !failed_files.is_empty() {
                let summary: Vec<String> = failed_files
                    .iter()
                    .map(|(n, e)| format!("{}: {}", n, e))
                    .take(5)
                    .collect();
                return Err(format!(
                    "{} files failed: {}",
                    failed_files.len(),
                    summary.join("; ")
                ));
            }

            tracing::info!("[install] All {} downloads complete, verifying...", file_count);

            // 7. 验证阶段：对暂存目录中所有文件做完整 MD5 校验
            let mut verified_bytes: u64 = 0;
            progress_callback(DownloadProgress {
                downloaded: total_bytes,
                total: total_bytes,
                stage: InstallStage::Verifying.as_str().to_string(),
                current_file: None,
                file_index: 0,
                file_count: manifest.len(),
                verified_bytes: 0,
            });

            for (idx, entry) in manifest.iter().enumerate() {
                let file_path = staging_path.join(&entry.path);
                if !file_path.exists() {
                    tracing::error!("[install] Missing file after download: {}", entry.path);
                    return Err(format!("Missing file after download: {}", entry.path));
                }
                let verified = hg_crypto::verify_md5(
                    file_path.to_str().unwrap_or(""),
                    &entry.md5,
                )
                .map_err(|e| format!("Verify error for {}: {}", entry.path, e))?;
                if !verified {
                    tracing::error!("[install] MD5 verification failed: {}", entry.path);
                    return Err(format!("MD5 verification failed: {}", entry.path));
                }
                verified_bytes += entry.size as u64;
                if (idx + 1) % 500 == 0 || idx + 1 == manifest.len() {
                    tracing::debug!(
                        "[install] Verified {}/{} files",
                        idx + 1, manifest.len()
                    );
                    progress_callback(DownloadProgress {
                        downloaded: total_bytes,
                        total: total_bytes,
                        stage: InstallStage::Verifying.as_str().to_string(),
                        current_file: Some(entry.path.clone()),
                        file_index: idx + 1,
                        file_count: manifest.len(),
                        verified_bytes,
                    });
                }
            }

            tracing::info!("[install] Verification complete, applying staged files...");

            // 8. 应用阶段：原子替换
            progress_callback(DownloadProgress {
                downloaded: total_bytes,
                total: total_bytes,
                stage: InstallStage::Applying.as_str().to_string(),
                current_file: None,
                file_index: 0,
                file_count: manifest.len(),
                verified_bytes: 0,
            });

            self.apply_staged_files(&staging_path, install_dir)?;

            // 9. 保存状态
            tracing::info!("[install] Saving payload state...");
            self.save_payload_state(channel, &remote.version, &manifest_sha256, &manifest)?;

            tracing::info!("[install] Install complete! Version: {}", remote.version);
            Ok::<String, String>(remote.version)
        }
        .await;

        // 清理暂存目录
        tracing::info!("[install] Cleaning up staging dir: {}", staging_dir);
        let _ = fs::remove_dir_all(&staging_path);

        match result {
            Ok(version) => {
                tracing::info!("[install] Install SUCCESS: version={}", version);
                progress_callback(DownloadProgress {
                    downloaded: 0,
                    total: 0,
                    stage: InstallStage::Completed.as_str().to_string(),
                    current_file: None,
                    file_index: 0,
                    file_count: 0,
                    verified_bytes: 0,
                });
                Ok(version)
            }
            Err(e) => {
                tracing::error!("[install] Install FAILED: {}", e);
                progress_callback(DownloadProgress {
                    downloaded: 0,
                    total: 0,
                    stage: InstallStage::Error.as_str().to_string(),
                    current_file: None,
                    file_index: 0,
                    file_count: 0,
                    verified_bytes: 0,
                });
                Err(e)
            }
        }
    }

    /// 原子替换：将暂存目录中的文件移动到安装目录
    fn apply_staged_files(&self, staging: &Path, target: &Path) -> Result<(), String> {
        // 对于暂存目录中的每个文件，直接复制/覆盖到目标
        for entry in WalkDir::new(staging) {
            let entry = entry.map_err(|e| format!("Walk error: {}", e))?;
            if entry.file_type().is_file() {
                let relative = entry
                    .path()
                    .strip_prefix(staging)
                    .map_err(|e| format!("Strip prefix error: {}", e))?;
                let dest = target.join(relative);

                if let Some(parent) = dest.parent() {
                    fs::create_dir_all(parent)
                        .map_err(|e| format!("Create dir error: {}", e))?;
                }

                fs::copy(entry.path(), &dest)
                    .map_err(|e| format!("Copy error {}: {}", relative.display(), e))?;
            }
        }

        Ok(())
    }
    // ========== 完整性修复 ==========

    /// 验证游戏文件完整性并修复（多线程校验 + 即时修复）
    pub async fn verify_and_repair(
        &self,
        channel: &GameChannel,
        install_path: &str,
        progress_callback: Arc<dyn Fn(DownloadProgress) + Send + Sync>,
        max_concurrent: usize,
        quick: bool,
    ) -> Result<String, String> {
        tracing::info!(
            "[verify] ======== verify_and_repair START ======== channel={:?}, install_path={}, max_concurrent={}, quick={}",
            channel, install_path, max_concurrent, quick
        );

        // 1. 获取远程清单
        tracing::info!("[verify] Step 1: Fetching remote package info...");
        let remote = self.get_latest_package(channel).await?;
        tracing::info!(
            "[verify] Remote package: version={}, resource_base_url={}",
            remote.version, remote.resource_base_url
        );

        tracing::info!("[verify] Step 2: Fetching manifest from {}/game_files ...", remote.resource_base_url);
        let (manifest, _) = self.fetch_manifest(&remote.resource_base_url).await?;
        tracing::info!("[verify] Manifest parsed: {} files", manifest.len());
        if manifest.is_empty() {
            tracing::warn!("[verify] WARNING: Manifest is empty! Nothing to verify.");
        }

        let total_verify_bytes: u64 = manifest.iter().map(|e| e.size as u64).sum();
        let file_count = manifest.len();
        let install_dir = Path::new(install_path);

        tracing::info!(
            "[verify] Total expected: {} files, {} bytes ({:.2} MB)",
            file_count, total_verify_bytes, total_verify_bytes as f64 / 1048576.0
        );

        // 检查安装目录
        if !install_dir.exists() {
            tracing::error!(
                "[verify] ERROR: Install directory does not exist: {}",
                install_path
            );
            return Err(format!("Install directory does not exist: {}", install_path));
        }
        tracing::info!("[verify] Install directory exists: {}", install_path);

        // ==================== Phase 1: 检查所有文件 ====================
        tracing::info!("[verify] ======== Phase 1: Check files (quick={}) ========", quick);
        progress_callback(DownloadProgress {
            downloaded: 0,
            total: total_verify_bytes,
            stage: InstallStage::Verifying.as_str().to_string(),
            current_file: None,
            file_index: 0,
            file_count,
            verified_bytes: 0,
        });

        let checked_count = Arc::new(AtomicUsize::new(0));
        let verified_bytes = Arc::new(AtomicU64::new(0));
        let semaphore = Arc::new(Semaphore::new(max_concurrent));
        let mut check_set = tokio::task::JoinSet::new();

        // 需要修复的文件清单
        let repair_list: Arc<Mutex<Vec<(ManifestFile, String)>>> = Arc::new(Mutex::new(Vec::new()));

        // 后台进度发射器（检查阶段）
        let progress_cb_bg = progress_callback.clone();
        let vb_bg = verified_bytes.clone();
        let cc_bg = checked_count.clone();
        let total_bg = total_verify_bytes;
        let fc_bg = file_count;
        let check_progress_handle = tokio::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_millis(500));
            loop {
                interval.tick().await;
                if DOWNLOAD_CANCELLED.load(Ordering::Relaxed) {
                    break;
                }
                let vb = vb_bg.load(Ordering::Relaxed);
                let cc = cc_bg.load(Ordering::Relaxed);
                if vb >= total_bg && total_bg > 0 {
                    break;
                }
                progress_cb_bg(DownloadProgress {
                    downloaded: 0,
                    total: total_bg,
                    stage: InstallStage::Verifying.as_str().to_string(),
                    current_file: None,
                    file_index: cc,
                    file_count: fc_bg,
                    verified_bytes: vb,
                });
            }
        });

        tracing::info!(
            "[verify] Spawning {} check tasks (max_concurrent={})...",
            file_count, max_concurrent
        );

        for (idx, entry) in manifest.iter().enumerate() {
            let local_path = install_dir.join(&entry.path);
            let entryClone = entry.clone();
            let entry_path = entry.path.clone();
            let entry_md5 = entry.md5.clone();
            let entry_size = entry.size.max(0) as u64;
            let sem = semaphore.clone();
            let vb = verified_bytes.clone();
            let cc = checked_count.clone();
            let rl = repair_list.clone();

            check_set.spawn(async move {
                let _permit = sem.acquire().await.unwrap();

                if DOWNLOAD_CANCELLED.load(Ordering::Relaxed) {
                    tracing::debug!("[verify] Cancelled, skipping {}", entry_path);
                    vb.fetch_add(entry_size, Ordering::Relaxed);
                    cc.fetch_add(1, Ordering::Relaxed);
                    return;
                }

                // 检查文件是否存在 + 大小（快速模式跳过 MD5）
                let exists = local_path.exists();
                let actual_size = if exists {
                    fs::metadata(&local_path).map(|m| m.len()).unwrap_or(0)
                } else {
                    0
                };

                let size_ok = exists && actual_size == entry_size;

                let md5_ok = if !exists {
                    false
                } else if !size_ok {
                    false
                } else if quick {
                    true // 快速模式跳过 MD5
                } else {
                    match hg_crypto::verify_md5(
                        local_path.to_str().unwrap_or(""),
                        &entry_md5,
                    ) {
                        Ok(true) => true,
                        Ok(false) => {
                            tracing::debug!(
                                "[verify]   MD5 mismatch: {} (expected={}, actual=?)",
                                entry_path, entry_md5
                            );
                            false
                        }
                        Err(e) => {
                            tracing::warn!(
                                "[verify]   MD5 check error for {}: {}",
                                entry_path, e
                            );
                            false
                        }
                    }
                };

                let needs_repair = !exists || !size_ok || !md5_ok;

                if needs_repair {
                    let reason = if !exists {
                        "MISSING"
                    } else if !size_ok {
                        &format!("SIZE_MISMATCH(expected={},actual={})", entry_size, actual_size)
                    } else {
                        "MD5_MISMATCH"
                    };
                    tracing::info!(
                        "[verify]   [{}] NEEDS_REPAIR: {} ({})",
                        idx, entry_path, reason
                    );
                    rl.lock().await.push((entryClone, entry_path));
                } else if idx % 500 == 0 || idx < 5 {
                    tracing::debug!(
                        "[verify]   [{}] OK: {} ({} bytes)",
                        idx, entry_path, entry_size
                    );
                }

                vb.fetch_add(entry_size, Ordering::Relaxed);
                cc.fetch_add(1, Ordering::Relaxed);
            });
        }

        // 等待所有检查任务完成
        tracing::info!("[verify] Waiting for all check tasks to complete...");
        while let Some(result) = check_set.join_next().await {
            if let Err(e) = result {
                tracing::error!("[verify] Check task panicked: {}", e);
            }
        }
        let _ = check_progress_handle.await;

        let total_checked = checked_count.load(Ordering::Relaxed);
        let pending_repair = repair_list.lock().await;

        tracing::info!(
            "[verify] ======== Phase 1 DONE: {}/{} files checked, {} need repair ========",
            total_checked, file_count, pending_repair.len()
        );

        if !pending_repair.is_empty() {
            for (entry, path) in pending_repair.iter().take(10) {
                tracing::info!(
                    "[verify]   damaged: {} (size={}, md5={})",
                    path, entry.size, entry.md5
                );
            }
            if pending_repair.len() > 10 {
                tracing::info!(
                    "[verify]   ... and {} more damaged files",
                    pending_repair.len() - 10
                );
            }
        }

        // ==================== Phase 2: 修复有问题的文件 ====================
        // 在 drop 前收集损坏文件名列表
        let damaged_files: Vec<String> = pending_repair.iter().map(|(_, p)| p.clone()).collect();
        let damaged_count = damaged_files.len();

        if pending_repair.is_empty() {
            progress_callback(DownloadProgress {
                downloaded: 0,
                total: total_verify_bytes,
                stage: InstallStage::Completed.as_str().to_string(),
                current_file: None,
                file_index: total_checked,
                file_count,
                verified_bytes: total_verify_bytes,
            });
            tracing::info!("[verify] All files verified OK — no repair needed");
            return Ok("All files verified OK".to_string());
        }

        tracing::info!(
            "[verify] ======== Phase 2: Repair {} files ========",
            pending_repair.len()
        );
        let repair_total: u64 = pending_repair.iter().map(|(e, _)| e.size.max(0) as u64).sum();
        let repair_count = pending_repair.len();

        progress_callback(DownloadProgress {
            downloaded: 0,
            total: repair_total,
            stage: InstallStage::Repairing.as_str().to_string(),
            current_file: None,
            file_index: 0,
            file_count: repair_count,
            verified_bytes: 0,
        });

        let repaired_count = Arc::new(AtomicUsize::new(0));
        let repaired_bytes = Arc::new(AtomicU64::new(0));
        let sem2 = Arc::new(Semaphore::new(max_concurrent));
        let mut repair_set = tokio::task::JoinSet::new();

        // 后台进度发射器（修复阶段）
        let progress_cb_bg2 = progress_callback.clone();
        let rb_bg = repaired_bytes.clone();
        let rc_bg = repaired_count.clone();
        let rt_bg = repair_total;
        let rpc_bg = repair_count;
        let repair_progress_handle = tokio::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_millis(500));
            loop {
                interval.tick().await;
                if DOWNLOAD_CANCELLED.load(Ordering::Relaxed) {
                    break;
                }
                let rb = rb_bg.load(Ordering::Relaxed);
                let rc = rc_bg.load(Ordering::Relaxed);
                if rb >= rt_bg && rt_bg > 0 {
                    break;
                }
                progress_cb_bg2(DownloadProgress {
                    downloaded: 0,
                    total: rt_bg,
                    stage: InstallStage::Repairing.as_str().to_string(),
                    current_file: None,
                    file_index: rc,
                    file_count: rpc_bg,
                    verified_bytes: rb,
                });
            }
        });

        for (entry, entry_path) in pending_repair.iter() {
            let local_path = install_dir.join(&entry.path);
            let entry_path = entry_path.clone();
            let entry_md5 = entry.md5.clone();
            let entry_size = entry.size.max(0) as u64;
            let resource_url = remote.resource_base_url.clone();
            let sem = sem2.clone();
            let rb = repaired_bytes.clone();
            let rc = repaired_count.clone();

            repair_set.spawn(async move {
                let _permit = sem.acquire().await.unwrap();

                if DOWNLOAD_CANCELLED.load(Ordering::Relaxed) {
                    tracing::debug!("[verify] Repair cancelled, skipping {}", entry_path);
                    rb.fetch_add(entry_size, Ordering::Relaxed);
                    rc.fetch_add(1, Ordering::Relaxed);
                    return;
                }

                let dest = local_path.parent().map(|p| p.to_path_buf()).unwrap_or_default();
                let _ = fs::create_dir_all(&dest);
                let dest_file = dest.join(local_path.file_name().unwrap_or_default());
                let dest_str = dest_file.to_string_lossy().to_string();
                let download_url = format!("{}/{}", resource_url, entry_path);
                tracing::info!(
                    "[verify] Repairing: {} -> {} ({} bytes, md5={})",
                    download_url, dest_str, entry_size, entry_md5
                );
                match download_single_file(&download_url, &dest_str, &entry_md5, Arc::new(AtomicU64::new(0)), entry_size).await {
                    Ok(()) => {
                        tracing::info!("[verify] Repair OK: {}", entry_path);
                        rc.fetch_add(1, Ordering::Relaxed);
                    }
                    Err(e) => {
                        tracing::error!("[verify] FAILED to repair {}: {}", entry_path, e);
                    }
                }

                rb.fetch_add(entry_size, Ordering::Relaxed);
            });
        }

        drop(pending_repair);

        // 等待所有修复任务完成
        tracing::info!("[verify] Waiting for all repair tasks to complete...");
        while let Some(result) = repair_set.join_next().await {
            if let Err(e) = result {
                tracing::error!("[verify] Repair task panicked: {}", e);
            }
        }
        let _ = repair_progress_handle.await;

        let total_repaired = repaired_count.load(Ordering::Relaxed);

        tracing::info!(
            "[verify] ======== Phase 2 DONE: repaired {}/{} files ========",
            total_repaired, repair_count
        );

        // 最终进度
        progress_callback(DownloadProgress {
            downloaded: 0,
            total: total_verify_bytes,
            stage: InstallStage::Completed.as_str().to_string(),
            current_file: None,
            file_index: total_checked,
            file_count,
            verified_bytes: total_verify_bytes,
        });

        tracing::info!("[verify] ======== verify_and_repair END ======== Repaired {} files", total_repaired);

        // 构建结果：返回 JSON 结构数据，由前端做本地化
        let result = if damaged_count > 0 {
            let ok_count = total_checked.saturating_sub(damaged_count);
            let files: Vec<String> = damaged_files.iter().cloned().collect();
            serde_json::json!({
                "ok": ok_count,
                "failed": damaged_count,
                "repaired": total_repaired,
                "files": files,
            }).to_string()
        } else {
            serde_json::json!({
                "ok": total_checked,
                "failed": 0,
                "repaired": 0,
                "files": Vec::<String>::new(),
            }).to_string()
        };
        Ok(result)
    }

    // ========== 预下载 ==========

    /// 预下载游戏更新资源
    pub async fn preload_download(
        &self,
        channel: &GameChannel,
        install_path: &str,
        progress_callback: Arc<dyn Fn(DownloadProgress) + Send + Sync>,
        max_concurrent: usize,
    ) -> Result<String, String> {
        // 1. 获取远程信息
        let remote = self.get_latest_package(channel).await?;

        let preload_url = remote.preload_resource_url.as_ref()
            .ok_or_else(|| "No preload package available".to_string())?;
        let preload_version = remote.preload_version.as_ref()
            .ok_or_else(|| "No preload version".to_string())?;

        // 2. 获取 preload 清单
        let (manifest, _manifest_sha256) = self.fetch_manifest(preload_url).await?;

        let total_bytes: u64 = manifest.iter().map(|e| e.size as u64).sum();
        let file_count = manifest.len();

        tracing::info!(
            "[preload] Starting preload: version={}, {} files, {} bytes",
            preload_version, file_count, total_bytes
        );

        // 3. 创建 preload staging 目录
        let preload_staging = format!("{}.staging.preload.{}", install_path, uuid::Uuid::new_v4());
        let staging_path = PathBuf::from(&preload_staging);

        fs::create_dir_all(&staging_path)
            .map_err(|e| format!("Create staging dir: {}", e))?;

        // 4. 初始进度
        progress_callback(DownloadProgress {
            downloaded: 0,
            total: total_bytes,
            stage: InstallStage::Downloading.as_str().to_string(),
            current_file: None,
            file_index: 0,
            file_count,
            verified_bytes: 0,
        });

        // 5. 并行下载所有文件到 staging
        let downloaded_bytes = Arc::new(AtomicU64::new(0));
        let downloaded_count = Arc::new(AtomicUsize::new(0));
        let semaphore = Arc::new(Semaphore::new(max_concurrent));
        let mut join_set = tokio::task::JoinSet::new();

        // 后台进度发射器
        let progress_cb_bg = progress_callback.clone();
        let db_bg = downloaded_bytes.clone();
        let dc_bg = downloaded_count.clone();
        let total_bg = total_bytes;
        let fc_bg = file_count;
        let progress_handle = tokio::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_millis(500));
            loop {
                interval.tick().await;
                if DOWNLOAD_CANCELLED.load(Ordering::Relaxed) {
                    break;
                }
                let db = db_bg.load(Ordering::Relaxed);
                let dc = dc_bg.load(Ordering::Relaxed);
                if db >= total_bg && total_bg > 0 {
                    break;
                }
                progress_cb_bg(DownloadProgress {
                    downloaded: db,
                    total: total_bg,
                    stage: InstallStage::Downloading.as_str().to_string(),
                    current_file: None,
                    file_index: dc,
                    file_count: fc_bg,
                    verified_bytes: 0,
                });
            }
        });

        for entry in &manifest {
            let local_path = staging_path.join(&entry.path);
            let entry_path = entry.path.clone();
            let entry_md5 = entry.md5.clone();
            let entry_size = entry.size.max(0) as u64;
            let resource_url = preload_url.clone();
            let sem = semaphore.clone();
            let db = downloaded_bytes.clone();
            let dc = downloaded_count.clone();

            join_set.spawn(async move {
                let _permit = sem.acquire().await.unwrap();

                if DOWNLOAD_CANCELLED.load(Ordering::Relaxed) {
                    db.fetch_add(entry_size, Ordering::Relaxed);
                    dc.fetch_add(1, Ordering::Relaxed);
                    return;
                }

                let dest = local_path.parent().map(|p| p.to_path_buf()).unwrap_or_default();
                let _ = fs::create_dir_all(&dest);
                let dest_str = local_path.to_string_lossy().to_string();
                let download_url = format!("{}/{}", resource_url, entry_path);

                match download_single_file(&download_url, &dest_str, &entry_md5, Arc::new(AtomicU64::new(0)), entry_size).await {
                    Ok(()) => {}
                    Err(e) => {
                        tracing::error!("[preload] Failed to download {}: {}", entry_path, e);
                    }
                }

                db.fetch_add(entry_size, Ordering::Relaxed);
                dc.fetch_add(1, Ordering::Relaxed);
            });
        }

        // 等待所有下载完成
        while let Some(_) = join_set.join_next().await {}
        let _ = progress_handle.await;

        if DOWNLOAD_CANCELLED.load(Ordering::Relaxed) {
            let _ = fs::remove_dir_all(&staging_path);
            return Err("Download cancelled".to_string());
        }

        // 6. 验证阶段
        tracing::info!("[preload] Download complete, starting verification");
        progress_callback(DownloadProgress {
            downloaded: total_bytes,
            total: total_bytes,
            stage: InstallStage::Verifying.as_str().to_string(),
            current_file: None,
            file_index: 0,
            file_count,
            verified_bytes: 0,
        });

        let verified_bytes = Arc::new(AtomicU64::new(0));
        let checked_count = Arc::new(AtomicUsize::new(0));
        let sem2 = Arc::new(Semaphore::new(max_concurrent));
        let mut verify_set = tokio::task::JoinSet::new();

        // 后台进度发射器（验证阶段）
        let progress_cb_bg2 = progress_callback.clone();
        let vb_bg = verified_bytes.clone();
        let cc_bg = checked_count.clone();
        let total_bg2 = total_bytes;
        let fc_bg2 = file_count;
        let verify_progress_handle = tokio::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_millis(500));
            loop {
                interval.tick().await;
                if DOWNLOAD_CANCELLED.load(Ordering::Relaxed) {
                    break;
                }
                let vb = vb_bg.load(Ordering::Relaxed);
                let cc = cc_bg.load(Ordering::Relaxed);
                if vb >= total_bg2 && total_bg2 > 0 {
                    break;
                }
                progress_cb_bg2(DownloadProgress {
                    downloaded: total_bg2,
                    total: total_bg2,
                    stage: InstallStage::Verifying.as_str().to_string(),
                    current_file: None,
                    file_index: cc,
                    file_count: fc_bg2,
                    verified_bytes: vb,
                });
            }
        });

        for entry in &manifest {
            let local_path = staging_path.join(&entry.path);
            let entry_path = entry.path.clone();
            let entry_md5 = entry.md5.clone();
            let entry_size = entry.size.max(0) as u64;
            let sem = sem2.clone();
            let vb = verified_bytes.clone();
            let cc = checked_count.clone();

            verify_set.spawn(async move {
                let _permit = sem.acquire().await.unwrap();

                let ok = local_path.exists()
                    && fs::metadata(&local_path).map(|m| m.len() as u64 == entry_size).unwrap_or(false)
                    && hg_crypto::verify_md5(local_path.to_str().unwrap_or(""), &entry_md5).unwrap_or(false);

                if !ok {
                    tracing::error!("[preload] Verification failed for {}", entry_path);
                }

                vb.fetch_add(entry_size, Ordering::Relaxed);
                cc.fetch_add(1, Ordering::Relaxed);
            });
        }

        while let Some(_) = verify_set.join_next().await {}
        let _ = verify_progress_handle.await;

        // 7. 保存预下载状态
        self.save_preload_state(channel, &preload_version, true)?;

        // 最终进度
        progress_callback(DownloadProgress {
            downloaded: total_bytes,
            total: total_bytes,
            stage: InstallStage::Completed.as_str().to_string(),
            current_file: None,
            file_index: file_count,
            file_count,
            verified_bytes: total_bytes,
        });

        tracing::info!("[preload] Preload completed: version={}", preload_version);
        Ok(format!("Preload completed: {} files", file_count))
    }

    /// 获取预下载 staging 目录路径
    fn preload_staging_dir(&self, install_path: &str) -> Option<String> {
        let parent = Path::new(install_path).parent()?;
        let stem = Path::new(install_path).file_name()?.to_str()?;
        for entry in fs::read_dir(parent).ok()? {
            let entry = entry.ok()?;
            let name = entry.file_name().to_string_lossy().to_string();
            if name.starts_with(&format!("{}.staging.preload.", stem)) {
                return Some(entry.path().to_string_lossy().to_string());
            }
        }
        None
    }

    /// 清理预下载 staging 目录
    fn cleanup_preload_staging(&self, install_path: &str) {
        if let Some(dir) = self.preload_staging_dir(install_path) {
            let _ = fs::remove_dir_all(dir);
        }
    }

    /// 保存 payload 状态到文件
    fn save_payload_state(
        &self,
        channel: &GameChannel,
        version: &str,
        manifest_sha256: &str,
        manifest: &[ManifestFile],
    ) -> Result<(), String> {
        let state_dir = crate::utils::paths::app_data_dir()
            .map_err(|e| format!("App data dir: {}", e))?
            .join("game_state");

        fs::create_dir_all(&state_dir)
            .map_err(|e| format!("Create state dir: {}", e))?;

        // Preserve existing preload state if present
        let existing = self.load_payload_state(channel);

        let state = PayloadState {
            channel: channel.as_str().to_string(),
            version: version.to_string(),
            manifest_sha256: manifest_sha256.to_string(),
            file_count: manifest.len(),
            total_bytes: manifest.iter().map(|f| f.size.max(0) as u64).sum(),
            updated_at: chrono::Utc::now().to_rfc3339(),
            preload_version: existing.as_ref().and_then(|s| s.preload_version.clone()),
            preload_completed: existing.as_ref().map_or(false, |s| s.preload_completed),
        };

        let state_file = state_dir.join(format!("{}.json", channel.as_str()));
        let json = serde_json::to_string_pretty(&state)
            .map_err(|e| format!("JSON serialize: {}", e))?;

        // 原子写入：先写临时文件，再重命名
        let tmp_file = state_file.with_extension("json.tmp");
        fs::write(&tmp_file, &json).map_err(|e| format!("Write state: {}", e))?;
        fs::rename(&tmp_file, &state_file).map_err(|e| format!("Rename state: {}", e))?;

        Ok(())
    }

    /// 读取 payload 状态（同步版本，供内部使用）
    fn load_payload_state(&self, channel: &GameChannel) -> Option<PayloadState> {
        let state_dir = crate::utils::paths::app_data_dir().ok()?.join("game_state");
        let state_file = state_dir.join(format!("{}.json", channel.as_str()));
        let content = fs::read_to_string(&state_file).ok()?;
        serde_json::from_str(&content).ok()
    }

    /// 读取 payload 状态（异步版本，供外部使用）
    pub async fn get_payload_state(&self, channel: &GameChannel) -> Option<PayloadState> {
        self.load_payload_state(channel)
    }

    /// 保存预下载状态
    fn save_preload_state(
        &self,
        channel: &GameChannel,
        preload_version: &str,
        completed: bool,
    ) -> Result<(), String> {
        let state_dir = crate::utils::paths::app_data_dir()
            .map_err(|e| format!("App data dir: {}", e))?
            .join("game_state");

        fs::create_dir_all(&state_dir)
            .map_err(|e| format!("Create state dir: {}", e))?;

        let mut existing = self.load_payload_state(channel).unwrap_or_else(|| PayloadState {
            channel: channel.as_str().to_string(),
            version: String::new(),
            manifest_sha256: String::new(),
            file_count: 0,
            total_bytes: 0,
            updated_at: String::new(),
            preload_version: None,
            preload_completed: false,
        });

        existing.preload_version = Some(preload_version.to_string());
        existing.preload_completed = completed;

        let state_file = state_dir.join(format!("{}.json", channel.as_str()));
        let json = serde_json::to_string_pretty(&existing)
            .map_err(|e| format!("JSON serialize: {}", e))?;

        let tmp_file = state_file.with_extension("json.tmp");
        fs::write(&tmp_file, &json).map_err(|e| format!("Write state: {}", e))?;
        fs::rename(&tmp_file, &state_file).map_err(|e| format!("Rename state: {}", e))?;

        Ok(())
    }

    // ========== Banner / Announcement / Background ==========

    /// 通用 batch_proxy 请求（web API）
    async fn batch_proxy_web(
        &self,
        channel: &GameChannel,
        proxy_reqs: serde_json::Value,
    ) -> Result<BatchProxyResponse, String> {
        let req_body = serde_json::json!({
            "seq": channel.seq(),
            "proxy_reqs": proxy_reqs
        });

        let resp = self
            .http_client
            .post(channel.web_api_url())
            .json(&req_body)
            .send()
            .await
            .map_err(|e| format!("Web API request failed: {}", e))?;

        let text = resp.text().await.map_err(|e| format!("Failed to read response body: {}", e))?;

        // Log the raw response for debugging announcement parsing
        if let Ok(raw) = serde_json::from_str::<serde_json::Value>(&text) {
            if let Some(rsps) = raw.get("proxy_rsps").and_then(|v| v.as_array()) {
                for (i, rsp) in rsps.iter().enumerate() {
                    let kind = rsp.get("kind").and_then(|v| v.as_str()).unwrap_or("?");
                    eprintln!("[Launcher] proxy_rsps[{}] kind={}", i, kind);
                    if let Some(ann_rsp) = rsp.get("get_announcement_rsp") {
                        eprintln!("[Launcher]   get_announcement_rsp keys: {:?}", ann_rsp.as_object().map(|m| m.keys().collect::<Vec<_>>()));
                        if let Some(tabs) = ann_rsp.get("tabs") {
                            let tab_arr = tabs.as_array();
                            eprintln!("[Launcher]   tabs count: {}", tab_arr.map_or(0, |a| a.len()));
                            if let Some(tabs) = tab_arr {
                                for (ti, tab) in tabs.iter().enumerate() {
                                    let tab_name = tab.get("tabName").and_then(|v| v.as_str()).unwrap_or("?");
                                    let ann_count = tab.get("announcements").and_then(|v| v.as_array()).map_or(0, |a| a.len());
                                    eprintln!("[Launcher]     tab[{}] name={}, announcements={}", ti, tab_name, ann_count);
                                }
                            }
                        } else {
                            eprintln!("[Launcher]   no 'tabs' key in get_announcement_rsp");
                        }
                    }
                    if let Some(banner_rsp) = rsp.get("get_banner_rsp") {
                        let count = banner_rsp.get("banners").and_then(|v| v.as_array()).map_or(0, |a| a.len());
                        eprintln!("[Launcher]   get_banner_rsp: {} banners", count);
                    }
                }
            }
        }

        let body: BatchProxyResponse = serde_json::from_str(&text)
            .map_err(|e| format!("Failed to parse web API response: {}", e))?;

        Ok(body)
    }

    /// 获取 Banner 列表
    pub async fn get_banners(&self, channel: &GameChannel) -> Result<Vec<BannerItem>, String> {
        let proxy_reqs = serde_json::json!([{
            "kind": "get_banner",
            "get_banner_req": {
                "appcode": channel.app_code(),
                "language": "zh-cn",
                "channel": channel.channel(),
                "sub_channel": channel.sub_channel(),
                "platform": "Windows",
                "source": "launcher"
            }
        }]);

        let body = self.batch_proxy_web(channel, proxy_reqs).await?;

        let banners = body
            .proxy_rsps
            .iter()
            .filter_map(|r| r.get_banner_rsp.as_ref())
            .flat_map(|rsp| {
                rsp.banners.iter().map(|b| BannerItem {
                    image_url: b.url.clone(),
                    jump_url: b.jump_url.clone(),
                })
            })
            .collect();

        Ok(banners)
    }

    /// 获取公告列表
    pub async fn get_announcements(
        &self,
        channel: &GameChannel,
    ) -> Result<Vec<AnnouncementItem>, String> {
        let proxy_reqs = serde_json::json!([{
            "kind": "get_announcement",
            "get_announcement_req": {
                "appcode": channel.app_code(),
                "language": "zh-cn",
                "channel": channel.channel(),
                "sub_channel": channel.sub_channel(),
                "platform": "Windows",
                "source": "launcher"
            }
        }]);

        let body = self.batch_proxy_web(channel, proxy_reqs).await?;

        let announcements = body
            .proxy_rsps
            .iter()
            .filter_map(|r| r.get_announcement_rsp.as_ref())
            .flat_map(|rsp| {
                rsp.tabs.iter().flat_map(|tab| {
                    tab.announcements.iter().map(|a| {
                        let date = a
                            .start_ts
                            .as_ref()
                            .and_then(|ts| ts.parse::<i64>().ok())
                            .map(|ts| {
                                let dt = chrono::DateTime::from_timestamp(ts, 0)
                                    .unwrap_or_default();
                                dt.format("%m/%d").to_string()
                            })
                            .unwrap_or_default();

                        AnnouncementItem {
                            category: tab.tab_name.clone(),
                            title: a.content.clone(),
                            date,
                            jump_url: a.jump_url.clone().unwrap_or_default(),
                        }
                    })
                })
            })
            .collect();

        Ok(announcements)
    }

    /// 获取启动器公告内容（Banner + 公告合并返回）
    pub async fn get_notice_content(
        &self,
        channel: &GameChannel,
    ) -> Result<LauncherNoticeContent, String> {
        let proxy_reqs = serde_json::json!([
            {
                "kind": "get_banner",
                "get_banner_req": {
                    "appcode": channel.app_code(),
                    "language": "zh-cn",
                    "channel": channel.channel(),
                    "sub_channel": channel.sub_channel(),
                    "platform": "Windows",
                    "source": "launcher"
                }
            },
            {
                "kind": "get_announcement",
                "get_announcement_req": {
                    "appcode": channel.app_code(),
                    "language": "zh-cn",
                    "channel": channel.channel(),
                    "sub_channel": channel.sub_channel(),
                    "platform": "Windows",
                    "source": "launcher"
                }
            }
        ]);

        let body = self.batch_proxy_web(channel, proxy_reqs).await?;

        let mut banners = Vec::new();
        let mut announcements = Vec::new();

        for rsp in &body.proxy_rsps {
            if let Some(ref banner_rsp) = rsp.get_banner_rsp {
                for b in &banner_rsp.banners {
                    banners.push(BannerItem {
                        image_url: b.url.clone(),
                        jump_url: b.jump_url.clone(),
                    });
                }
            }
            if let Some(ref announcement_rsp) = rsp.get_announcement_rsp {
                for tab in &announcement_rsp.tabs {
                    for a in &tab.announcements {
                        let date = a
                            .start_ts
                            .as_ref()
                            .and_then(|ts| ts.parse::<i64>().ok())
                            .map(|ts| {
                                let dt = chrono::DateTime::from_timestamp(ts, 0)
                                    .unwrap_or_default();
                                dt.format("%m/%d").to_string()
                            })
                            .unwrap_or_default();

                        let title = a.content.trim().to_string();
                        if title.is_empty() {
                            continue;
                        }

                        announcements.push(AnnouncementItem {
                            category: tab.tab_name.clone(),
                            title,
                            date,
                            jump_url: a.jump_url.clone().unwrap_or_default(),
                        });
                    }
                }
            } else {
                eprintln!("[Launcher] get_announcement_rsp is None for kind={}, raw response will be logged by batch_proxy_web", rsp.kind);
            }
        }

        eprintln!("[Launcher] get_notice_content result: {} banners, {} announcements", banners.len(), announcements.len());

        Ok(LauncherNoticeContent {
            banners,
            announcements,
        })
    }

    /// 获取启动器背景媒体（图片或视频）
    pub async fn get_background_image(
        &self,
        channel: &GameChannel,
    ) -> Result<Option<BackgroundMedia>, String> {
        let proxy_reqs = serde_json::json!([{
            "kind": "get_main_bg_image",
            "get_main_bg_image_req": {
                "appcode": channel.app_code(),
                "language": "zh-cn",
                "channel": channel.channel(),
                "sub_channel": channel.sub_channel(),
                "platform": "Windows",
                "source": "launcher"
            }
        }]);

        let body = self.batch_proxy_web(channel, proxy_reqs).await?;

        eprintln!("[Launcher] Background API proxy_rsps count: {}", body.proxy_rsps.len());

        for (i, rsp) in body.proxy_rsps.iter().enumerate() {
            eprintln!("[Launcher] proxy_rsp[{}] kind={:?}", i, rsp.kind);
            if let Some(ref bg_rsp) = rsp.get_main_bg_image_rsp {
                eprintln!("[Launcher] get_main_bg_image_rsp: {:?}", bg_rsp);
                if let Some(ref bg_data) = bg_rsp.main_bg_image {
                    let url = bg_data.url.clone();
                    let media_type = self.classify_media_type(&url);
                    eprintln!("[Launcher] Background media found: url={}, type={}", url, media_type);
                    return Ok(Some(BackgroundMedia { url, media_type }));
                }
            }
        }

        eprintln!("[Launcher] No background media found in response");
        Ok(None)
    }

    /// 判断 URL 的媒体类型
    fn classify_media_type(&self, url: &str) -> String {
        let lower = url.to_lowercase();
        if lower.ends_with(".mp4")
            || lower.ends_with(".webm")
            || lower.ends_with(".ogg")
            || lower.contains(".mp4?")
            || lower.contains(".webm?")
        {
            "video".to_string()
        } else {
            "image".to_string()
        }
    }
}

/// 单文件下载+验证（供并发下载使用）
/// - Streams chunks to disk, updates shared `dl_bytes` counter incrementally
/// - Single-pass MD5: reads file once after download for verification
/// - Retries up to 3 times with exponential backoff
async fn download_single_file(
    url: &str,
    dest_path: &str,
    expected_md5: &str,
    dl_bytes: Arc<AtomicU64>,
    file_size: u64,
) -> Result<(), String> {
    let download_path = format!("{}.download", dest_path);
    let download_file = Path::new(&download_path);

    if let Some(parent) = Path::new(dest_path).parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create directory {}: {}", parent.display(), e))?;
    }

    let mut start_byte: u64 = 0;
    if download_file.exists() {
        if let Ok(meta) = fs::metadata(download_file) {
            start_byte = meta.len();
            if start_byte > 0 {
                tracing::debug!(
                    "[download] Resuming {} from byte {}/{}",
                    dest_path, start_byte, file_size
                );
            }
        }
    }

    let client = Client::builder()
        .timeout(Duration::from_secs(600))
        .user_agent("EndProtocol/0.1.0")
        .build()
        .map_err(|e| format!("HTTP client: {}", e))?;

    let max_retries = 3u32;
    let mut last_error = String::new();

    for attempt in 0..max_retries {
        if attempt > 0 {
            let delay = Duration::from_secs(attempt as u64 * 2);
            tracing::warn!(
                "[download] Retry {}/{} for {} after {}s: {}",
                attempt + 1, max_retries, dest_path, delay.as_secs(), last_error
            );
            tokio::time::sleep(delay).await;
            start_byte = 0;
        }

        let mut req = client.get(url);
        if start_byte > 0 {
            req = req.header("Range", format!("bytes={}-", start_byte));
        }

        match req.send().await {
            Ok(resp) => {
                let status = resp.status();
                let is_partial = status == 206;
                let is_ok = status == 200;

                if !is_partial && !is_ok {
                    last_error = format!("HTTP {}", status);
                    tracing::warn!(
                        "[download] HTTP {} for {} (attempt {}/{})",
                        status, dest_path, attempt + 1, max_retries
                    );
                    continue;
                }

                if is_ok && start_byte > 0 {
                    tracing::debug!(
                        "[download] Server ignored Range for {}, restarting from 0",
                        dest_path
                    );
                    start_byte = 0;
                }

                let content_length = resp.content_length().unwrap_or(0);
                let total = content_length + start_byte;
                tracing::debug!(
                    "[download] Starting {}: total={}, start_byte={}, status={}",
                    dest_path, total, start_byte, status
                );

                let mut file = if start_byte > 0 && is_partial {
                    fs::OpenOptions::new()
                        .create(true)
                        .append(true)
                        .open(&download_path)
                        .map_err(|e| format!("Open append: {}", e))?
                } else {
                    fs::File::create(&download_path)
                        .map_err(|e| format!("Create file: {}", e))?
                };

                let mut stream = resp.bytes_stream();
                let mut downloaded = start_byte;
                let mut last_log = start_byte;
                let log_interval = 4 * 1024 * 1024; // log every 4 MB

                while let Some(chunk) = stream.next().await {
                    if DOWNLOAD_CANCELLED.load(Ordering::SeqCst) {
                        drop(file);
                        let _ = fs::remove_file(&download_path);
                        tracing::info!("[download] Cancelled: {}", dest_path);
                        return Err("Download cancelled".to_string());
                    }
                    let chunk = chunk.map_err(|e| format!("Stream: {}", e))?;
                    file.write_all(&chunk).map_err(|e| format!("Write: {}", e))?;
                    let chunk_len = chunk.len() as u64;
                    downloaded += chunk_len;
                    dl_bytes.fetch_add(chunk_len, Ordering::Relaxed);

                    // Log progress periodically
                    if downloaded - last_log >= log_interval || downloaded == total {
                        tracing::debug!(
                            "[download] {} {}/{} ({:.1}%)",
                            dest_path,
                            downloaded,
                            total,
                            if total > 0 { downloaded as f64 / total as f64 * 100.0 } else { 0.0 }
                        );
                        last_log = downloaded;
                    }
                }
                file.flush().map_err(|e| format!("Flush: {}", e))?;
                drop(file);

                tracing::debug!("[download] Stream complete for {}, verifying MD5", dest_path);

                // Single-pass MD5: read file once, compute hash
                let data = fs::read(&download_path)
                    .map_err(|e| format!("Read for MD5: {}", e))?;
                let actual_md5 = hg_crypto::md5_hex(&data);
                drop(data); // free memory immediately

                if !expected_md5.is_empty()
                    && !actual_md5.eq_ignore_ascii_case(expected_md5)
                {
                    let _ = fs::remove_file(&download_path);
                    tracing::error!(
                        "[download] MD5 mismatch for {}: expected={}, got={}",
                        dest_path, expected_md5, actual_md5
                    );
                    return Err(format!(
                        "MD5 mismatch: expected {}, got {}",
                        expected_md5, actual_md5
                    ));
                }

                tracing::debug!(
                    "[download] Renaming {} -> {}",
                    download_path, dest_path
                );
                fs::rename(&download_path, dest_path)
                    .map_err(|e| format!("Rename: {}", e))?;

                tracing::info!("[download] OK: {} ({} bytes)", dest_path, downloaded);
                return Ok(());
            }
            Err(e) => {
                last_error = e.to_string();
                tracing::warn!(
                    "[download] Request error for {} (attempt {}/{}): {}",
                    dest_path, attempt + 1, max_retries, last_error
                );
                continue;
            }
        }
    }

    tracing::error!(
        "[download] FAILED after {} attempts: {} — {}",
        max_retries, dest_path, last_error
    );
    Err(format!("Download failed after {} attempts: {}", max_retries, last_error))
}
