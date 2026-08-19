use std::collections::HashMap;
use std::fs;
use std::sync::Arc;
use tauri::State;
use tokio::sync::Mutex;

use crate::services::account_service::AccountService;
use crate::services::network_service::NetworkService;
use crate::utils::paths;
use crate::{log_info, log_warn};

#[derive(serde::Serialize)]
pub struct DumpEntry {
    name: String,
    path: String,
    code: Option<i64>,
    message: Option<String>,
    catalog_count: usize,
    type_sub_count: usize,
    item_count: usize,
}

/// 调试命令：抓取 Wiki 目录各接口变体的原始响应并保存到 app data 的 wiki_debug 目录，
/// 用于核对返回结构与 items 是否为空。使用第一个可用账号的 cred/token。
#[tauri::command]
pub async fn debug_dump_wiki_catalogs(
    account_state: State<'_, Arc<Mutex<AccountService>>>,
) -> Result<Vec<DumpEntry>, String> {
    let account = account_state.lock().await;

    let accounts = account.get_accounts().await;
    let Some(acc) = accounts.iter().find(|a| {
        a.cred.is_some() && a.token.is_some() && a.user_id.is_some() && a.server_id.is_some()
    }) else {
        return Err("no account with cred/token found".to_string());
    };
    let (cred, token, user_id, server_id) = (
        acc.cred.clone().unwrap(),
        acc.token.clone().unwrap(),
        acc.user_id.clone().unwrap(),
        acc.server_id.clone().unwrap(),
    );

    if let Err(e) = account.check_and_refresh_user_cred(&user_id).await {
        log_warn!("debug_dump_wiki_catalogs: cred refresh failed (non-fatal): {}", e);
    }

    let network = account.get_network_service().clone();
    let dir = paths::app_data_dir()
        .map(|d| d.join("wiki_debug"))
        .map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;

    let variants: [(&str, &str); 4] = [
        ("wiki_catalog", "wiki_catalog"),
        ("wiki_catalog_char", "wiki_catalog_char"),
        ("wiki_catalog_weapon", "wiki_catalog_weapon"),
        ("wiki_catalog_no_online", "wiki_catalog_no_online"),
    ];

    let mut out = Vec::new();
    for (file_name, api_name) in variants {
        let mut entry = DumpEntry {
            name: api_name.to_string(),
            path: String::new(),
            code: None,
            message: None,
            catalog_count: 0,
            type_sub_count: 0,
            item_count: 0,
        };
        match network
            .query_role_data(&acc.id, api_name, &[], &cred, &token, &server_id, &user_id)
            .await
        {
            Ok(result) => {
                if let Some(raw) = result.get("__full__") {
                    entry.code = raw.get("code").and_then(|v| v.as_i64());
                    entry.message = raw
                        .get("message")
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string());
                    let mut item_count = 0usize;
                    let mut type_sub_count = 0usize;
                    if let Some(entries) = raw
                        .get("data")
                        .and_then(|d| d.get("catalog"))
                        .and_then(|c| c.as_array())
                    {
                        entry.catalog_count = entries.len();
                        for e in entries {
                            if let Some(subs) = e.get("typeSub").and_then(|ts| ts.as_array()) {
                                type_sub_count += subs.len();
                                for s in subs {
                                    if let Some(items) = s.get("items").and_then(|i| i.as_array()) {
                                        item_count += items.len();
                                    }
                                }
                            }
                        }
                    }
                    entry.type_sub_count = type_sub_count;
                    entry.item_count = item_count;

                    let path = dir.join(format!("{}.json", file_name));
                    let content = serde_json::to_string_pretty(raw).unwrap_or_default();
                    fs::write(&path, content).map_err(|e| e.to_string())?;
                    entry.path = path.to_string_lossy().to_string();
                    log_info!(
                        "debug_dump_wiki_catalogs: {} -> code={:?} catalogs={} subs={} items={} saved={}",
                        api_name,
                        entry.code,
                        entry.catalog_count,
                        entry.type_sub_count,
                        entry.item_count,
                        entry.path
                    );
                }
            }
            Err(e) => {
                log_warn!("debug_dump_wiki_catalogs: {} failed: {}", api_name, e);
                entry.message = Some(format!("query error: {}", e));
            }
        }
        out.push(entry);
    }

    Ok(out)
}

/// 调试命令：返回已保存的 wiki_debug 目录路径（供前端打开）
#[tauri::command]
pub async fn debug_wiki_debug_dir() -> Result<String, String> {
    paths::app_data_dir()
        .map(|d| d.join("wiki_debug").to_string_lossy().to_string())
        .map_err(|e| e.to_string())
}