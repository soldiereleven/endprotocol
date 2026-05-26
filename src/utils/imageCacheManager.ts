import { invoke } from "@tauri-apps/api/core";
import { useEffect, useRef } from "react";

export type CacheMode = "smart" | "manual";

interface CacheConfig {
  mode: CacheMode;
  maxEntries: number;
  maxSizeMB: number;
}

const SMART_MAX_ENTRIES = 100;
const DEFAULT_MANUAL_MAX_SIZE_MB = 100;

class ImageCacheManager {
  private cache = new Map<string, string>();
  private sizes = new Map<string, number>();
  private accessOrder: string[] = [];
  private refCounts = new Map<string, number>();
  private pinned = new Set<string>();
  private loading = new Map<string, Promise<string>>();
  private evictionTimers = new Map<string, ReturnType<typeof setTimeout>>();

  private config: CacheConfig = {
    mode: "smart",
    maxEntries: SMART_MAX_ENTRIES,
    maxSizeMB: DEFAULT_MANUAL_MAX_SIZE_MB,
  };

  private totalSizeBytes = 0;

  configure(cfg: Partial<CacheConfig>) {
    if (cfg.mode !== undefined) this.config.mode = cfg.mode;
    if (cfg.maxEntries !== undefined) this.config.maxEntries = cfg.maxEntries;
    if (cfg.maxSizeMB !== undefined) this.config.maxSizeMB = cfg.maxSizeMB;
  }

  getConfig(): CacheConfig {
    return { ...this.config };
  }

  getStats() {
    return {
      entries: this.cache.size,
      totalSizeMB: Math.round((this.totalSizeBytes / (1024 * 1024)) * 100) / 100,
      maxEntries: this.config.mode === "smart" ? Infinity : this.config.maxEntries,
      maxSizeMB: this.config.mode === "smart" ? Infinity : this.config.maxSizeMB,
    };
  }

  getEntries() {
    return this.accessOrder
      .filter((path) => this.cache.has(path))
      .map((path) => ({
        path,
        sizeKB: Math.round(((this.sizes.get(path) ?? 0) / 1024) * 10) / 10,
        pinned: this.pinned.has(path),
        refCount: this.refCounts.get(path) ?? 0,
      })).reverse();
  }

  private getEffectiveMaxEntries(): number {
    return this.config.mode === "smart" ? Infinity : this.config.maxEntries;
  }

  private getEffectiveMaxSizeBytes(): number {
    return this.config.mode === "smart" ? Infinity : this.config.maxSizeMB * 1024 * 1024;
  }

  async load(path: string): Promise<string> {
    if (!path) return "";
    if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("blob:") || path.startsWith("data:")) {
      return path;
    }

    const hit = this.cache.get(path);
    if (hit) {
      this.cancelEviction(path);
      this.touch(path);
      return hit;
    }

    const inflight = this.loading.get(path);
    if (inflight) return inflight;

    const promise = invoke<number[]>("read_image_file", { path })
      .then((bytes) => {
        const blob = new Blob([new Uint8Array(bytes)]);
        const url = URL.createObjectURL(blob);
        const byteSize = bytes.length;
        this.evictFor(byteSize);
        this.cache.set(path, url);
        this.sizes.set(path, byteSize);
        this.totalSizeBytes += byteSize;
        this.touch(path);
        return url;
      })
      .finally(() => this.loading.delete(path));

    this.loading.set(path, promise);
    return promise;
  }

  request(paths: string[]) {
    for (const p of paths) {
      if (!p) continue;
      const prev = this.refCounts.get(p) ?? 0;
      this.refCounts.set(p, prev + 1);
      if (prev === 0) this.cancelEviction(p);
      this.touch(p);
    }
  }

  release(paths: string[]) {
    for (const p of paths) {
      if (!p) continue;
      const n = this.refCounts.get(p) ?? 0;
      if (n === 1) {
        this.refCounts.delete(p);
        if (this.cache.has(p) && !this.pinned.has(p)) {
          this.scheduleEviction(p);
        }
      } else if (n > 1) {
        this.refCounts.set(p, n - 1);
      }
    }
  }

  pin(paths: string[]) {
    for (const p of paths) {
      if (!p) continue;
      this.pinned.add(p);
      this.cancelEviction(p);
    }
  }

  unpin(paths: string[]) {
    for (const p of paths) {
      if (!p) continue;
      this.pinned.delete(p);
    }
  }

  private cancelEviction(path: string) {
    const timer = this.evictionTimers.get(path);
    if (timer !== undefined) {
      clearTimeout(timer);
      this.evictionTimers.delete(path);
    }
  }

  private scheduleEviction(path: string) {
    if (this.config.mode === "manual") return;
    this.cancelEviction(path);
    const timer = setTimeout(() => {
      this.evictionTimers.delete(path);
      const url = this.cache.get(path);
      const byteSize = this.sizes.get(path) ?? 0;
      if (url) URL.revokeObjectURL(url);
      this.cache.delete(path);
      this.sizes.delete(path);
      this.totalSizeBytes -= byteSize;
      const idx = this.accessOrder.indexOf(path);
      if (idx !== -1) this.accessOrder.splice(idx, 1);
    }, 20000);
    this.evictionTimers.set(path, timer);
  }

  private isProtected(path: string) {
    return this.pinned.has(path) || (this.refCounts.get(path) ?? 0) > 0;
  }

  private touch(path: string) {
    const idx = this.accessOrder.indexOf(path);
    if (idx !== -1) this.accessOrder.splice(idx, 1);
    this.accessOrder.push(path);
  }

  private evictOne() {
    if (this.accessOrder.length === 0) return;
    let scanned = 0;
    while (scanned < this.accessOrder.length) {
      const oldest = this.accessOrder.shift();
      if (!oldest) break;
      if (this.config.mode === "smart" && this.isProtected(oldest)) {
        this.accessOrder.push(oldest);
        scanned++;
        continue;
      }
      this.cancelEviction(oldest);
      const url = this.cache.get(oldest);
      const byteSize = this.sizes.get(oldest) ?? 0;
      if (url) URL.revokeObjectURL(url);
      this.cache.delete(oldest);
      this.sizes.delete(oldest);
      this.totalSizeBytes -= byteSize;
      return;
    }
  }

  private evictFor(incomingSize: number) {
    const maxEntries = this.getEffectiveMaxEntries();
    const maxBytes = this.getEffectiveMaxSizeBytes();

    while (
      this.cache.size > 0 &&
      (this.cache.size >= maxEntries || this.totalSizeBytes + incomingSize > maxBytes)
    ) {
      this.evictOne();
    }
  }

  evictInactive() {
    for (const [path] of this.evictionTimers) {
      this.cancelEviction(path);
    }
    for (const path of [...this.accessOrder]) {
      if (this.isProtected(path)) continue;
      const url = this.cache.get(path);
      const byteSize = this.sizes.get(path) ?? 0;
      if (url) URL.revokeObjectURL(url);
      this.cache.delete(path);
      this.sizes.delete(path);
      this.totalSizeBytes -= byteSize;
    }
    this.accessOrder = this.accessOrder.filter((p) => this.cache.has(p));
  }
}

export const cacheManager = new ImageCacheManager();

export function useImageRequest(paths: string[], deps: unknown[] = []) {
  const prevRef = useRef<string[]>([]);

  useEffect(() => {
    const prev = prevRef.current;
    const toRelease = prev.filter((p) => !paths.includes(p));
    const toRequest = paths.filter((p) => !prev.includes(p));
    if (toRelease.length) cacheManager.release(toRelease);
    if (toRequest.length) cacheManager.request(toRequest);
    prevRef.current = paths;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    return () => {
      const last = prevRef.current;
      if (last.length) cacheManager.release(last);
    };
  }, []);
}

export function usePinImages(paths: string[]) {
  useEffect(() => {
    if (paths.length) cacheManager.pin(paths);
    return () => {
      if (paths.length) cacheManager.unpin(paths);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paths.join(",")]);
}
