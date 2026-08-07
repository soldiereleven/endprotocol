import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { GlassButton } from "@/components/ui/glass";
import { SettingsDivider } from "@/components/ui/settings-row";
import { getConfig, setConfig } from "@/utils/configService";

type ThemeMode = "light" | "dark" | "system";

interface ThemeColor {
  name: string;
  label: string;
  colors: {
    50: string;
    100: string;
    200: string;
    300: string;
    400: string;
    500: string;
    600: string;
    700: string;
    800: string;
    900: string;
    foreground: string;
  };
}

const THEME_COLORS: ThemeColor[] = [
  {
    name: "indigo",
    label: "Indigo",
    colors: {
      50: "#eef2ff", 100: "#e0e7ff", 200: "#c7d2fe", 300: "#a5b4fc",
      400: "#818cf8", 500: "#6366f1", 600: "#4f46e5", 700: "#4338ca",
      800: "#3730a3", 900: "#312e81", foreground: "#ffffff",
    },
  },
  {
    name: "blue",
    label: "Blue",
    colors: {
      50: "#eff6ff", 100: "#dbeafe", 200: "#bfdbfe", 300: "#93c5fd",
      400: "#60a5fa", 500: "#3b82f6", 600: "#2563eb", 700: "#1d4ed8",
      800: "#1e40af", 900: "#1e3a8a", foreground: "#ffffff",
    },
  },
  {
    name: "emerald",
    label: "Emerald",
    colors: {
      50: "#ecfdf5", 100: "#d1fae5", 200: "#a7f3d0", 300: "#6ee7b7",
      400: "#34d399", 500: "#10b981", 600: "#059669", 700: "#047857",
      800: "#065f46", 900: "#064e3b", foreground: "#ffffff",
    },
  },
  {
    name: "rose",
    label: "Rose",
    colors: {
      50: "#fff1f2", 100: "#ffe4e6", 200: "#fecdd3", 300: "#fda4af",
      400: "#fb7185", 500: "#f43f5e", 600: "#e11d48", 700: "#be123c",
      800: "#9f1239", 900: "#881337", foreground: "#ffffff",
    },
  },
  {
    name: "amber",
    label: "Amber",
    colors: {
      50: "#fffbeb", 100: "#fef3c7", 200: "#fde68a", 300: "#fcd34d",
      400: "#fbbf24", 500: "#f59e0b", 600: "#d97706", 700: "#b45309",
      800: "#92400e", 900: "#78350f", foreground: "#ffffff",
    },
  },
  {
    name: "slate",
    label: "Slate",
    colors: {
      50: "#f8fafc", 100: "#f1f5f9", 200: "#e2e8f0", 300: "#cbd5e1",
      400: "#94a3b8", 500: "#64748b", 600: "#475569", 700: "#334155",
      800: "#1e293b", 900: "#0f172a", foreground: "#ffffff",
    },
  },
];

function applyThemeColor(color: ThemeColor) {
  const root = document.documentElement;
  const c = color.colors;
  root.style.setProperty("--primary-50", c[50]);
  root.style.setProperty("--primary-100", c[100]);
  root.style.setProperty("--primary-200", c[200]);
  root.style.setProperty("--primary-300", c[300]);
  root.style.setProperty("--primary-400", c[400]);
  root.style.setProperty("--primary-500", c[500]);
  root.style.setProperty("--primary-600", c[600]);
  root.style.setProperty("--primary-700", c[700]);
  root.style.setProperty("--primary-800", c[800]);
  root.style.setProperty("--primary-900", c[900]);
  root.style.setProperty("--primary", c[500]);
  root.style.setProperty("--primary-foreground", c.foreground);
}

function applyThemeMode(mode: ThemeMode) {
  const root = document.documentElement;
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const isDark = mode === "dark" || (mode === "system" && systemDark);

  root.classList.toggle("dark", isDark);
  root.setAttribute("data-aura-mode", isDark ? "dark" : "light");
}

export function AppearanceSettings() {
  const { t } = useTranslation();
  const [themeMode, setThemeMode] = useState<ThemeMode>("system");
  const [themeColor, setThemeColor] = useState("indigo");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadConfig = async () => {
      const [savedMode, savedColor] = await Promise.all([
        getConfig<ThemeMode>("theme_mode"),
        getConfig<string>("theme_color"),
      ]);
      setThemeMode(savedMode ?? "system");
      setThemeColor(savedColor ?? "indigo");
      setIsLoading(false);
    };
    loadConfig();
  }, []);

  useEffect(() => {
    if (isLoading) return;

    const color = THEME_COLORS.find((c) => c.name === themeColor) ?? THEME_COLORS[0];
    applyThemeColor(color);
    applyThemeMode(themeMode);
  }, [themeMode, themeColor, isLoading]);

  useEffect(() => {
    if (themeMode !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyThemeMode("system");
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, [themeMode]);

  const handleModeChange = async (mode: ThemeMode) => {
    setThemeMode(mode);
    await setConfig("theme_mode", mode);

    // Fade transition
    const rootEl = document.getElementById("root");
    if (rootEl) {
      rootEl.style.transition = "opacity 0.16s ease";
      rootEl.style.opacity = "0";
      setTimeout(() => {
        applyThemeMode(mode);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            rootEl.style.opacity = "1";
          });
        });
      }, 170);
      setTimeout(() => {
        rootEl.style.transition = "";
      }, 380);
    } else {
      applyThemeMode(mode);
    }
  };

  const handleColorChange = async (colorName: string) => {
    setThemeColor(colorName);
    await setConfig("theme_color", colorName);
  };

  if (isLoading) return null;

  const modeOptions: { value: ThemeMode; label: string; icon: JSX.Element }[] = [
    {
      value: "light",
      label: t("settings.general.theme_light"),
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
          <circle cx="12" cy="12" r="5" />
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
        </svg>
      ),
    },
    {
      value: "dark",
      label: t("settings.general.theme_dark"),
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
          <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
        </svg>
      ),
    },
    {
      value: "system",
      label: t("settings.general.theme_system"),
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <path d="M8 21h8M12 17v4" />
        </svg>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Theme Mode */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-foreground">
            {t("settings.appearance.theme_mode")}
          </p>
          <p className="text-sm text-muted mt-0.5">
            {t("settings.appearance.theme_mode_desc")}
          </p>
        </div>
        <div className="flex gap-1 p-1 rounded-xl bg-default-100/60 ring-1 ring-default-200/50">
          {modeOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => handleModeChange(opt.value)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer ${
                themeMode === opt.value
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted hover:text-foreground hover:bg-default-200/50"
              }`}
            >
              {opt.icon}
              <span className="hidden sm:inline">{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      <SettingsDivider />

      {/* Theme Color */}
      <div>
        <div className="mb-4">
          <p className="font-medium text-foreground">
            {t("settings.appearance.theme_color")}
          </p>
          <p className="text-sm text-muted mt-0.5">
            {t("settings.appearance.theme_color_desc")}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          {THEME_COLORS.map((color) => (
            <button
              key={color.name}
              onClick={() => handleColorChange(color.name)}
              className={`group relative w-10 h-10 rounded-full transition-all duration-200 cursor-pointer ${
                themeColor === color.name
                  ? "ring-2 ring-offset-2 ring-offset-background scale-110"
                  : "hover:scale-105"
              }`}
              style={{
                backgroundColor: color.colors[500],
                ringColor: themeColor === color.name ? color.colors[500] : undefined,
                ["--tw-ring-color" as string]: themeColor === color.name ? color.colors[500] : undefined,
              }}
              title={color.label}
            >
              {themeColor === color.name && (
                <svg
                  className="absolute inset-0 m-auto w-5 h-5 drop-shadow-md"
                  fill="none"
                  stroke="white"
                  viewBox="0 0 24 24"
                  strokeWidth="2.5"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
