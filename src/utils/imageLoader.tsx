import { cacheManager } from "./imageCacheManager";
import { useState, useEffect } from "react";
import clsx from "clsx";

interface ImgProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
}

export function Img({ src, className, alt, ...props }: ImgProps) {
  const [resolvedSrc, setResolvedSrc] = useState("");
  useEffect(() => {
    let cancelled = false;
    cacheManager.load(src).then((url) => {
      if (!cancelled) setResolvedSrc(url);
    });
    return () => { cancelled = true; };
  }, [src]);
  if (!resolvedSrc) {
    return (
      <div
        className={clsx(className, "bg-default-200 animate-pulse")}
        aria-label={alt}
        role="img"
      />
    );
  }
  return <img src={resolvedSrc} alt={alt} className={className} {...props} />;
}
