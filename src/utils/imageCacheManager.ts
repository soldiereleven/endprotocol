import { invoke } from "@tauri-apps/api/core";
import { useEffect, useRef } from "react";

const MAX_CACHE_SIZE = 100;

class ImageCacheManager {
  private cache = new Map<string, string>();
  private accessOrder: string[] = [];
  private refCounts = new Map<string, number>();
  private pinned = new Set<string>();
  private loading = new Map<string, Promise<string>>();

  async load(path: string): Promise<string> {
    if (!path) return "";
    if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("blob:") || path.startsWith("data:")) {
      return path;
    }

    const hit = this.cache.get(path);
    if (hit) {
      this.touch(path);
      return hit;
    }

    const inflight = this.loading.get(path);
    if (inflight) return inflight;

    const promise = invoke<number[]>("read_image_file", { path })
      .then((bytes) => {
        const blob = new Blob([new Uint8Array(bytes)]);
        const url = URL.createObjectURL(blob);
        this.evictOne();
        this.cache.set(path, url);
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
      this.refCounts.set(p, (this.refCounts.get(p) ?? 0) + 1);
      this.touch(p);
    }
  }

  release(paths: string[]) {
    for (const p of paths) {
      if (!p) continue;
      const n = this.refCounts.get(p) ?? 0;
      if (n <= 1) this.refCounts.delete(p);
      else this.refCounts.set(p, n - 1);
    }
  }

  pin(paths: string[]) {
    for (const p of paths) {
      if (!p) continue;
      this.pinned.add(p);
    }
  }

  unpin(paths: string[]) {
    for (const p of paths) {
      if (!p) continue;
      this.pinned.delete(p);
    }
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
    let scanned = 0;
    while (this.cache.size >= MAX_CACHE_SIZE && scanned < this.cache.size) {
      const oldest = this.accessOrder.shift();
      if (!oldest) break;
      if (this.isProtected(oldest)) {
        this.accessOrder.push(oldest);
        scanned++;
        continue;
      }
      const url = this.cache.get(oldest);
      if (url) URL.revokeObjectURL(url);
      this.cache.delete(oldest);
      return;
    }
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
    return () => {
      if (paths.length) cacheManager.release(paths);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
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
