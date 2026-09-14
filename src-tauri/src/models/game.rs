use serde::{Deserialize, Serialize};

/// 游戏渠道
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum GameChannel {
    /// 国服官服
    #[serde(rename = "official")]
    Official,
    /// 国服B服
    #[serde(rename = "bilibili")]
    Bilibili,
    /// 国际服
    #[serde(rename = "global")]
    Global,
    /// 国际服 Google Play
    #[serde(rename = "google_play")]
    GooglePlay,
}

impl GameChannel {
    pub fn as_str(&self) -> &'static str {
        match self {
            GameChannel::Official => "official",
            GameChannel::Bilibili => "bilibili",
            GameChannel::Global => "global",
            GameChannel::GooglePlay => "google_play",
        }
    }

    /// 返回 API URL
    pub fn api_url(&self) -> &'static str {
        match self {
            GameChannel::Official | GameChannel::Bilibili => {
                "https://launcher.hypergryph.com/api/proxy/batch_proxy"
            }
            GameChannel::Global | GameChannel::GooglePlay => {
                "https://launcher.gryphline.com/api/proxy/batch_proxy"
            }
        }
    }

    /// 返回 Web API URL (用于公告/背景图)
    pub fn web_api_url(&self) -> &'static str {
        match self {
            GameChannel::Official | GameChannel::Bilibili => {
                "https://launcher.hypergryph.com/api/proxy/web/batch_proxy"
            }
            GameChannel::Global | GameChannel::GooglePlay => {
                "https://launcher.gryphline.com/api/proxy/web/batch_proxy"
            }
        }
    }

    /// 返回 appcode
    pub fn app_code(&self) -> &'static str {
        match self {
            GameChannel::Official | GameChannel::Bilibili => "6LL0KJuqHBVz33WK",
            GameChannel::Global | GameChannel::GooglePlay => "YDUTE5gscDZ229CW",
        }
    }

    /// 返回 launcher_appcode
    pub fn launcher_app_code(&self) -> &'static str {
        match self {
            GameChannel::Official | GameChannel::Bilibili => "abYeZZ16BPluCFyT",
            GameChannel::Global | GameChannel::GooglePlay => "YDUTE5gscDZ229CW",
        }
    }

    /// 返回 channel
    pub fn channel(&self) -> &'static str {
        match self {
            GameChannel::Official => "1",
            GameChannel::Bilibili => "2",
            GameChannel::Global => "6",
            GameChannel::GooglePlay => "6",
        }
    }

    /// 返回 sub_channel
    pub fn sub_channel(&self) -> &'static str {
        match self {
            GameChannel::Official => "1",
            GameChannel::Bilibili => "2",
            GameChannel::Global => "6",
            GameChannel::GooglePlay => "802",
        }
    }

    /// 返回 seq
    pub fn seq(&self) -> &'static str {
        match self {
            GameChannel::Official | GameChannel::Bilibili => "5",
            GameChannel::Global | GameChannel::GooglePlay => "3",
        }
    }

    /// 游戏可执行文件名
    pub fn executable_name(&self) -> &'static str {
        "Endfield.exe"
    }

    /// 进程名（用于 tasklist/taskkill）
    pub fn process_name(&self) -> &'static str {
        "Endfield.exe"
    }

    pub fn display_name(&self) -> &'static str {
        match self {
            GameChannel::Official => "终末地 官服",
            GameChannel::Bilibili => "终末地 B服",
            GameChannel::Global => "Endfield Global",
            GameChannel::GooglePlay => "Endfield Google Play",
        }
    }
}

/// 游戏安装状态
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameStatus {
    pub is_installed: bool,
    pub has_update: bool,
    pub local_version: Option<String>,
    pub remote_version: Option<String>,
    pub has_preload: bool,
    pub preload_version: Option<String>,
    pub preload_completed: bool,
}

/// API 响应结构
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchProxyResponse {
    pub proxy_rsps: Vec<ProxyResponse>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProxyResponse {
    pub kind: String,
    #[serde(rename = "get_latest_game_rsp", skip_serializing_if = "Option::is_none")]
    pub get_latest_game_rsp: Option<GetLatestGameRsp>,
    #[serde(rename = "get_banner_rsp", skip_serializing_if = "Option::is_none")]
    pub get_banner_rsp: Option<BannerRsp>,
    #[serde(rename = "get_announcement_rsp", skip_serializing_if = "Option::is_none")]
    pub get_announcement_rsp: Option<AnnouncementRsp>,
    #[serde(rename = "get_main_bg_image_rsp", skip_serializing_if = "Option::is_none")]
    pub get_main_bg_image_rsp: Option<MainBgImageRsp>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetLatestGameRsp {
    pub version: String,
    #[serde(default)]
    pub pkg: Option<PkgInfo>,
    #[serde(default, rename = "preload_version")]
    pub preload_version: Option<String>,
    #[serde(default, rename = "preload_pkg")]
    pub preload_pkg: Option<PkgInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PkgInfo {
    pub file_path: String,
}

/// 清单文件条目（解密后的 NDJSON 格式）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ManifestFile {
    pub path: String,
    pub md5: String,
    pub size: i64,
}

/// 游戏包信息（含版本和资源地址）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemotePackage {
    pub version: String,
    pub resource_base_url: String,
    pub has_preload: bool,
    pub preload_version: Option<String>,
    pub preload_resource_url: Option<String>,
}

/// 下载进度
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadProgress {
    pub downloaded: u64,
    pub total: u64,
    pub stage: String,
    pub current_file: Option<String>,
    pub file_index: usize,
    pub file_count: usize,
    #[serde(default)]
    pub verified_bytes: u64,
}

impl Default for DownloadProgress {
    fn default() -> Self {
        Self {
            downloaded: 0,
            total: 0,
            stage: String::new(),
            current_file: None,
            file_index: 0,
            file_count: 0,
            verified_bytes: 0,
        }
    }
}

/// 安装/更新阶段
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum InstallStage {
    #[serde(rename = "checking")]
    Checking,
    #[serde(rename = "comparing")]
    Comparing,
    #[serde(rename = "downloading")]
    Downloading,
    #[serde(rename = "verifying")]
    Verifying,
    #[serde(rename = "repairing")]
    Repairing,
    #[serde(rename = "applying")]
    Applying,
    #[serde(rename = "completed")]
    Completed,
    #[serde(rename = "error")]
    Error,
}

impl InstallStage {
    pub fn as_str(&self) -> &'static str {
        match self {
            InstallStage::Checking => "checking",
            InstallStage::Comparing => "comparing",
            InstallStage::Downloading => "downloading",
            InstallStage::Verifying => "verifying",
            InstallStage::Repairing => "repairing",
            InstallStage::Applying => "applying",
            InstallStage::Completed => "completed",
            InstallStage::Error => "error",
        }
    }
}

/// 清单比较结果：需要下载的文件
#[derive(Debug, Clone)]
pub struct FilePlan {
    pub manifest: ManifestFile,
    pub source_path: Option<String>, // 本地已有的匹配文件路径
}

/// 持久化的 payload 状态
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PayloadState {
    pub channel: String,
    pub version: String,
    pub manifest_sha256: String,
    pub file_count: usize,
    pub total_bytes: u64,
    pub updated_at: String,
    #[serde(default)]
    pub preload_version: Option<String>,
    #[serde(default)]
    pub preload_completed: bool,
}

/// 安装/更新操作结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LauncherResult {
    pub success: bool,
    pub message: String,
    pub version: Option<String>,
}

// ========== Banner / Announcement / Background ==========

/// Banner 条目
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BannerItem {
    pub image_url: String,
    pub jump_url: String,
}

/// 公告条目
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnnouncementItem {
    pub category: String,
    pub title: String,
    pub date: String,
    pub jump_url: String,
}

/// 公告内容（含 Banner + 公告列表）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LauncherNoticeContent {
    pub banners: Vec<BannerItem>,
    pub announcements: Vec<AnnouncementItem>,
}

/// Banner API 响应
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BannerRsp {
    #[serde(default)]
    pub banners: Vec<BannerRspItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BannerRspItem {
    pub url: String,
    pub jump_url: String,
}

/// 公告 API 响应
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnnouncementRsp {
    #[serde(default)]
    pub tabs: Vec<AnnouncementTab>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnnouncementTab {
    #[serde(rename = "tabName", default)]
    pub tab_name: String,
    #[serde(default)]
    pub announcements: Vec<AnnouncementApiItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnnouncementApiItem {
    #[serde(default)]
    pub content: String,
    #[serde(rename = "start_ts", default)]
    pub start_ts: Option<String>,
    #[serde(rename = "jump_url", default)]
    pub jump_url: Option<String>,
}

/// 背景图 API 响应
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MainBgImageRsp {
    #[serde(rename = "main_bg_image", default)]
    pub main_bg_image: Option<MainBgImageData>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MainBgImageData {
    pub url: String,
}

/// 背景图信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackgroundImage {
    pub url: String,
}

/// 启动器背景媒体（图片或视频）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackgroundMedia {
    pub url: String,
    pub media_type: String,
}

/// 安装目录扫描结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileScanResult {
    /// 渠道是否已识别
    pub channel_detected: bool,
    /// 识别到的渠道
    pub detected_channel: Option<String>,
    /// 清单中的总文件数
    pub total_files: usize,
    /// 已存在且完整的文件数
    pub valid_files: usize,
    /// 已存在但损坏的文件数
    pub corrupted_files: usize,
    /// 不存在的文件数
    pub missing_files: usize,
    /// 已存在文件的总字节数
    pub existing_bytes: u64,
    /// 需要下载的总字节数
    pub download_bytes: u64,
    /// 损坏的文件路径列表（最多20条）
    pub corrupted_file_list: Vec<String>,
    /// 不存在的文件路径列表（最多20条）
    pub missing_file_list: Vec<String>,
}
