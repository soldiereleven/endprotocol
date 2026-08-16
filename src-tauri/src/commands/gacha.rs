use std::collections::HashMap;
use std::sync::{Arc, Mutex as SyncMutex};
use tauri::State;
use tokio::sync::Mutex;

use crate::services::account_service::AccountService;
use crate::services::config_service::ConfigService;
use crate::services::gacha_service::GachaService;
use crate::utils::AppError;
use crate::{log_error, log_info, log_warn};

/// 根据 roleId 在配置中查找对应的 userId、serverId 和 u8token
fn lookup_u8token(
    config_service: &Arc<SyncMutex<ConfigService>>,
    role_id: &str,
) -> Result<(String, String, String), AppError> {
    let config = config_service.lock().map_err(|e| AppError::ConfigError {
        message: format!("Lock failed: {}", e),
    })?;
    let all_config = config.get_all();

    for (key, value) in &all_config {
        if key.starts_with("account_token_") {
            let u8token = value
                .get("u8token")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            let user_id = key.trim_start_matches("account_token_").to_string();

            if let Some(ref u8t) = u8token {
                if let Some(roles) = value.get("roles").and_then(|v| v.as_array()) {
                    for role in roles {
                        if let Some(rid) = role.get("roleId").and_then(|v| v.as_str()) {
                            if rid == role_id {
                                if let Some(sid) = role.get("serverId").and_then(|v| v.as_str()) {
                                    return Ok((user_id, sid.to_string(), u8t.clone()));
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    Err(AppError::AuthError {
        message: format!("No u8token found for roleId: {}. Please re-login.", role_id),
    })
}

/// 同步前确保 u8token 新鲜：先检查/刷新 cred，再主动重新获取一次 u8token（成功则使用新值），返回最新 u8token
async fn ensure_fresh_u8token(
    account_service: &AccountService,
    config_service: &Arc<SyncMutex<ConfigService>>,
    user_id: &str,
    role_id: &str,
) -> Result<String, AppError> {
    match account_service.check_and_refresh_user_cred(user_id).await {
        Ok(_) => {}
        Err(e) => {
            log_warn!(
                "gacha: cred refresh failed (non-fatal) for user {}: {}",
                user_id,
                e
            );
        }
    }

    // 每次同步前主动刷新 u8token，避免旧 token 过期导致接口返回非 JSON（error decoding response body）
    if let Some(fresh) = account_service.refresh_u8token_for_user(user_id).await? {
        return Ok(fresh);
    }

    let (_, _, u8token) = lookup_u8token(config_service, role_id)?;
    Ok(u8token)
}

/// 获取可用卡池 Tab（meta），供前端展示卡池切换
#[tauri::command]
pub async fn get_gacha_pool_meta(
    account_state: State<'_, Arc<Mutex<AccountService>>>,
    gacha_state: State<'_, Arc<GachaService>>,
    role_id: String,
) -> Result<serde_json::Value, String> {
    log_info!("get_gacha_pool_meta: START for role_id={}", role_id);
    let account = account_state.lock().await;
    let config_service = account.get_config_service().clone();

    let (user_id, server_id, _u8token) = lookup_u8token(&config_service, &role_id).map_err(|e| {
        log_error!("get_gacha_pool_meta: lookup failed: {}", e);
        e.to_string()
    })?;
    let u8token = ensure_fresh_u8token(&account, &config_service, &user_id, &role_id)
        .await
        .map_err(|e| e.to_string())?;

    let meta = gacha_state
        .get_pool_meta(&u8token, &server_id)
        .await
        .map_err(|e| {
            log_error!("get_gacha_pool_meta: FAILED for role_id={}: {}", role_id, e);
            e.to_string()
        })?;

    log_info!("get_gacha_pool_meta: SUCCESS for role_id={}", role_id);
    serde_json::to_value(meta).map_err(|e| e.to_string())
}

/// 手动触发抽卡记录增量同步（从最新读到上次保存的最后一条为止，与旧记录合并）
#[tauri::command]
pub async fn sync_gacha_records(
    account_state: State<'_, Arc<Mutex<AccountService>>>,
    gacha_state: State<'_, Arc<GachaService>>,
    role_id: String,
) -> Result<serde_json::Value, String> {
    log_info!("sync_gacha_records: START for role_id={}", role_id);
    let account = account_state.lock().await;
    let config_service = account.get_config_service().clone();

    let (user_id, server_id, _u8token) = lookup_u8token(&config_service, &role_id).map_err(|e| {
        log_error!("sync_gacha_records: lookup failed: {}", e);
        e.to_string()
    })?;
    let u8token = ensure_fresh_u8token(&account, &config_service, &user_id, &role_id)
        .await
        .map_err(|e| e.to_string())?;

    let result = gacha_state
        .sync_records(&user_id, &server_id, &u8token)
        .await
        .map_err(|e| {
            log_error!("sync_gacha_records: FAILED for role_id={}: {}", role_id, e);
            e.to_string()
        })?;

    log_info!("sync_gacha_records: SUCCESS for role_id={}", role_id);
    serde_json::to_value(result).map_err(|e| e.to_string())
}

/// 读取本地保存的抽卡记录（不请求网络）
#[tauri::command]
pub async fn get_saved_gacha_records(
    account_state: State<'_, Arc<Mutex<AccountService>>>,
    gacha_state: State<'_, Arc<GachaService>>,
    role_id: String,
) -> Result<serde_json::Value, String> {
    log_info!("get_saved_gacha_records: START for role_id={}", role_id);
    let account = account_state.lock().await;
    let config_service = account.get_config_service().clone();

    let (user_id, server_id, _) = lookup_u8token(&config_service, &role_id).map_err(|e| {
        log_error!("get_saved_gacha_records: lookup failed: {}", e);
        e.to_string()
    })?;

    let data = gacha_state
        .load_records_or_empty(&user_id, &server_id)
        .map_err(|e| {
            log_error!(
                "get_saved_gacha_records: FAILED for role_id={}: {}",
                role_id,
                e
            );
            e.to_string()
        })?;

    log_info!("get_saved_gacha_records: SUCCESS for role_id={}", role_id);
    serde_json::to_value(data).map_err(|e| e.to_string())
}

/// 解析抽卡记录六星角色的头像：
/// 1. 优先读取本地映射文件（gacha_avatar_map.json，与 app_config.json 同级）
/// 2. 缺失的通过 char_detail API 按名称匹配（gacha charName == 角色 name），取 avatarSqUrl
/// 3. 写回映射文件并返回完整映射
#[tauri::command]
pub async fn resolve_gacha_avatar_map(
    account_state: State<'_, Arc<Mutex<AccountService>>>,
    gacha_state: State<'_, Arc<GachaService>>,
    role_id: String,
) -> Result<serde_json::Value, String> {
    log_info!("resolve_gacha_avatar_map: START for role_id={}", role_id);
    let account = account_state.lock().await;
    let config_service = account.get_config_service().clone();

    let (user_id, server_id, _) = lookup_u8token(&config_service, &role_id).map_err(|e| {
        log_error!("resolve_gacha_avatar_map: lookup failed: {}", e);
        e.to_string()
    })?;

    let saved = gacha_state
        .load_records_or_empty(&user_id, &server_id)
        .map_err(|e| {
            log_error!("resolve_gacha_avatar_map: load records failed: {}", e);
            e.to_string()
        })?;

    // 收集所有六星记录的角色 id
    let mut needed: HashMap<String, String> = HashMap::new(); // charId -> 显示名（用于匹配）
    for rec in &saved.records {
        if rec.is_draw() && rec.rarity == Some(6) {
            if let Some(cid) = &rec.char_id {
                if cid.is_empty() {
                    continue;
                }
                let name = rec
                    .char_name
                    .clone()
                    .map(|n| n.trim().to_string())
                    .filter(|n| !n.is_empty())
                    .or_else(|| {
                        let n = rec.name_text.trim();
                        if n.is_empty() {
                            None
                        } else {
                            Some(n.to_string())
                        }
                    });
                needed.entry(cid.clone()).or_insert_with(|| name.unwrap_or_default());
            }
        }
    }

    let mut map = gacha_state.load_avatar_map();

    let missing: Vec<String> = needed
        .keys()
        .filter(|cid| !map.contains_key(*cid))
        .cloned()
        .collect();

    if !missing.is_empty() {
        // 非致命：先尝试刷新 cred，保证 char_detail 请求可用
        if let Err(e) = account.check_and_refresh_user_cred(&user_id).await {
            log_warn!(
                "resolve_gacha_avatar_map: cred refresh failed (non-fatal) for user {}: {}",
                user_id,
                e
            );
        }

        match account
            .query_role_data(&role_id, "char_detail", &["chars".to_string()])
            .await
        {
            Ok(result) => {
                // 构建 name -> avatarSqUrl 映射
                let mut name_to_avatar: HashMap<String, String> = HashMap::new();
                if let Some(chars) = result.get("chars").and_then(|v| v.as_array()) {
                    for char_item in chars {
                        let char_data = char_item.get("charData");
                        let (Some(name), Some(avatar)) = (
                            char_data.and_then(|d| d.get("name")).and_then(|v| v.as_str()),
                            char_data
                                .and_then(|d| d.get("avatarSqUrl"))
                                .and_then(|v| v.as_str()),
                        ) else {
                            continue;
                        };
                        if !name.trim().is_empty() && !avatar.trim().is_empty() {
                            name_to_avatar.insert(name.trim().to_string(), avatar.trim().to_string());
                        }
                    }
                }

                let mut resolved = 0usize;
                for cid in &missing {
                    let Some(display_name) = needed.get(cid) else {
                        continue;
                    };
                    if display_name.is_empty() {
                        continue;
                    }
                    if let Some(avatar) = name_to_avatar.get(display_name) {
                        map.insert(cid.clone(), avatar.clone());
                        resolved += 1;
                    }
                }
                log_info!(
                    "resolve_gacha_avatar_map: missing={} resolved={} total_map={}",
                    missing.len(),
                    resolved,
                    map.len()
                );

                if resolved > 0 {
                    if let Err(e) = gacha_state.save_avatar_map(&map) {
                        log_warn!("resolve_gacha_avatar_map: save map failed: {}", e);
                    }
                }
            }
            Err(e) => {
                log_warn!(
                    "resolve_gacha_avatar_map: char_detail query failed (non-fatal): {}",
                    e
                );
            }
        }
    } else {
        log_info!("resolve_gacha_avatar_map: all avatars already mapped");
    }

    serde_json::to_value(map).map_err(|e| e.to_string())
}

/// 获取本地抽卡记录统计（总数/按卡池/按稀有度/按角色）
#[tauri::command]
pub async fn get_gacha_record_stats(
    account_state: State<'_, Arc<Mutex<AccountService>>>,
    gacha_state: State<'_, Arc<GachaService>>,
    role_id: String,
) -> Result<serde_json::Value, String> {
    log_info!("get_gacha_record_stats: START for role_id={}", role_id);
    let account = account_state.lock().await;
    let config_service = account.get_config_service().clone();

    let (user_id, server_id, _) = lookup_u8token(&config_service, &role_id).map_err(|e| {
        log_error!("get_gacha_record_stats: lookup failed: {}", e);
        e.to_string()
    })?;

    let saved = gacha_state
        .load_records_or_empty(&user_id, &server_id)
        .map_err(|e| {
            log_error!(
                "get_gacha_record_stats: FAILED for role_id={}: {}",
                role_id,
                e
            );
            e.to_string()
        })?;
    let records = &saved.records;

    let by_pool: HashMap<String, usize> = GachaService::group_records_by_pool(records)
        .into_iter()
        .map(|(k, v)| (k, v.len()))
        .collect();

    let stats = serde_json::json!({
        "user_id": saved.user_id,
        "server_id": saved.server_id,
        "last_sync_time": saved.last_sync_time,
        "total_records": records.len(),
        "total_draws": records.iter().filter(|r| r.is_draw()).count(),
        "total_gifts": records.iter().filter(|r| r.is_gift()).count(),
        "by_pool": by_pool,
        "by_rarity": GachaService::count_by_rarity(records),
        "by_char": GachaService::count_by_char(records),
    });

    log_info!("get_gacha_record_stats: SUCCESS for role_id={}", role_id);
    Ok(stats)
}
