import { cacheManager } from "./imageCacheManager";
import { useState, useEffect } from "react";

interface ImgProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
}

export function Img({ src, ...props }: ImgProps) {
  const [resolvedSrc, setResolvedSrc] = useState("");
  useEffect(() => {
    let cancelled = false;
    cacheManager.load(src).then((url) => {
      if (!cancelled) setResolvedSrc(url);
    });
    return () => { cancelled = true; };
  }, [src]);
  return <img src={resolvedSrc} {...props} />;
}
