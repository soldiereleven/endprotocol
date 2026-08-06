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

  useEffect(() => {
    const root = document.documentElement;
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" | null;
    const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const initialTheme = savedTheme || (systemDark ? "dark" : "light");

    setTheme(initialTheme);
    root.classList.toggle("dark", initialTheme === "dark");
    root.setAttribute("data-aura-mode", initialTheme);
    setIsMounted(true);
  }, []);

  const toggleTheme = useCallback(() => {
    const newTheme = theme === "light" ? "dark" : "light";

    const apply = () => {
      setTheme(newTheme);
      localStorage.setItem("theme", newTheme);
      document.documentElement.classList.toggle("dark", newTheme === "dark");
      document.documentElement.setAttribute("data-aura-mode", newTheme);
      window.dispatchEvent(
        new CustomEvent("themeChange", { detail: { theme: newTheme } }),
      );
    };

    // 淡出 → 切换 → 淡入。透明玻璃下快照无法覆盖内容，View Transition 的
    // 揭示动画会直接看到已切换的新主题，故改为对 #root 做透明度过渡，任何
    // 背景（含透明 acrylic）下都稳定可见。
    const rootEl = document.getElementById("root");
    if (!rootEl) {
      apply();
      return;
    }

    rootEl.style.transition = "opacity 0.16s ease";
    rootEl.style.opacity = "0";
    setTimeout(() => {
      apply();
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          rootEl.style.opacity = "1";
        });
      });
    }, 170);
    setTimeout(() => {
      rootEl.style.transition = "";
    }, 380);
  }, [theme]);

  if (!isMounted) return <div className="w-6 h-6" />;

  return (
    <button
      ref={btnRef}
      aria-label={
        theme === "light" ? "Switch to dark mode" : "Switch to light mode"
      }
      className={`glass-surface p-1.5 rounded-full transition-all duration-200 hover:scale-105 active:scale-90 cursor-pointer border-none ${className || ""}`}
      onClick={toggleTheme}
    >
      <span className="block transition-transform duration-500 ease-spring" style={{ transform: `rotate(${theme === 'light' ? '0deg' : '360deg'})` }}>
        {theme === "light" ? (
          <SunFilledIcon size={20} />
        ) : (
          <MoonFilledIcon size={20} />
        )}
      </span>
    </button>
  );
};
