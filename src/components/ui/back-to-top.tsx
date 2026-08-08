import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

/**
 * 返回顶部 FAB（与 char-select 一致）：
 * 滚动超过 50% 时显示，悬停显示上箭头图标，否则显示滚动百分比。
 */
export function BackToTopFab({
  getContainer,
  className,
}: {
  getContainer: () => HTMLElement | null;
  className?: string;
}) {
  const [visible, setVisible] = useState(false);
  const [percent, setPercent] = useState(0);
  const [hovering, setHovering] = useState(false);

  useEffect(() => {
    let el: HTMLElement | null = null;
    let alive = true;
    let raf = 0;
    const handler = () => {
      if (!el) return;
      const { scrollTop, scrollHeight, clientHeight } = el;
      const total = scrollHeight - clientHeight;
      const p = total > 0 ? Math.round((scrollTop / total) * 100) : 0;
      setPercent(p);
      setVisible(p > 20);
    };
    const bind = () => {
      if (!alive) return;
      el = getContainer();
      if (!el) {
        raf = requestAnimationFrame(bind);
        return;
      }
      handler();
      el.addEventListener("scroll", handler, { passive: true });
    };
    bind();
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      el?.removeEventListener("scroll", handler);
    };
  }, [getContainer]);

  if (!visible) return null;

  return (
    <button
      type="button"
      className={cn(
        "fixed bottom-6 right-6 z-[10003] w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center transition-all duration-300 hover:scale-110",
        className,
      )}
      onClick={() => getContainer()?.scrollTo({ top: 0, behavior: "smooth" })}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      aria-label="Back to top"
    >
      {hovering ? (
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 8h18M12 20V8m0 0l-6 6m6-6l6 6"
          />
        </svg>
      ) : (
        <span className="text-xs font-bold">{percent}%</span>
      )}
    </button>
  );
}