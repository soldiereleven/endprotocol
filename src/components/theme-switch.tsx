import { FC, useState, useEffect, useCallback, useRef } from "react";

import { SunFilledIcon, MoonFilledIcon } from "@/components/icons";

export interface ThemeSwitchProps {
  className?: string;
}

export const ThemeSwitch: FC<ThemeSwitchProps> = ({ className }) => {
  const [isMounted, setIsMounted] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">(
    window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light",
  );
  const btnRef = useRef<HTMLButtonElement>(null);
  const animatingRef = useRef(false);

  useEffect(() => {
    const root = document.documentElement;
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" | null;
    const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const initialTheme = savedTheme || (systemDark ? "dark" : "light");

    setTheme(initialTheme);
    root.classList.toggle("dark", initialTheme === "dark");
    setIsMounted(true);
  }, []);

  const toggleTheme = useCallback(() => {
    if (animatingRef.current) return;
    animatingRef.current = true;

    const newTheme = theme === "light" ? "dark" : "light";

    const btn = btnRef.current;
    let x = 50;
    let y = 50;
    if (btn) {
      const rect = btn.getBoundingClientRect();
      x = Math.round(rect.left + rect.width / 2);
      y = Math.round(rect.top + rect.height / 2);
    }

    // 清理残留
    const oldMask = document.getElementById("theme-reveal-mask");
    oldMask?.remove();

    const rootEl = document.getElementById("root");
    if (!rootEl) return;

    // 收集页面全部 CSS（用于注入 iframe）
    let cssText = "";
    document.querySelectorAll("style").forEach((el) => {
      cssText += el.textContent + "\n";
    });

    // 构建 iframe 内容
    const makeDoc = (htmlEl: string, isDark: boolean) =>
      [
        "<!DOCTYPE html>",
        '<html class="' + (isDark ? "dark" : "") + '">',
        "<head><style>" + cssText + "</style></head>",
        "<body>" + htmlEl + "</body>",
        "</html>",
      ].join("");

    const createIframe = (): HTMLIFrameElement => {
      const f = document.createElement("iframe");
      f.id = "theme-reveal-mask";
      Object.assign(f.style, {
        position: "fixed",
        inset: "0",
        width: "100vw",
        height: "100vh",
        border: "none",
        pointerEvents: "none",
        overflow: "hidden",
        background: "transparent",
      });
      return f;
    };

    // --- 步骤 1：在切换主题前捕获旧主题快照 ---
    const oldHTML = rootEl.innerHTML;

    // --- 步骤 2：创建底层 iframe（旧主题），立即挂载遮盖页面 ---
    // 这样切换主题时页面瞬间变为新主题，但被底层 iframe 挡住，用户看不到闪烁
    const bgIframe = createIframe();
    bgIframe.style.zIndex = "99998";
    document.body.appendChild(bgIframe);
    const bgDoc = bgIframe.contentDocument!;
    bgDoc.open();
    bgDoc.write(makeDoc(oldHTML, theme === "dark"));
    bgDoc.close();

    // 补充加载外部样式表（异步，不影响已有内联样式）
    document.querySelectorAll("link[rel=stylesheet]").forEach((el) => {
      const link = bgDoc.createElement("link");
      link.rel = "stylesheet";
      link.href = (el as HTMLLinkElement).href;
      bgDoc.head.appendChild(link);
    });

    // --- 步骤 3：切换主题（页面渲染新主题，被 bgIframe 遮挡）---
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    document.documentElement.classList.toggle("dark", newTheme === "dark");
    window.dispatchEvent(
      new CustomEvent("themeChange", { detail: { theme: newTheme } }),
    );

    // --- 步骤 4：等待 React 渲染完毕，捕获新主题快照 ---
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const newHTML = rootEl.innerHTML;

        // --- 步骤 5：创建上层 iframe（新主题）---
        const fgIframe = createIframe();
        fgIframe.style.zIndex = "99999";
        document.body.appendChild(fgIframe);
        const fgDoc = fgIframe.contentDocument!;
        fgDoc.open();
        fgDoc.write(makeDoc(newHTML, newTheme === "dark"));
        fgDoc.close();

        // 补充加载外部样式表
        document.querySelectorAll("link[rel=stylesheet]").forEach((el) => {
          const link = fgDoc.createElement("link");
          link.rel = "stylesheet";
          link.href = (el as HTMLLinkElement).href;
          fgDoc.head.appendChild(link);
        });

        // --- 步骤 6：WAAPI 动画 - 新主题从按钮向外扩散 ---
        const anim = fgIframe.animate(
          [
            { clipPath: `circle(0px at ${x}px ${y}px)` },
            { clipPath: `circle(200vmax at ${x}px ${y}px)` },
          ],
          {
            duration: 1000,
            easing: "cubic-bezier(0.4, 0, 0.2, 1)",
            fill: "forwards",
          },
        );

        const cleanup = () => {
          fgIframe.remove();
          bgIframe.remove();
          animatingRef.current = false;
        };
        anim.onfinish = cleanup;
        setTimeout(() => {
          if (animatingRef.current) {
            anim.cancel();
            cleanup();
          }
        }, 1500);
      });
    });
  }, [theme]);

  if (!isMounted) return <div className="w-6 h-6" />;

  return (
    <button
      ref={btnRef}
      aria-label={
        theme === "light" ? "Switch to dark mode" : "Switch to light mode"
      }
      className={`p-1.5 rounded-xl transition-all duration-200 hover:bg-default-100 active:scale-90 cursor-pointer bg-transparent border-none ${className || ""}`}
      onClick={toggleTheme}
    >
      <span className="block transition-transform duration-500 ease-spring" style={{ transform: `rotate(${theme === 'light' ? '0deg' : '360deg'})` }}>
        {theme === "light" ? (
          <MoonFilledIcon size={20} />
        ) : (
          <SunFilledIcon size={20} />
        )}
      </span>
    </button>
  );
};
