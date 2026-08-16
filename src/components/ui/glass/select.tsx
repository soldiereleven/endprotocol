import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { ChevronDownIcon } from "@/components/ui/app-icon";

export interface GlassSelectOption {
  value: string;
  label: string;
}

export interface GlassSelectProps {
  value: string | null;
  options: GlassSelectOption[];
  onChange: (value: string) => void;
  className?: string;
  /** 未选中时的占位文案（value 为 null 时显示） */
  placeholder?: string;
  /** 面板最大高度 */
  maxMenuHeight?: number;
  /** 选中项文字加粗/高亮（默认 false：仅高亮背景） */
  highlightSelected?: boolean;
}

/** Aura Glass 风格下拉：玻璃触发按钮 + portal 面板（不受父级 overflow 裁剪），点击外部自动关闭 */
export function GlassSelect({
  value,
  options,
  onChange,
  className,
  placeholder,
  maxMenuHeight = 288,
}: GlassSelectProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      if (wrapRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const normalized = value ?? "";
  const current = options.find((o) => o.value === normalized);

  const handleToggle = () => {
    const next = !open;
    if (next && wrapRef.current) {
      const r = wrapRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, left: r.left, width: r.width });
    }
    setOpen(next);
  };

  return (
    <div ref={wrapRef} className={cn("relative shrink-0", className)}>
      <button
        type="button"
        onClick={handleToggle}
        className={cn(
          "flex items-center gap-2 h-9 pl-3 pr-2.5 rounded-lg text-sm cursor-pointer transition-colors",
          "glass-surface border border-separator/90",
          open && "border-primary/50",
        )}
      >
        <span className={cn("truncate", current ? "text-foreground" : "text-muted")}>
          {current?.label ?? placeholder}
        </span>
        <ChevronDownIcon
          size={12}
          className={cn("shrink-0 text-muted transition-transform", open && "rotate-180")}
        />
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            className="fixed z-[9999] min-w-[150px] rounded-xl border border-separator/70 glass-surface-strong shadow-xl py-1 overflow-y-auto"
            style={{
              top: pos.top,
              left: pos.left,
              width: Math.max(150, pos.width || 0),
              maxHeight: maxMenuHeight,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {options.map((opt) => {
              const active = opt.value === normalized;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={cn(
                    "w-full text-left px-3 py-2 text-sm truncate transition-colors cursor-pointer",
                    active
                      ? "bg-primary/15 text-primary font-semibold"
                      : "text-foreground hover:bg-default-100",
                  )}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </div>
  );
}