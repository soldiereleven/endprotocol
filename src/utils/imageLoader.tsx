import { invoke } from "@tauri-apps/api/core";
import { useState, useEffect } from "react";

const MAX_CACHE = 100;
const cache = new Map<string, string>();
const accessOrder: string[] = [];

async function loadImage(path: string): Promise<string> {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("blob:") || path.startsWith("data:")) {
    return path;
  }
  const cached = cache.get(path);
  if (cached) {
    const idx = accessOrder.indexOf(path);
    if (idx !== -1) accessOrder.splice(idx, 1);
    accessOrder.push(path);
    return cached;
  }
  const bytes = await invoke<number[]>("read_image_file", { path });
  const blob = new Blob([new Uint8Array(bytes)]);
  const url = URL.createObjectURL(blob);
  if (cache.size >= MAX_CACHE) {
    const oldest = accessOrder.shift();
    if (oldest) {
      const revoked = cache.get(oldest);
      if (revoked) URL.revokeObjectURL(revoked);
      cache.delete(oldest);
    }
  }
  cache.set(path, url);
  accessOrder.push(path);
  return url;
}

interface ImgProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
}

export function Img({ src, ...props }: ImgProps) {
  const [resolvedSrc, setResolvedSrc] = useState("");
  useEffect(() => {
    let cancelled = false;
    loadImage(src).then((url) => {
      if (!cancelled) setResolvedSrc(url);
    });
    return () => { cancelled = true; };
  }, [src]);
  return <img src={resolvedSrc} {...props} />;
}
