import { useState, useEffect, useRef, useCallback } from "react";
import {
  isBrowserOpen,
  getInAppBrowserUrl,
  closeInAppBrowser,
  navigateInAppBrowser,
  subscribeInAppBrowser,
} from "@/stores/inAppBrowser";

export function InAppBrowser() {
  const [isOpen, setIsOpen] = useState(isBrowserOpen);
  const [url, setUrl] = useState(getInAppBrowserUrl);
  const [inputValue, setInputValue] = useState(url);
  const [loading, setLoading] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    return subscribeInAppBrowser(() => {
      const open = isBrowserOpen();
      const u = getInAppBrowserUrl();
      setIsOpen(open);
      setUrl(u);
      setInputValue(u);
      setLoading(true);
    });
  }, []);

  useEffect(() => {
    setInputValue(url);
  }, [url]);

  const handleClose = useCallback(() => {
    closeInAppBrowser();
  }, []);

  const handleBack = useCallback(() => {
    try {
      iframeRef.current?.contentWindow?.history.back();
    } catch {
      // cross-origin
    }
  }, []);

  const handleForward = useCallback(() => {
    try {
      iframeRef.current?.contentWindow?.history.forward();
    } catch {
      // cross-origin
    }
  }, []);

  const handleRefresh = useCallback(() => {
    if (iframeRef.current) {
      setLoading(true);
      iframeRef.current.src = url;
    }
  }, [url]);

  const handleNavigate = useCallback(() => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    let target = trimmed;
    if (!/^https?:\/\//i.test(target)) {
      target = "https://" + target;
    }
    navigateInAppBrowser(target);
    setUrl(target);
    setLoading(true);
  }, [inputValue]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") handleNavigate();
    },
    [handleNavigate],
  );

  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 top-11 z-40 flex flex-col">
      {/* Glass toolbar */}
      <div className="h-10 flex items-center gap-1.5 px-2 shrink-0 bg-background/60 backdrop-blur-xl border-b border-white/10">
        {/* Back */}
        <button
          type="button"
          onClick={handleBack}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-muted hover:text-foreground hover:bg-white/10 transition-colors cursor-pointer"
          title="Back"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Forward */}
        <button
          type="button"
          onClick={handleForward}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-muted hover:text-foreground hover:bg-white/10 transition-colors cursor-pointer"
          title="Forward"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {/* Refresh */}
        <button
          type="button"
          onClick={handleRefresh}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-muted hover:text-foreground hover:bg-white/10 transition-colors cursor-pointer"
          title="Refresh"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>

        {/* URL bar */}
        <div className="flex-1 flex items-center h-7 px-2.5 rounded-lg bg-white/5 border border-white/10">
          <svg className="w-3 h-3 text-muted shrink-0 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
          </svg>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted"
            placeholder="Enter URL..."
            spellCheck={false}
          />
        </div>

        {/* Close */}
        <button
          type="button"
          onClick={handleClose}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-muted hover:text-danger hover:bg-danger/10 transition-colors cursor-pointer"
          title="Close"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Loading bar */}
      {loading && (
        <div className="h-0.5 bg-primary/20 shrink-0 overflow-hidden">
          <div className="h-full bg-primary animate-pulse w-full" />
        </div>
      )}

      {/* Webview */}
      <iframe
        ref={iframeRef}
        src={url}
        className="flex-1 w-full border-none bg-background"
        onLoad={() => setLoading(false)}
        sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-modals allow-downloads"
        title="In-app browser"
      />
    </div>
  );
}
