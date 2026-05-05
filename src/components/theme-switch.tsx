import { FC, useState, useEffect, useCallback } from "react";

import { SunFilledIcon, MoonFilledIcon } from "@/components/icons";

export interface ThemeSwitchProps {
  className?: string;
}

export const ThemeSwitch: FC<ThemeSwitchProps> = ({ className }) => {
  const [isMounted, setIsMounted] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    const root = document.documentElement;
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" | null;
    const initialTheme = savedTheme || "dark";

    setTheme(initialTheme);
    root.classList.toggle("dark", initialTheme === "dark");
    setIsMounted(true);

    // 保存初始主题到 localStorage
    if (!savedTheme) {
      localStorage.setItem("theme", initialTheme);
    }
  }, []);

  const toggleTheme = useCallback(() => {
    const newTheme = theme === "light" ? "dark" : "light";

    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    document.documentElement.classList.toggle("dark", newTheme === "dark");

    // 触发自定义事件，通知其他组件主题已更改
    window.dispatchEvent(
      new CustomEvent("themeChange", { detail: { theme: newTheme } }),
    );
  }, [theme]);

  if (!isMounted) return <div className="w-6 h-6" />;

  return (
    <button
      aria-label={
        theme === "light" ? "Switch to dark mode" : "Switch to light mode"
      }
      className={`px-px transition-opacity hover:opacity-80 cursor-pointer bg-transparent border-none ${className || ""}`}
      onClick={toggleTheme}
    >
      {theme === "light" ? (
        <MoonFilledIcon size={22} />
      ) : (
        <SunFilledIcon size={22} />
      )}
    </button>
  );
};
