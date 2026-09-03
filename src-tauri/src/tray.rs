use std::sync::Arc;
use tauri::{
    tray::{MouseButton, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager, Runtime,
};

use crate::services::config_service::ConfigService;

const TRAY_ID: &str = "main-tray";
const TRAY_PANEL_LABEL: &str = "tray-panel";

const PANEL_WIDTH: f64 = 260.0;
const PANEL_HEIGHT: f64 = 340.0;

/// Tray user info stored in config
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct TrayUserInfo {
    pub role_id: Option<String>,
    pub nickname: Option<String>,
    pub avatar: Option<String>,
    pub cur_stamina: Option<i64>,
    pub max_stamina: Option<i64>,
    pub max_ts: Option<i64>,
    pub daily_activation: Option<i32>,
    pub max_daily_activation: Option<i32>,
    pub weekly_score: Option<i32>,
    pub weekly_total: Option<i32>,
    pub bp_cur_level: Option<i32>,
    pub bp_max_level: Option<i32>,
}

/// Position and show the tray panel near the tray icon
fn show_panel_at_position<R: Runtime>(
    app: &tauri::AppHandle<R>,
    tray_pos: tauri::PhysicalPosition<f64>,
) {
    if let Some(panel) = app.get_webview_window(TRAY_PANEL_LABEL) {
        if panel.is_visible().unwrap_or(false) {
            let _ = panel.hide();
            return;
        }

        // Position above the tray icon
        let x = tray_pos.x - PANEL_WIDTH / 2.0;
        let y = tray_pos.y - PANEL_HEIGHT - 8.0;

        let _ = panel.set_position(tauri::Position::Physical(tauri::PhysicalPosition {
            x: x as i32,
            y: y as i32,
        }));
        let _ = panel.show();
        let _ = panel.set_focus();
    }
}

/// Setup the system tray
pub fn setup_tray<R: Runtime>(
    app: &tauri::AppHandle<R>,
    config_service: Arc<std::sync::Mutex<ConfigService>>,
) -> Result<(), Box<dyn std::error::Error>> {
    let user_info = {
        let config = config_service.lock().map_err(|e| e.to_string())?;
        config.get::<TrayUserInfo>("tray_user_info").unwrap_or_default()
    };

    let tooltip = user_info
        .nickname
        .as_deref()
        .unwrap_or("EndProtocol");

    let _tray = TrayIconBuilder::with_id(TRAY_ID)
        .icon(app.default_window_icon().unwrap().clone())
        .tooltip(tooltip)
        .show_menu_on_left_click(false)
        .on_tray_icon_event(|tray, event| {
            let app = tray.app_handle();
            match event {
                TrayIconEvent::DoubleClick {
                    button: MouseButton::Left,
                    ..
                } => {
                    // Left double-click → show main window
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.unminimize();
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                    // Also hide panel if open
                    let _ = hide_tray_panel(app);
                }
                TrayIconEvent::Click {
                    button: MouseButton::Right,
                    button_state: tauri::tray::MouseButtonState::Up,
                    position,
                    ..
                } => {
                    // Right click → show tray panel
                    show_panel_at_position(app, position);
                }
                _ => {}
            }
        })
        .build(app)?;

    Ok(())
}

/// Update the tray tooltip and notify the tray panel
pub fn update_tray_menu<R: Runtime>(
    app: &tauri::AppHandle<R>,
    user_info: &TrayUserInfo,
) -> Result<(), Box<dyn std::error::Error>> {
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        let tooltip = user_info
            .nickname
            .as_deref()
            .unwrap_or("EndProtocol");
        let _ = tray.set_tooltip(Some(tooltip));
    }

    if let Some(panel) = app.get_webview_window(TRAY_PANEL_LABEL) {
        let _ = panel.emit("tray-user-info-updated", user_info);
    }

    Ok(())
}

/// Show the tray panel (called from commands)
pub fn show_tray_panel<R: Runtime>(app: &tauri::AppHandle<R>) -> Result<(), String> {
    if let Some(panel) = app.get_webview_window(TRAY_PANEL_LABEL) {
        if panel.is_visible().unwrap_or(false) {
            panel.hide().map_err(|e| e.to_string())?;
        } else {
            panel.show().map_err(|e| e.to_string())?;
            panel.set_focus().map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

/// Hide the tray panel
pub fn hide_tray_panel<R: Runtime>(app: &tauri::AppHandle<R>) -> Result<(), String> {
    if let Some(panel) = app.get_webview_window(TRAY_PANEL_LABEL) {
        panel.hide().map_err(|e| e.to_string())?;
    }
    Ok(())
}
