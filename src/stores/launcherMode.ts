export type LauncherViewMode = "data" | "game";

const STORAGE_KEY = "launcher_view_mode";

let currentMode: LauncherViewMode = (() => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "data" || stored === "game") return stored;
  } catch {}
  return "data";
})();

let listeners: Array<() => void> = [];

function emit() {
  listeners.forEach((fn) => fn());
}

export function getLauncherMode(): LauncherViewMode {
  return currentMode;
}

export function setLauncherMode(mode: LauncherViewMode) {
  if (currentMode === mode) return;
  currentMode = mode;
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {}
  emit();
}

export function isGameMode(): boolean {
  return currentMode === "game";
}

export function subscribeLauncherMode(fn: () => void): () => void {
  listeners.push(fn);
  return () => {
    listeners = listeners.filter((l) => l !== fn);
  };
}

// ========== Background media store ==========
export interface LauncherBgMedia {
  url: string;
  media_type: "image" | "video";
}

let currentBgMedia: LauncherBgMedia | null = null;
let bgListeners: Array<() => void> = [];

function emitBg() {
  bgListeners.forEach((fn) => fn());
}

export function getLauncherBgMedia(): LauncherBgMedia | null {
  return currentBgMedia;
}

export function setLauncherBgMedia(media: LauncherBgMedia | null) {
  currentBgMedia = media;
  emitBg();
}

export function subscribeLauncherBgMedia(fn: () => void): () => void {
  bgListeners.push(fn);
  return () => {
    bgListeners = bgListeners.filter((l) => l !== fn);
  };
}
