use std::sync::Arc;
use tauri::State;
use tokio::sync::Mutex;

use crate::services::account_service::AccountService;
use serde_json::Value;

/// 获取卡片配置
#[tauri::command]
pub async fn get_card_settings(
    state: State<'_, Arc<Mutex<AccountService>>>,
    card_id: String,
) -> Result<Value, String> {
    let service = state.lock().await;
    let config = service.get_config_service();
    let config_guard = config.lock().unwrap();

    // 从 card_settings.{card_id} 获取配置
    let config_key = format!("card_settings.{}", card_id);
    let settings: Option<Value> = config_guard.get(&config_key);

    Ok(settings.unwrap_or(Value::Object(serde_json::Map::new())))
}

/// 保存卡片配置（合并更新）
#[tauri::command]
pub async fn save_card_settings(
    state: State<'_, Arc<Mutex<AccountService>>>,
    card_id: String,
    settings: Value,
) -> Result<bool, String> {
    let service = state.lock().await;
    let config = service.get_config_service();
    let mut config_guard = config.lock().unwrap();

    let config_key = format!("card_settings.{}", card_id);

    // 获取现有配置
    let existing: Option<Value> = config_guard.get(&config_key);

    // 合并配置
    let merged = match existing {
        Some(mut existing_val) => {
            if let (Some(existing_obj), Some(new_obj)) =
                (existing_val.as_object_mut(), settings.as_object())
            {
                for (key, value) in new_obj {
                    existing_obj.insert(key.clone(), value.clone());
                }
                existing_val
            } else {
                settings
            }
        }
        None => settings,
    };

    config_guard
        .set(config_key, merged)
        .map_err(|e| e.to_string())?;

    Ok(true)
}

/// 删除卡片配置
#[tauri::command]
pub async fn remove_card_settings(
    state: State<'_, Arc<Mutex<AccountService>>>,
    card_id: String,
) -> Result<bool, String> {
    let service = state.lock().await;
    let config = service.get_config_service();
    let mut config_guard = config.lock().unwrap();

    let config_key = format!("card_settings.{}", card_id);
    let removed = config_guard.remove(&config_key);

    Ok(removed)
}
