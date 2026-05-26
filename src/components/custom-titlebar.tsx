import { useState, useEffect } from "react";
import { Button } from "@heroui/react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import logger from "@/utils/logger";

export const CustomTitlebar = () => {
  const [isMaximized, setIsMaximized] = useState(false);

  // 检查窗口最大化状态
  const checkMaximizedState = async () => {
    try {
      const window = getCurrentWindow();
      const maximized = await window.isMaximized();
      setIsMaximized(maximized);
    } catch (error) {
      logger.error("Failed to check maximized state: " + error, "Titlebar");
    }
  };

  // 组件挂载时检查一次状态，并设置监听器
  useEffect(() => {
    let unlistenResize: UnlistenFn | null = null;
    let unlistenMove: UnlistenFn | null = null;

    // 初始化状态
    checkMaximizedState();

    // 监听窗口大小变化事件（包括最大化/还原）
    listen("tauri://resize", async () => {
      await checkMaximizedState();
    }).then((unlisten) => {
      unlistenResize = unlisten;
    });

    // 监听窗口移动事件（某些情况下也会触发最大化）
    listen("tauri://move", async () => {
      await checkMaximizedState();
    }).then((unlisten) => {
      unlistenMove = unlisten;
    });

    // 清理监听器
    return () => {
      if (unlistenResize) unlistenResize();
      if (unlistenMove) unlistenMove();
    };
  }, []);

  // 最小化窗口
  const handleMinimize = async () => {
    try {
      await invoke("minimize_window");
      logger.info("Window minimized", "Titlebar");
    } catch (error) {
      logger.error("Failed to minimize window: " + error, "Titlebar");
    }
  };

  // 最大化/还原窗口
  const handleMaximize = async () => {
    try {
      await invoke("toggle_maximize_window");
      // 等待一小段时间后重新检查状态，确保同步
      setTimeout(() => {
        checkMaximizedState();
      }, 100);
      logger.info("Window toggle maximize called", "Titlebar");
    } catch (error) {
      logger.error("Failed to toggle maximize: " + error, "Titlebar");
    }
  };

  // 关闭窗口
  const handleClose = async () => {
    try {
      await invoke("close_window");
      logger.info("Window closed", "Titlebar");
    } catch (error) {
      logger.error("Failed to close window: " + error, "Titlebar");
    }
  };

  return (
    <div
      className="h-12 bg-background border-b border-separator flex items-center px-6 relative"
      style={{ WebkitAppRegion: "drag" } as any}
    >
      {/* Logo 文字 - 设置为不可拖拽 */}
      <div
        className="flex items-center gap-3"
        style={{ WebkitAppRegion: "no-drag" } as any}
      >
        <h1 className="text-xl font-bold text-foreground">ENDPROTOCOL</h1>
      </div>

      {/* 可拖拽区域 - 填充剩余空间 */}
      <div className="flex-1" style={{ WebkitAppRegion: "drag" } as any} />

      {/* 右上角操作按钮卡片 - 设置为不可拖拽 */}
      <div
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-default-100/80 hover:bg-default-200/80 transition-colors"
        style={{ WebkitAppRegion: "no-drag" } as any}
      >
        {/* 最小化按钮 */}
        <Button
          isIconOnly
          size="sm"
          variant="ghost"
          onPress={handleMinimize}
          className="h-8 w-8 min-w-8 rounded-xl"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M20 12H4"
            />
          </svg>
        </Button>

        {/* 最大化/还原按钮 */}
        <Button
          isIconOnly
          size="sm"
          variant="ghost"
          onPress={handleMaximize}
          className="h-8 w-8 min-w-8 rounded-xl"
        >
          {isMaximized ? (
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3"
              />
            </svg>
          ) : (
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <rect x="5" y="5" width="14" height="14" rx="2" strokeWidth={2} />
            </svg>
          )}
        </Button>

        {/* 关闭按钮 */}
        <Button
          isIconOnly
          size="sm"
          variant="danger-soft"
          onPress={handleClose}
          className="h-8 w-8 min-w-8 rounded-xl"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </Button>
      </div>
    </div>
  );
};
