import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

export interface ContextMenuItem {
  key: string;
  label: string;
  danger?: boolean;
  onPress: () => void;
}

interface CardContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

export function CardContextMenu({
  x,
  y,
  items,
  onClose,
}: CardContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-[9999] min-w-[160px] bg-background border border-separator rounded-xl shadow-2xl py-1 animate-fade-in"
      style={{ left: x, top: y }}
    >
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          className={`w-full px-4 py-2 text-left text-sm transition-colors flex items-center gap-2 ${
            item.danger
              ? "text-danger hover:bg-danger/10"
              : "text-foreground hover:bg-default-100"
          }`}
          onClick={() => {
            item.onPress();
            onClose();
          }}
        >
          {item.label}
        </button>
      ))}
    </div>,
    document.body,
  );
}
