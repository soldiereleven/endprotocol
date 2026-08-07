import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import {
  MinimizeIcon,
  MaximizeIcon,
  RestoreIcon,
  CloseIcon,
} from "@/components/ui/app-icon";
import logger from "@/utils/logger";

export const CustomTitlebar = () => {
  const [isMaximized, setIsMaximized] = useState(false);

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

      <div
        className="flex items-center gap-1 px-2 rounded-xl glass-surface border border-separator/60"
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      >
        <button
          type="button"
          onClick={handleMinimize}
          aria-label="Minimize"
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-transparent text-muted transition-colors duration-200 hover:border-separator/70 hover:text-foreground cursor-pointer"
        >
          <MinimizeIcon size={14} />
        </button>

        <button
          type="button"
          onClick={handleMaximize}
          aria-label={isMaximized ? "Restore" : "Maximize"}
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-transparent text-muted transition-colors duration-200 hover:border-separator/70 hover:text-foreground cursor-pointer"
        >
          {isMaximized ? <RestoreIcon size={14} /> : <MaximizeIcon size={14} />}
        </button>

        <button
          type="button"
          onClick={handleClose}
          aria-label="Close"
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-transparent text-muted transition-colors duration-200 hover:border-danger/40 hover:text-danger cursor-pointer"
        >
          <CloseIcon size={14} />
        </button>
      </div>
    </div>
  );
};
