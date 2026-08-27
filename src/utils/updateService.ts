import { check, type Update, type DownloadEvent } from "@tauri-apps/plugin-updater";
import { addMessage, type AppMessage } from "./messageStore";
import { pushGlobalAlert } from "@/components/ui/global-alert";
import logger from "./logger";

export interface UpdateInfo {
  currentVersion: string;
  newVersion: string;
  date?: string;
  body?: string;
}

export interface RemoteVersionState {
  version: string | null;
  date: string | null;
  body: string | null;
  checked: boolean;
  loading: boolean;
  error: boolean;
  hasUpdate: boolean;
}

let currentUpdate: Update | null = null;
let isDownloading = false;

let remoteState: RemoteVersionState = {
  version: null,
  date: null,
  body: null,
  checked: false,
  loading: false,
  error: false,
  hasUpdate: false,
};

let remoteListeners: Array<() => void> = [];

function emitRemoteChange() {
  remoteListeners.forEach((fn) => fn());
  window.dispatchEvent(new CustomEvent("remoteVersionChanged"));
}

export function getRemoteVersion(): RemoteVersionState {
  return remoteState;
}

export function subscribeRemoteVersion(fn: () => void): () => void {
  remoteListeners.push(fn);
  return () => {
    remoteListeners = remoteListeners.filter((l) => l !== fn);
  };
}

export function getCurrentUpdate(): Update | null {
  return currentUpdate;
}

export function getIsDownloading(): boolean {
  return isDownloading;
}

export async function checkForUpdates(): Promise<UpdateInfo | null> {
  try {
    logger.info("Checking for updates...", "Updater");
    const update = await check();

    if (!update) {
      logger.info("No updates available", "Updater");
      return null;
    }

    currentUpdate = update;

    const info: UpdateInfo = {
      currentVersion: update.currentVersion,
      newVersion: update.version,
      date: update.date,
      body: update.body,
    };

    logger.info(
      `Update available: ${info.currentVersion} -> ${info.newVersion}`,
      "Updater",
    );

    return info;
  } catch (error) {
    logger.error("Failed to check for updates: " + error, "Updater");
    return null;
  }
}

export async function fetchRemoteVersion(): Promise<void> {
  if (remoteState.loading) return;

  remoteState = { ...remoteState, loading: true, error: false };
  emitRemoteChange();

  try {
    const info = await checkForUpdates();
    if (info) {
      remoteState = {
        version: info.newVersion,
        date: info.date ?? null,
        body: info.body ?? null,
        checked: true,
        loading: false,
        error: false,
        hasUpdate: true,
      };
    } else {
      remoteState = {
        ...remoteState,
        checked: true,
        loading: false,
        hasUpdate: false,
      };
    }
  } catch {
    remoteState = {
      ...remoteState,
      loading: false,
      error: true,
      checked: true,
    };
  }

  emitRemoteChange();
}

export function addUpdateMessage(info: UpdateInfo): AppMessage {
  const dateStr = info.date
    ? new Date(info.date).toLocaleDateString()
    : "";

  const bodyParts: string[] = [];
  bodyParts.push(
    `v${info.currentVersion} → v${info.newVersion}`,
  );
  if (dateStr) bodyParts.push(dateStr);
  if (info.body) bodyParts.push(info.body);

  return addMessage({
    type: "urgent",
    title: `Update Available: v${info.newVersion}`,
    body: bodyParts.join(" · "),
    tag: "app-update",
    actions: [
      {
        label: "Update Now",
        variant: "primary",
        loadingLabel: "Updating...",
        onClick: async () => {
          await downloadAndInstall();
        },
      },
    ],
  });
}

export async function downloadAndInstall(): Promise<void> {
  if (!currentUpdate) {
    pushGlobalAlert("warning", "No update available");
    return;
  }

  if (isDownloading) return;
  isDownloading = true;

  try {
    logger.info("Starting update download...", "Updater");

    let contentLength = 0;
    let downloaded = 0;

    await currentUpdate.downloadAndInstall((event: DownloadEvent) => {
      switch (event.event) {
        case "Started":
          contentLength = event.data.contentLength ?? 0;
          logger.info(
            `Download started, size: ${(contentLength / 1024 / 1024).toFixed(1)}MB`,
            "Updater",
          );
          break;
        case "Progress":
          downloaded += event.data.chunkLength;
          if (contentLength > 0) {
            const pct = Math.round((downloaded / contentLength) * 100);
            logger.debug(`Download progress: ${pct}%`, "Updater");
          }
          break;
        case "Finished":
          logger.info("Download finished, installing...", "Updater");
          break;
      }
    });

    await currentUpdate.install();
    logger.info("Update installed successfully", "Updater");
    pushGlobalAlert("success", "Update installed! Restart to apply.");

    currentUpdate.close();
    currentUpdate = null;
  } catch (error) {
    logger.error("Update failed: " + error, "Updater");
    pushGlobalAlert("danger", "Update failed: " + String(error));
  } finally {
    isDownloading = false;
  }
}

export async function checkAndNotify(): Promise<void> {
  const info = await checkForUpdates();
  if (info) {
    addUpdateMessage(info);
  }
}
