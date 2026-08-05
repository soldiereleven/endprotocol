import { cacheManager } from "./imageCacheManager";
import { useState, useEffect, useRef } from "react";
import clsx from "clsx";

interface ImgProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
}

/**
 * 图片组件：通过 IntersectionObserver 实现懒加载。
 * 图片进入视口附近（rootMargin 预取范围）才触发实际加载/下载缓存。
 */
export function Img({ src, className, alt, ...props }: ImgProps) {
  const [resolvedSrc, setResolvedSrc] = useState("");
  const placeholderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!src) return;
    let cancelled = false;

    const startLoad = () => {
      cacheManager.load(src).then((url) => {
        if (!cancelled) setResolvedSrc(url);
      });
    };

    const el = placeholderRef.current;
    // IntersectionObserver 不可用（如旧环境）时直接加载
    if (typeof IntersectionObserver === "undefined" || !el) {
      startLoad();
      return () => { cancelled = true; };
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          observer.disconnect();
          startLoad();
        }
      },
      // rootMargin 提前预取，避免滚动到边缘才开始加载
      { rootMargin: "400px" },
    );
    observer.observe(el);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [src]);

  if (!resolvedSrc) {
    return (
      <div
        ref={placeholderRef}
        className={clsx(className, "bg-default-200 animate-pulse")}
        aria-label={alt}
        role="img"
      />
    );
  }
  return <img src={resolvedSrc} alt={alt} className={className} {...props} />;
}
