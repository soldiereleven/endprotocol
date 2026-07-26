import { useState, useEffect } from "react";
import { Button } from "@heroui/react";
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
      className="h-11 bg-background border-b border-separator/60 flex items-center px-5 relative"
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
        className="flex items-center gap-1 px-2 py-1 rounded-xl bg-default-100/60 hover:bg-default-100/80 transition-colors"
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      >
        <Button
          isIconOnly
          size="sm"
          variant="ghost"
          onPress={handleMinimize}
          aria-label="Minimize"
          className="h-7 w-7 min-w-7 rounded-lg hover:bg-default-200/60"
        >
          <MinimizeIcon size={14} />
        </Button>

        <Button
          isIconOnly
          size="sm"
          variant="ghost"
          onPress={handleMaximize}
          aria-label={isMaximized ? "Restore" : "Maximize"}
          className="h-7 w-7 min-w-7 rounded-lg hover:bg-default-200/60"
        >
          {isMaximized ? <RestoreIcon size={14} /> : <MaximizeIcon size={14} />}
        </Button>

        <Button
          isIconOnly
          size="sm"
          variant="ghost"
          onPress={handleClose}
          aria-label="Close"
          className="h-7 w-7 min-w-7 rounded-lg hover:bg-danger/20 hover:text-danger transition-colors"
        >
          <CloseIcon size={14} />
        </Button>
      </div>
    </div>
  );
};
