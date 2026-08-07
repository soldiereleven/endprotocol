import { FC, useState, useEffect, useCallback, useRef } from "react";
import { SunFilledIcon, MoonFilledIcon, ComputerIcon } from "@/components/icons";
import { getConfig } from "@/utils/configService";

type ThemeMode = "light" | "dark" | "system";

export interface ThemeSwitchProps {
  className?: string;
}

function applyThemeMode(mode: ThemeMode) {
  const root = document.documentElement;
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const isDark = mode === "dark" || (mode === "system" && systemDark);
  root.classList.toggle("dark", isDark);
  root.setAttribute("data-aura-mode", isDark ? "dark" : "light");
}

export const ThemeSwitch: FC<ThemeSwitchProps> = ({ className }) => {
  const [isMounted, setIsMounted] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>("system");
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const init = async () => {
      const savedMode = await getConfig<ThemeMode>("theme_mode");
      const mode = savedMode ?? "system";
      setThemeMode(mode);
      applyThemeMode(mode);
      setIsMounted(true);
    };
    init();
  }, []);

  // Listen for themeChange events from settings page
  useEffect(() => {
    const handler = async () => {
      const savedMode = await getConfig<ThemeMode>("theme_mode");
      const mode = savedMode ?? "system";
      setThemeMode(mode);
      applyThemeMode(mode);
    };
    window.addEventListener("themeChange", handler);
    return () => window.removeEventListener("themeChange", handler);
  }, []);

  useEffect(() => {
    if (themeMode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyThemeMode("system");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [themeMode]);

  const cycleTheme = useCallback(() => {
    const modes: ThemeMode[] = ["light", "dark", "system"];
    const currentIdx = modes.indexOf(themeMode);
    const nextMode = modes[(currentIdx + 1) % modes.length];

    const rootEl = document.getElementById("root");
    if (rootEl) {
      rootEl.style.transition = "opacity 0.16s ease";
      rootEl.style.opacity = "0";
      setTimeout(() => {
        setThemeMode(nextMode);
        applyThemeMode(nextMode);
        setConfig("theme_mode", nextMode);
        window.dispatchEvent(new CustomEvent("themeChange"));
        requestAnimationFrame(() => {
          requestAnimationFrame(() => { rootEl.style.opacity = "1"; });
        });
      }, 170);
      setTimeout(() => { rootEl.style.transition = ""; }, 380);
    } else {
      setThemeMode(nextMode);
      applyThemeMode(nextMode);
      setConfig("theme_mode", nextMode);
    }
  }, [themeMode]);

  if (!isMounted) return <div className="w-6 h-6" />;

  const icons: Record<ThemeMode, JSX.Element> = {
    light: <SunFilledIcon size={20} />,
    dark: <MoonFilledIcon size={20} />,
    system: <ComputerIcon size={20} />,
  };

  const labels: Record<ThemeMode, string> = {
    light: "Switch to dark mode",
    dark: "Switch to system mode",
    system: "Switch to light mode",
  };

  return (
    <button
      ref={btnRef}
      aria-label={labels[themeMode]}
      className={`glass-surface p-1.5 rounded-full transition-all duration-200 hover:scale-105 active:scale-90 cursor-pointer border-none ${className || ""}`}
      onClick={cycleTheme}
    >
      <span
        className="block transition-transform duration-500 ease-spring"
        style={{ transform: `rotate(${themeMode === "dark" ? "360deg" : "0deg"})` }}
      >
        {icons[themeMode]}
      </span>
    </button>
  );
};
