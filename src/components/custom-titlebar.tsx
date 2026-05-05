import { useState } from "react";
import { Button } from "@heroui/react";
import { invoke } from "@tauri-apps/api/core";

export const CustomTitlebar = () => {
  const [isMaximized, setIsMaximized] = useState(false);

  // 最小化窗口
  const handleMinimize = async () => {
    try {
      await invoke("minimize_window");
      console.log("Window minimized");
    } catch (error) {
      console.error("Failed to minimize window:", error);
    }
  };

  // 最大化/还原窗口
  const handleMaximize = async () => {
    try {
      await invoke("toggle_maximize_window");
      setIsMaximized(!isMaximized);
      console.log("Window maximized state:", !isMaximized);
    } catch (error) {
      console.error("Failed to toggle maximize:", error);
    }
  };

  // 关闭窗口
  const handleClose = async () => {
    try {
      await invoke("close_window");
      console.log("Window closed");
    } catch (error) {
      console.error("Failed to close window:", error);
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
