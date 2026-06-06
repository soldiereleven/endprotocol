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
      className="h-12 bg-background border-b border-separator flex items-center px-6 relative"
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
    >
      <div
        className="flex items-center gap-3"
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      >
        <h1 className="text-xl font-bold text-foreground">ENDPROTOCOL</h1>
      </div>

      <div
        className="flex-1"
        style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
      />

      <div
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-default-100/80 hover:bg-default-200/80 transition-colors"
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      >
        <Button
          isIconOnly
          size="sm"
          variant="ghost"
          onPress={handleMinimize}
          aria-label="Minimize"
          className="h-8 w-8 min-w-8 rounded-xl"
        >
          <MinimizeIcon size={16} />
        </Button>

        <Button
          isIconOnly
          size="sm"
          variant="ghost"
          onPress={handleMaximize}
          aria-label={isMaximized ? "Restore" : "Maximize"}
          className="h-8 w-8 min-w-8 rounded-xl"
        >
          {isMaximized ? <RestoreIcon size={16} /> : <MaximizeIcon size={16} />}
        </Button>

        <Button
          isIconOnly
          size="sm"
          variant="danger-soft"
          onPress={handleClose}
          aria-label="Close"
          className="h-8 w-8 min-w-8 rounded-xl"
        >
          <CloseIcon size={16} />
        </Button>
      </div>
    </div>
  );
};
