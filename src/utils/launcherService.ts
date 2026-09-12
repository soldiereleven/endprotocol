import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

// ========== Types ==========

export type GameChannel = "official" | "bilibili" | "global" | "google_play";

export interface GameStatus {
  is_installed: boolean;
  has_update: boolean;
  local_version: string | null;
  remote_version: string | null;
  has_preload: boolean;
  preload_version: string | null;
  preload_completed: boolean;
}

export interface RemotePackage {
  version: string;
  resource_base_url: string;
}

export interface DownloadProgress {
  downloaded: number;
  total: number;
  stage: string;
  current_file: string | null;
  file_index: number;
  file_count: number;
  verified_bytes: number;
}

export interface BackgroundMedia {
  url: string;
  media_type: "image" | "video";
}

export interface LauncherResult {
  success: boolean;
  message: string;
  version: string | null;
}

export interface PayloadState {
  channel: string;
  version: string;
  manifest_sha256: string;
  file_count: number;
  total_bytes: number;
  updated_at: string;
  preload_version: string | null;
  preload_completed: boolean;
}

export interface BannerItem {
  image_url: string;
  jump_url: string;
}

export interface AnnouncementItem {
  category: string;
  title: string;
  date: string;
  jump_url: string;
}

export interface LauncherNoticeContent {
  banners: BannerItem[];
  announcements: AnnouncementItem[];
}

// ========== API Calls ==========

export async function checkGameStatus(
  channel: GameChannel,
  installPath: string,
): Promise<GameStatus> {
  return invoke<GameStatus>("launcher_check_status", { channel, installPath });
}

export async function installOrUpdate(
  channel: GameChannel,
  installPath: string,
): Promise<LauncherResult> {
  return invoke<LauncherResult>("launcher_install_or_update", {
    channel,
    installPath,
  });
}

export async function verifyAndRepair(
  channel: GameChannel,
  installPath: string,
  maxConcurrent?: number,
  quick?: boolean,
): Promise<LauncherResult> {
  const result = await invoke<LauncherResult>("launcher_verify_and_repair", {
    channel,
    installPath,
    maxConcurrent: maxConcurrent ?? null,
    quick: quick ?? false,
  });
  if (!result.success) {
    throw result.message;
  }
  return result;
}

export async function getRemoteVersion(
  channel: GameChannel,
): Promise<RemotePackage> {
  return invoke<RemotePackage>("launcher_get_remote_version", { channel });
}

export async function getPayloadState(
  channel: GameChannel,
): Promise<PayloadState | null> {
  return invoke<PayloadState | null>("launcher_get_payload_state", { channel });
}

export async function cancelDownload(installPath?: string): Promise<void> {
  return invoke("launcher_cancel_download", { installPath: installPath ?? null });
}

export async function preloadDownload(
  channel: GameChannel,
  installPath: string,
  maxConcurrent?: number,
): Promise<LauncherResult> {
  return invoke<LauncherResult>("launcher_preload_download", {
    channel,
    installPath,
    maxConcurrent: maxConcurrent ?? null,
  });
}

export async function resetDownloadCancel(): Promise<void> {
  return invoke("launcher_reset_download_cancel");
}

export async function hasDownloadCache(installPath: string): Promise<boolean> {
  return invoke<boolean>("launcher_has_download_cache", { installPath });
}

export async function getBanners(
  channel: GameChannel,
): Promise<BannerItem[]> {
  return invoke<BannerItem[]>("launcher_get_banners", { channel });
}

export async function getAnnouncements(
  channel: GameChannel,
): Promise<AnnouncementItem[]> {
  return invoke<AnnouncementItem[]>("launcher_get_announcements", { channel });
}

export async function getNoticeContent(
  channel: GameChannel,
): Promise<LauncherNoticeContent> {
  return invoke<LauncherNoticeContent>("launcher_get_notice_content", {
    channel,
  });
}

export async function getBackgroundImage(
  channel: GameChannel,
): Promise<BackgroundMedia | null> {
  return invoke<BackgroundMedia | null>("launcher_get_background_image", {
    channel,
  });
}

export async function startGame(
  installPath: string,
  channel: GameChannel,
): Promise<LauncherResult> {
  return invoke<LauncherResult>("launcher_start_game", {
    installPath,
    channel,
  });
}

export async function browseFolder(): Promise<string | null> {
  return invoke<string | null>("launcher_browse_folder");
}

export async function checkExecutable(
  installPath: string,
  channel: GameChannel,
): Promise<boolean> {
  return invoke<boolean>("launcher_check_executable", {
    installPath,
    channel,
  });
}

export async function checkGameRunning(
  channel: GameChannel,
): Promise<boolean> {
  return invoke<boolean>("launcher_check_game_running", {
    channel,
  });
}

export async function killGame(
  channel: GameChannel,
): Promise<boolean> {
  return invoke<boolean>("launcher_kill_game", {
    channel,
  });
}

// ========== Event Listener ==========

export function onLauncherProgress(
  callback: (progress: DownloadProgress) => void,
): Promise<UnlistenFn> {
  return listen<DownloadProgress>("launcher-progress", (event) => {
    callback(event.payload);
  });
}

// ========== Helpers ==========

export const CHANNEL_LABELS: Record<GameChannel, Record<string, string>> = {
  official: { zh: "终末地 官服", en: "Endfield CN" },
  bilibili: { zh: "终末地 B服", en: "Endfield Bilibili" },
  global: { zh: "终末地 国际服", en: "Endfield Global" },
  google_play: { zh: "终末地 Google Play", en: "Endfield Google Play" },
};

export const ALL_CHANNELS: GameChannel[] = [
  "official",
  "bilibili",
  "global",
  "google_play",
];

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export const STAGE_LABELS: Record<string, Record<string, string>> = {
  checking: { zh: "检查中", en: "Checking" },
  comparing: { zh: "比较中", en: "Comparing" },
  downloading: { zh: "下载中", en: "Downloading" },
  verifying: { zh: "校验中", en: "Verifying" },
  repairing: { zh: "修复中", en: "Repairing" },
  applying: { zh: "应用中", en: "Applying" },
  completed: { zh: "已完成", en: "Completed" },
  error: { zh: "出错了", en: "Error" },
};
