import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import {
  MinimizeIcon,
  MaximizeIcon,
  RestoreIcon,
  CloseIcon,
  BellIcon,
} from "@/components/ui/app-icon";
import { AppInfoDrawer } from "@/components/app-info-drawer";
import { getUnreadCount, hasUrgentUnread, subscribeMessages } from "@/utils/messageStore";
import logger from "@/utils/logger";

export const CustomTitlebar = () => {
  const [isMaximized, setIsMaximized] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(() => getUnreadCount());
  const [hasUrgent, setHasUrgent] = useState(() => hasUrgentUnread());

  useEffect(() => {
    return subscribeMessages(() => {
      setUnreadCount(getUnreadCount());
      setHasUrgent(hasUrgentUnread());
    });
  }, []);

  const checkMaximizedState = async () => {
    try {
      const win = getCurrentWindow();
      const maximized = await win.isMaximized();
      setIsMaximized(maximized);
    } catch (error) {
      logger.error("Failed to check maximized state: " + error, "Titlebar");
    }
  };

  useEffect(() => {
    let unlistenResize: UnlistenFn | null = null;
    let unlistenMove: UnlistenFn | null = null;

    checkMaximizedState();

    listen("tauri://resize", async () => {
      await checkMaximizedState();
    }).then((u) => (unlistenResize = u));

    listen("tauri://move", async () => {
      await checkMaximizedState();
    }).then((u) => (unlistenMove = u));

    return () => {
      unlistenResize?.();
      unlistenMove?.();
    };
  }, []);

  const handleMinimize = async () => {
    try {
      await invoke("minimize_window");
    } catch (error) {
      logger.error("Failed to minimize window: " + error, "Titlebar");
    }
  };

  const handleMaximize = async () => {
    try {
      await invoke("toggle_maximize_window");
      window.setTimeout(checkMaximizedState, 100);
    } catch (error) {
      logger.error("Failed to toggle maximize: " + error, "Titlebar");
    }
  };

  const handleClose = async () => {
    try {
      await invoke("close_window");
    } catch (error) {
      logger.error("Failed to close window: " + error, "Titlebar");
    }
  };

  return (
    <>
      <div
        className="h-11 flex items-center pl-5 pr-2 relative"
        style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
      >
        <div
          className="flex items-center gap-2.5"
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
        >
          <div className="w-2 h-2 rounded-full bg-primary/60" />
          <h1 className="text-sm font-bold text-foreground tracking-widest">ENDPROTOCOL</h1>
        </div>

        <div
          className="flex-1"
          style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
        />

        <button
          type="button"
          onClick={() => setInfoOpen(true)}
          aria-label="Messages"
          className="relative flex h-7 w-7 items-center justify-center rounded-lg text-muted transition-all duration-200 hover:bg-white/10 hover:text-foreground hover:scale-110 active:scale-90 cursor-pointer mr-2"
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
        >
          <BellIcon size={14} />
          {unreadCount > 0 && (
            <span className={`absolute -top-0.5 -right-0.5 flex h-3.5 min-w-[14px] items-center justify-center rounded-full px-0.5 text-[8px] font-bold leading-none text-primary-foreground ${hasUrgent ? "bg-danger" : "bg-primary"}`}>
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>

        <div
          className="flex items-center glass-surface border border-separator/60 rounded-xl overflow-hidden"
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
        >
          <button
            type="button"
            onClick={handleMinimize}
            aria-label="Minimize"
            className="flex h-7 w-8 items-center justify-center rounded-l-xl text-muted transition-all duration-200 hover:bg-white/10 hover:text-foreground hover:scale-105 active:scale-95 cursor-pointer"
          >
            <MinimizeIcon size={14} />
          </button>

          <button
            type="button"
            onClick={handleMaximize}
            aria-label={isMaximized ? "Restore" : "Maximize"}
            className="flex h-7 w-8 items-center justify-center text-muted transition-all duration-200 hover:bg-white/10 hover:text-foreground hover:scale-105 active:scale-95 cursor-pointer"
          >
            {isMaximized ? <RestoreIcon size={14} /> : <MaximizeIcon size={14} />}
          </button>

          <button
            type="button"
            onClick={handleClose}
            aria-label="Close"
            className="flex h-7 w-8 items-center justify-center rounded-r-xl text-muted transition-all duration-200 hover:bg-danger/20 hover:text-danger hover:scale-105 active:scale-95 cursor-pointer"
          >
            <CloseIcon size={14} />
          </button>
        </div>
      </div>

      <AppInfoDrawer isOpen={infoOpen} onClose={() => setInfoOpen(false)} />
    </>
  );
};
