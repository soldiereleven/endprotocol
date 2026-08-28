import { check, type Update, type DownloadEvent } from "@tauri-apps/plugin-updater";
import { invoke } from "@tauri-apps/api/core";
import { openPath } from "@tauri-apps/plugin-opener";
import { addMessage, type AppMessage } from "./messageStore";
import { pushGlobalAlert } from "@/components/ui/global-alert";
import { getConfig, setConfig } from "./configService";
import logger from "./logger";

// ============================================================================
// Types
// ============================================================================

export type UpdateChannel = "stable" | "preview";

export type UpdateStatus =
  | "idle"
  | "checking"
  | "available"
  | "not-available"
  | "error";

export type ChangelogStatus =
  | "idle"
  | "loading"
  | "success"
  | "failed"
  | "unavailable";

export type UpdateErrorCode =
  | "UPDATE_CHECK_FAILED"
  | "CHANGELOG_FETCH_FAILED"
  | "DOWNLOAD_FAILED"
  | "INSTALL_FAILED";

export interface UpdateInfo {
  currentVersion: string;
  newVersion: string;
  date?: string;
  body?: string;
}

export interface UpdateCheckResult {
  available: boolean;
  update: UpdateInfo | null;
  changelog: string | null;
  changelogStatus: ChangelogStatus;
  status: UpdateStatus;
  errorCode?: UpdateErrorCode;
  errorMessage?: string;
}

interface GitHubRelease {
  tag_name: string;
  prerelease: boolean;
  body: string;
  published_at: string;
  assets: Array<{ name: string; browser_download_url: string }>;
}

interface LatestJson {
  version: string;
  notes: string;
  pub_date: string;
  platforms: Record<
    string,
    {
      signature: string;
      url: string;
    }
  >;
}

interface ChangelogCacheEntry {
  changelog: string;
  timestamp: number;
}

// ============================================================================
// Constants
// ============================================================================

const REPO_OWNER = "soldiereleven";
const REPO_NAME = "endprotocol";
const GITHUB_API_BASE = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}`;
const CHANGELOG_CACHE_TTL = 30 * 1000; // 30 seconds
const CHANGELOG_CACHE_KEY_PREFIX = "changelog_cache_";

// ============================================================================
// State
// ============================================================================

let currentUpdate: Update | null = null;
let currentUpdateInfo: UpdateInfo | null = null;
let isDownloading = false;
let downloadProgress = 0;
let downloadTotal = 0;
let downloadAbortController: AbortController | null = null;
let currentChannel: UpdateChannel = "stable";
let previousChannel: UpdateChannel | null = null;
let channelSwitchDetected = false;
let changelogCache: Map<string, ChangelogCacheEntry> = new Map();
let status: UpdateStatus = "idle";
let listeners: Array<() => void> = [];

// ============================================================================
// SemVer Helpers
// ============================================================================

interface SemVer {
  major: number;
  minor: number;
  patch: number;
  prerelease: string[];
}

function parseSemVer(version: string): SemVer | null {
  const match = version.match(
    /^v?(\d+)\.(\d+)\.(\d+)(?:-([a-zA-Z0-9.]+))?$/,
  );
  if (!match) return null;

  const prerelease = match[4]
    ? match[4].split(".").map((p) => p.toLowerCase())
    : [];

  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
    prerelease,
  };
}

function compareSemVer(a: SemVer, b: SemVer): number {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  if (a.patch !== b.patch) return a.patch - b.patch;

  // No prerelease > has prerelease
  if (a.prerelease.length === 0 && b.prerelease.length > 0) return 1;
  if (a.prerelease.length > 0 && b.prerelease.length === 0) return -1;

  // Compare prerelease identifiers
  const maxLen = Math.max(a.prerelease.length, b.prerelease.length);
  for (let i = 0; i < maxLen; i++) {
    const aId = a.prerelease[i];
    const bId = b.prerelease[i];

    if (aId === undefined) return -1;
    if (bId === undefined) return 1;

    const aNum = /^\d+$/.test(aId) ? parseInt(aId, 10) : null;
    const bNum = /^\d+$/.test(bId) ? parseInt(bId, 10) : null;

    if (aNum !== null && bNum !== null) {
      if (aNum !== bNum) return aNum - bNum;
    } else {
      if (aId !== bId) return aId < bId ? -1 : 1;
    }
  }

  return 0;
}

function isPreviewChannel(version: string): boolean {
  const semver = parseSemVer(version);
  return semver !== null && semver.prerelease.length > 0;
}

function stripVPrefix(tag: string): string {
  return tag.startsWith("v") ? tag.slice(1) : tag;
}

/**
 * Determine the update channel from a version string.
 * - "1.2.0"      → "stable"
 * - "1.2.0-pre"  → "preview"
 * - "1.2.0-pre.1" → "preview"
 */
function channelFromVersion(version: string): UpdateChannel {
  return isPreviewChannel(version) ? "preview" : "stable";
}

/**
 * Check if two versions have the same base version (major.minor.patch),
 * ignoring the prerelease suffix.
 */
function hasSameBaseVersion(a: string, b: string): boolean {
  const aSemver = parseSemVer(a);
  const bSemver = parseSemVer(b);
  if (!aSemver || !bSemver) return false;
  return (
    aSemver.major === bSemver.major &&
    aSemver.minor === bSemver.minor &&
    aSemver.patch === bSemver.patch
  );
}

// ============================================================================
// GitHub API
// ============================================================================

async function fetchGitHubReleases(): Promise<GitHubRelease[]> {
  const response = await fetch(`${GITHUB_API_BASE}/releases?per_page=100`);

  if (!response.ok) {
    throw new Error(`GitHub API ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

async function fetchGitHubReleaseByTag(
  tag: string,
): Promise<GitHubRelease | null> {
  try {
    const response = await fetch(
      `${GITHUB_API_BASE}/releases/tags/${encodeURIComponent(tag)}`,
    );

    if (!response.ok) {
      return null;
    }

    return response.json();
  } catch {
    return null;
  }
}

// ============================================================================
// Changelog Cache
// ============================================================================

function getCacheKey(channel: UpdateChannel, version: string): string {
  return `${CHANGELOG_CACHE_KEY_PREFIX}${channel}_${version}`;
}

function getChangelogFromCache(
  channel: UpdateChannel,
  version: string,
): string | null {
  const key = getCacheKey(channel, version);
  const entry = changelogCache.get(key);

  if (!entry) return null;

  if (Date.now() - entry.timestamp > CHANGELOG_CACHE_TTL) {
    changelogCache.delete(key);
    return null;
  }

  return entry.changelog;
}

function setChangelogCache(
  channel: UpdateChannel,
  version: string,
  changelog: string,
): void {
  const key = getCacheKey(channel, version);
  changelogCache.set(key, { changelog, timestamp: Date.now() });
}

// ============================================================================
// Channel Switch Detection
// ============================================================================

/**
 * Detect if a channel switch requires an update that the standard SemVer
 * comparison would miss.
 *
 * Key scenarios:
 *   1. Preview → Stable:
 *      Local: 1.2.0-pre, Remote stable: 1.2.0
 *      Standard SemVer: 1.2.0 > 1.2.0-pre → plugin WOULD offer update ✓
 *
 *   2. Stable → Preview:
 *      Local: 1.2.0, Remote preview: 1.2.0-pre
 *      Standard SemVer: 1.2.0-pre < 1.2.0 → plugin would NOT offer update ✗
 *      We must detect this and offer the update manually.
 *
 *   3. Stable → Preview with newer version:
 *      Local: 1.2.0, Remote preview: 1.3.0-pre
 *      Standard SemVer: 1.3.0-pre < 1.2.0 → plugin would NOT offer update ✗
 *      (because prerelease < release even though 1.3 > 1.2)
 *      We must detect this and offer the update manually.
 */
function isChannelSwitchUpdateRequired(
  localVersion: string,
  remoteVersion: string,
  targetChannel: UpdateChannel,
): boolean {
  const localChannel = channelFromVersion(localVersion);
  const remoteChannel = channelFromVersion(remoteVersion);

  // If channels are the same, standard SemVer comparison is sufficient
  if (localChannel === remoteChannel) {
    return false;
  }

  // If remote channel doesn't match the target channel, not relevant
  if (remoteChannel !== targetChannel) {
    return false;
  }

  // Remote is on the target channel but local is not.
  // Any version difference means an update is required.
  return localVersion !== remoteVersion;
}

// ============================================================================
// Resolve Stable Release
// ============================================================================

async function resolveStableRelease(): Promise<Update | null> {
  logger.info("Resolving stable release...", "Updater");

  const update = await check();

  if (!update) {
    logger.info("No stable update available via Tauri updater", "Updater");

    // If we detected a channel switch, the standard check may have missed
    // an update. Do a manual check.
    if (channelSwitchDetected) {
      logger.info(
        "Channel switch detected, performing manual stable check...",
        "Updater",
      );

      const { getVersion } = await import("@tauri-apps/api/app");
      const localVersion = await getVersion();

      // Fetch latest stable release from GitHub
      let releases: GitHubRelease[];
      try {
        releases = await fetchGitHubReleases();
      } catch (error) {
        logger.error("Failed to fetch GitHub releases: " + error, "Updater");
        return null;
      }

      const stableReleases = releases.filter(
        (r) => !r.prerelease && r.tag_name.startsWith("v"),
      );

      if (stableReleases.length === 0) return null;

      // Sort by SemVer descending
      stableReleases.sort((a, b) => {
        const aVer = parseSemVer(stripVPrefix(a.tag_name));
        const bVer = parseSemVer(stripVPrefix(b.tag_name));
        if (!aVer || !bVer) return 0;
        return compareSemVer(bVer, aVer);
      });

      const latestStable = stableReleases[0];
      const remoteVersion = stripVPrefix(latestStable.tag_name);

      // Check if this is a channel-switch update
      if (
        isChannelSwitchUpdateRequired(localVersion, remoteVersion, "stable")
      ) {
        logger.info(
          `Channel switch update: ${localVersion} → ${remoteVersion}`,
          "Updater",
        );

        // Fetch latest.json for this release
        const latestJsonUrl = `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/download/${latestStable.tag_name}/latest.json`;

        try {
          const response = await fetch(latestJsonUrl);
          if (!response.ok) return null;
          const latestJson: LatestJson = await response.json();

          const platformKey = "windows-x86_64";
          const platformData = latestJson.platforms?.[platformKey];
          if (!platformData) return null;

          // Return a pseudo-Update object for the channel switch
          return {
            version: remoteVersion,
            currentVersion: localVersion,
            date: latestJson.pub_date,
            body: latestJson.notes,
            rawJson: latestJson,
          } as unknown as Update;
        } catch (error) {
          logger.error(
            "Failed to fetch stable latest.json for channel switch: " + error,
            "Updater",
          );
          return null;
        }
      }

      return null;
    }

    return null;
  }

  // Ensure the discovered version is actually stable (no prerelease)
  if (isPreviewChannel(update.version)) {
    logger.info(
      `Skipping preview version ${update.version} on stable channel`,
      "Updater",
    );
    return null;
  }

  return update;
}

// ============================================================================
// Resolve Preview Release
// ============================================================================

async function resolvePreviewRelease(): Promise<{
  update: UpdateInfo;
  installerUrl: string;
  signature: string;
} | null> {
  logger.info("Resolving preview release via GitHub API...", "Updater");

  let releases: GitHubRelease[];
  try {
    releases = await fetchGitHubReleases();
  } catch (error) {
    logger.error("Failed to fetch GitHub releases: " + error, "Updater");
    throw error;
  }

  // Filter to only prerelease versions with a v-prefixed tag
  const previewReleases = releases.filter(
    (r) => r.prerelease && r.tag_name.startsWith("v"),
  );

  if (previewReleases.length === 0) {
    logger.info("No preview releases found on GitHub", "Updater");
    return null;
  }

  // Sort by SemVer descending to find the latest preview
  previewReleases.sort((a, b) => {
    const aVer = parseSemVer(stripVPrefix(a.tag_name));
    const bVer = parseSemVer(stripVPrefix(b.tag_name));
    if (!aVer || !bVer) return 0;
    return compareSemVer(bVer, aVer);
  });

  const latestPreview = previewReleases[0];
  const previewVersion = stripVPrefix(latestPreview.tag_name);

  logger.info(`Latest preview version: ${previewVersion}`, "Updater");

  // Fetch latest.json from the preview release
  const latestJsonUrl = `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/download/${latestPreview.tag_name}/latest.json`;

  let latestJson: LatestJson;
  try {
    const response = await fetch(latestJsonUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch latest.json: ${response.status}`);
    }
    latestJson = await response.json();
  } catch (error) {
    logger.error("Failed to fetch preview latest.json: " + error, "Updater");
    throw error;
  }

  // Get the Windows x64 platform data
  const platformKey = "windows-x86_64";
  const platformData = latestJson.platforms?.[platformKey];

  if (!platformData) {
    logger.error(
      `No platform data for ${platformKey} in preview latest.json`,
      "Updater",
    );
    return null;
  }

  // Get current version
  const { getVersion } = await import("@tauri-apps/api/app");
  const currentVersion = await getVersion();

  // Compare versions
  const currentSemver = parseSemVer(currentVersion);
  const latestSemver = parseSemVer(latestJson.version);

  if (!currentSemver || !latestSemver) {
    logger.error("Failed to parse versions for comparison", "Updater");
    return null;
  }

  const standardComparison = compareSemVer(latestSemver, currentSemver);

  // Standard case: remote is strictly newer
  if (standardComparison > 0) {
    return {
      update: {
        currentVersion,
        newVersion: latestJson.version,
        date: latestJson.pub_date,
        body: latestJson.notes,
      },
      installerUrl: platformData.url,
      signature: platformData.signature,
    };
  }

  // Channel switch case: remote version is different from local
  // even if not strictly "newer" in SemVer terms
  if (
    standardComparison === 0 &&
    channelSwitchDetected &&
    isChannelSwitchUpdateRequired(currentVersion, latestJson.version, "preview")
  ) {
    logger.info(
      `Channel switch update: ${currentVersion} → ${latestJson.version}`,
      "Updater",
    );

    return {
      update: {
        currentVersion,
        newVersion: latestJson.version,
        date: latestJson.pub_date,
        body: latestJson.notes,
      },
      installerUrl: platformData.url,
      signature: platformData.signature,
    };
  }

  // Also handle case where preview version has same base but prerelease suffix
  // e.g., local 1.2.0 → remote 1.2.0-pre (same base, different channel)
  if (
    hasSameBaseVersion(currentVersion, latestJson.version) &&
    channelSwitchDetected &&
    isChannelSwitchUpdateRequired(currentVersion, latestJson.version, "preview")
  ) {
    logger.info(
      `Channel switch update (same base): ${currentVersion} → ${latestJson.version}`,
      "Updater",
    );

    return {
      update: {
        currentVersion,
        newVersion: latestJson.version,
        date: latestJson.pub_date,
        body: latestJson.notes,
      },
      installerUrl: platformData.url,
      signature: platformData.signature,
    };
  }

  logger.info(
    `Preview version ${latestJson.version} is not newer than ${currentVersion}`,
    "Updater",
  );
  return null;
}

// ============================================================================
// Preview Update Download & Install
// ============================================================================

async function downloadPreviewUpdate(
  installerUrl: string,
  signature: string,
  signal?: AbortSignal,
): Promise<void> {
  logger.info("Downloading preview update installer...", "Updater");

  // Get temp directory
  const tempDir: string = await invoke("get_temp_dir");

  // Extract filename from URL
  const urlParts = installerUrl.split("/");
  const filename = urlParts[urlParts.length - 1];
  const installerPath = `${tempDir}\\${filename}`;
  const signaturePath = `${installerPath}.sig`;

  // Download installer with progress tracking
  const installerResponse = await fetch(installerUrl, { signal });
  if (!installerResponse.ok) {
    throw new Error(
      `Failed to download installer: ${installerResponse.status}`,
    );
  }

  const contentLength = Number(installerResponse.headers.get("content-length")) || 0;
  downloadTotal = contentLength;
  downloadProgress = 0;
  emitChange();

  const reader = installerResponse.body?.getReader();
  if (!reader) {
    throw new Error("Failed to read response body");
  }

  const chunks: Uint8Array[] = [];
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    downloadProgress = received;
    emitChange();
  }

  const installerData = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    installerData.set(chunk, offset);
    offset += chunk.length;
  }

  await invoke("write_file", { path: installerPath, data: Array.from(installerData) });
  logger.info(`Installer saved to: ${installerPath}`, "Updater");

  // Save signature file
  const signatureData = new TextEncoder().encode(signature);
  await invoke("write_file", { path: signaturePath, data: Array.from(signatureData) });
  logger.info(`Signature saved to: ${signaturePath}`, "Updater");

  // Open the installer with the system's default handler
  await openPath(installerPath);
  logger.info("Installer launched", "Updater");
}

// ============================================================================
// Changelog Fetching
// ============================================================================

async function fetchChangelog(
  channel: UpdateChannel,
  version: string,
  tag: string,
): Promise<{ changelog: string | null; status: ChangelogStatus }> {
  // Check cache first
  const cached = getChangelogFromCache(channel, version);
  if (cached !== null) {
    logger.debug(`Changelog cache hit for ${tag}`, "Updater");
    return { changelog: cached, status: "success" };
  }

  logger.info(`Fetching changelog for ${tag}...`, "Updater");

  // Strategy 1: Try to get changelog from GitHub Release body
  try {
    const release = await fetchGitHubReleaseByTag(tag);

    if (release?.body && release.body.trim().length > 0) {
      logger.info("Changelog fetched from Release body", "Updater");
      setChangelogCache(channel, version, release.body);
      return { changelog: release.body, status: "success" };
    }
  } catch (error) {
    logger.warn(
      "Failed to fetch changelog from Release body: " + error,
      "Updater",
    );
  }

  // Strategy 2: Try to download CHANGELOG.md from release assets
  try {
    const assetUrl = `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/download/${tag}/CHANGELOG.md`;
    const response = await fetch(assetUrl);

    if (response.ok) {
      const text = await response.text();
      if (text.trim().length > 0) {
        logger.info("Changelog fetched from Release asset", "Updater");
        setChangelogCache(channel, version, text);
        return { changelog: text, status: "success" };
      }
    }
  } catch (error) {
    logger.warn(
      "Failed to fetch changelog from Release asset: " + error,
      "Updater",
    );
  }

  // All strategies failed
  logger.warn(`Changelog not available for ${tag}`, "Updater");
  return { changelog: null, status: "failed" };
}

// ============================================================================
// Core Update Logic
// ============================================================================

async function performUpdateCheck(): Promise<UpdateCheckResult> {
  const channel = currentChannel;

  logger.info(`Checking for updates on ${channel} channel...`, "Updater");

  if (channel === "stable") {
    // Stable channel: use Tauri updater plugin + channel-switch fallback
    let update: Update | null;

    try {
      update = await resolveStableRelease();
    } catch (error) {
      logger.error("Stable update check failed: " + error, "Updater");
      return {
        available: false,
        update: null,
        changelog: null,
        changelogStatus: "unavailable",
        status: "error",
        errorCode: "UPDATE_CHECK_FAILED",
        errorMessage: String(error),
      };
    }

    if (!update) {
      return {
        available: false,
        update: null,
        changelog: null,
        changelogStatus: "unavailable",
        status: "not-available",
      };
    }

    const updateInfo: UpdateInfo = {
      currentVersion: update.currentVersion,
      newVersion: update.version,
      date: update.date,
      body: update.body,
    };

    currentUpdate = update;
    currentUpdateInfo = updateInfo;

    // Fetch changelog separately (must not block update)
    let changelog: string | null = null;
    let changelogStatus: ChangelogStatus = "loading";

    try {
      const tag = `v${update.version}`;
      const result = await fetchChangelog(channel, update.version, tag);
      changelog = result.changelog;
      changelogStatus = result.status;
    } catch (error) {
      logger.error("Changelog fetch error: " + error, "Updater");
      changelogStatus = "failed";
    }

    return {
      available: true,
      update: updateInfo,
      changelog,
      changelogStatus,
      status: "available",
    };
  } else {
    // Preview channel: manual resolution via GitHub API
    let previewResult;

    try {
      previewResult = await resolvePreviewRelease();
    } catch (error) {
      logger.error("Preview update check failed: " + error, "Updater");
      return {
        available: false,
        update: null,
        changelog: null,
        changelogStatus: "unavailable",
        status: "error",
        errorCode: "UPDATE_CHECK_FAILED",
        errorMessage: String(error),
      };
    }

    if (!previewResult) {
      return {
        available: false,
        update: null,
        changelog: null,
        changelogStatus: "unavailable",
        status: "not-available",
      };
    }

    const { update: updateInfo, installerUrl, signature } = previewResult;

    // Store preview update metadata for later download/install
    currentUpdateInfo = updateInfo;
    previewUpdateData = { installerUrl, signature };

    // Fetch changelog separately (must not block update)
    let changelog: string | null = null;
    let changelogStatus: ChangelogStatus = "loading";

    try {
      const tag = `v${updateInfo.newVersion}`;
      const result = await fetchChangelog(channel, updateInfo.newVersion, tag);
      changelog = result.changelog;
      changelogStatus = result.status;
    } catch (error) {
      logger.error("Changelog fetch error: " + error, "Updater");
      changelogStatus = "failed";
    }

    return {
      available: true,
      update: updateInfo,
      changelog,
      changelogStatus,
      status: "available",
    };
  }
}

// Preview update metadata (stored for download/install)
let previewUpdateData: {
  installerUrl: string;
  signature: string;
} | null = null;

// ============================================================================
// Public API
// ============================================================================

export function getChannel(): UpdateChannel {
  return currentChannel;
}

export async function setChannel(channel: UpdateChannel): Promise<void> {
  if (currentChannel === channel) return;

  // Save previous channel for channel-switch detection
  previousChannel = currentChannel;
  channelSwitchDetected = true;

  currentChannel = channel;
  await setConfig("update_channel", channel);

  // Clear current state
  currentUpdate = null;
  currentUpdateInfo = null;
  previewUpdateData = null;
  changelogCache.clear();
  status = "idle";

  // Reset legacy remote version state so UI doesn't show stale data
  remoteState = {
    version: null,
    date: null,
    body: null,
    checked: false,
    loading: false,
    error: false,
    hasUpdate: false,
  };
  emitRemoteChange();

  logger.info(
    `Update channel set to: ${channel} (previous: ${previousChannel})`,
    "Updater",
  );
  emitChange();

  // Re-check with new channel (channel-switch detection is active)
  const result = await checkForUpdate();

  // Sync result into legacy remoteState so UI reflects the new channel
  if (result.available && result.update) {
    remoteState = {
      version: result.update.newVersion,
      date: result.update.date ?? null,
      body: result.changelog ?? result.update.body ?? null,
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
  emitRemoteChange();

  // Clear channel switch flag after check completes
  channelSwitchDetected = false;
  previousChannel = null;
}

export async function initializeChannel(): Promise<void> {
  try {
    const saved = await getConfig<UpdateChannel>("update_channel");
    if (saved === "stable" || saved === "preview") {
      currentChannel = saved;
    }
  } catch {
    // Use default
  }
  logger.info(`Initialized update channel: ${currentChannel}`, "Updater");
}

export async function checkForUpdate(): Promise<UpdateCheckResult> {
  status = "checking";
  emitChange();

  const result = await performUpdateCheck();

  status = result.status;
  emitChange();

  return result;
}

export function getCurrentUpdate(): Update | null {
  return currentUpdate;
}

export function getCurrentUpdateInfo(): UpdateInfo | null {
  return currentUpdateInfo;
}

export function getStatus(): UpdateStatus {
  return status;
}

export function getIsDownloading(): boolean {
  return isDownloading;
}

export function getDownloadProgress(): number {
  return downloadProgress;
}

export function getDownloadTotal(): number {
  return downloadTotal;
}

export async function downloadAndInstall(): Promise<void> {
  if (currentChannel === "preview" && previewUpdateData) {
    // Preview channel: manual download and install
    if (isDownloading) return;
    isDownloading = true;
    downloadProgress = 0;
    downloadTotal = 0;
    const controller = new AbortController();
    downloadAbortController = controller;
    emitChange();

    try {
      logger.info("Starting preview update download...", "Updater");
      await downloadPreviewUpdate(
        previewUpdateData.installerUrl,
        previewUpdateData.signature,
        controller.signal,
      );
      logger.info("Preview update installer launched", "Updater");
      pushGlobalAlert(
        "success",
        "Installer launched. Follow the installer prompts to complete the update.",
      );

      currentUpdateInfo = null;
      previewUpdateData = null;
    } catch (error) {
      if (controller.signal.aborted) {
        logger.info("Preview download cancelled", "Updater");
        return;
      }
      logger.error("Preview update failed: " + error, "Updater");
      pushGlobalAlert("danger", "Update failed: " + String(error));
    } finally {
      isDownloading = false;
      downloadAbortController = null;
      downloadProgress = 0;
      downloadTotal = 0;
      emitChange();
    }
  } else if (currentUpdate) {
    // Stable channel: use Tauri updater plugin
    if (isDownloading) return;
    isDownloading = true;
    downloadProgress = 0;
    downloadTotal = 0;
    const controller = new AbortController();
    downloadAbortController = controller;
    emitChange();

    try {
      logger.info("Starting update download...", "Updater");

      let contentLength = 0;
      let downloaded = 0;

      await currentUpdate.downloadAndInstall((event: DownloadEvent) => {
        if (controller.signal.aborted) return;
        switch (event.event) {
          case "Started":
            contentLength = event.data.contentLength ?? 0;
            downloadTotal = contentLength;
            downloadProgress = 0;
            emitChange();
            logger.info(
              `Download started, size: ${(contentLength / 1024 / 1024).toFixed(1)}MB`,
              "Updater",
            );
            break;
          case "Progress":
            downloaded += event.data.chunkLength;
            downloadProgress = downloaded;
            emitChange();
            if (contentLength > 0) {
              const pct = Math.round((downloaded / contentLength) * 100);
              logger.debug(`Download progress: ${pct}%`, "Updater");
            }
            break;
          case "Finished":
            downloadProgress = downloadTotal;
            emitChange();
            logger.info("Download finished, installing...", "Updater");
            break;
        }
      });

      if (controller.signal.aborted) {
        logger.info("Stable download cancelled", "Updater");
        return;
      }

      await currentUpdate.install();
      logger.info("Update installed successfully", "Updater");
      pushGlobalAlert("success", "Update installed! Restart to apply.");

      currentUpdate.close();
      currentUpdate = null;
      currentUpdateInfo = null;
    } catch (error) {
      if (controller.signal.aborted) {
        logger.info("Stable download cancelled", "Updater");
        return;
      }
      logger.error("Update failed: " + error, "Updater");
      pushGlobalAlert("danger", "Update failed: " + String(error));
    } finally {
      isDownloading = false;
      downloadAbortController = null;
    }
  } else {
    pushGlobalAlert("warning", "No update available");
  }
}

export function cancelDownload(): void {
  if (downloadAbortController) {
    downloadAbortController.abort();
    downloadAbortController = null;
    isDownloading = false;
    downloadProgress = 0;
    downloadTotal = 0;
    emitChange();
    logger.info("Download cancelled by user", "Updater");
  }
}

// ============================================================================
// Subscription System
// ============================================================================

function emitChange() {
  listeners.forEach((fn) => fn());
  window.dispatchEvent(new CustomEvent("remoteVersionChanged"));
}

export function subscribeUpdateState(fn: () => void): () => void {
  listeners.push(fn);
  return () => {
    listeners = listeners.filter((l) => l !== fn);
  };
}

export function subscribeDownloadProgress(fn: () => void): () => void {
  listeners.push(fn);
  return () => {
    listeners = listeners.filter((l) => l !== fn);
  };
}

// Legacy API - for backward compatibility
export interface RemoteVersionState {
  version: string | null;
  date: string | null;
  body: string | null;
  checked: boolean;
  loading: boolean;
  error: boolean;
  hasUpdate: boolean;
}

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

export async function fetchRemoteVersion(): Promise<void> {
  if (remoteState.loading) return;

  remoteState = { ...remoteState, loading: true, error: false };
  emitRemoteChange();

  try {
    const result = await checkForUpdate();
    if (result.available && result.update) {
      remoteState = {
        version: result.update.newVersion,
        date: result.update.date ?? null,
        body: result.changelog ?? result.update.body ?? null,
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
  bodyParts.push(`v${info.currentVersion} → v${info.newVersion}`);
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

export async function checkAndNotify(): Promise<void> {
  await initializeChannel();
  const result = await checkForUpdate();
  if (result.available && result.update) {
    addUpdateMessage(result.update);
  }
}
