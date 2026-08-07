import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { SettingsDivider } from "@/components/ui/settings-row";
import { getConfig, setConfig } from "@/utils/configService";

type ThemeMode = "light" | "dark" | "system";

interface ThemeColor {
  name: string;
  label: string;
  colors: {
    50: string; 100: string; 200: string; 300: string; 400: string;
    500: string; 600: string; 700: string; 800: string; 900: string;
    foreground: string;
  };
}

const PRESET_COLORS: ThemeColor[] = [
  {
    name: "indigo", label: "Indigo",
    colors: { 50:"#eef2ff",100:"#e0e7ff",200:"#c7d2fe",300:"#a5b4fc",400:"#818cf8",500:"#6366f1",600:"#4f46e5",700:"#4338ca",800:"#3730a3",900:"#312e81",foreground:"#ffffff" },
  },
  {
    name: "blue", label: "Blue",
    colors: { 50:"#eff6ff",100:"#dbeafe",200:"#bfdbfe",300:"#93c5fd",400:"#60a5fa",500:"#3b82f6",600:"#2563eb",700:"#1d4ed8",800:"#1e40af",900:"#1e3a8a",foreground:"#ffffff" },
  },
  {
    name: "emerald", label: "Emerald",
    colors: { 50:"#ecfdf5",100:"#d1fae5",200:"#a7f3d0",300:"#6ee7b7",400:"#34d399",500:"#10b981",600:"#059669",700:"#047857",800:"#065f46",900:"#064e3b",foreground:"#ffffff" },
  },
  {
    name: "rose", label: "Rose",
    colors: { 50:"#fff1f2",100:"#ffe4e6",200:"#fecdd3",300:"#fda4af",400:"#fb7185",500:"#f43f5e",600:"#e11d48",700:"#be123c",800:"#9f1239",900:"#881337",foreground:"#ffffff" },
  },
  {
    name: "amber", label: "Amber",
    colors: { 50:"#fffbeb",100:"#fef3c7",200:"#fde68a",300:"#fcd34d",400:"#fbbf24",500:"#f59e0b",600:"#d97706",700:"#b45309",800:"#92400e",900:"#78350f",foreground:"#ffffff" },
  },
  {
    name: "slate", label: "Slate",
    colors: { 50:"#f8fafc",100:"#f1f5f9",200:"#e2e8f0",300:"#cbd5e1",400:"#94a3b8",500:"#64748b",600:"#475569",700:"#334155",800:"#1e293b",900:"#0f172a",foreground:"#ffffff" },
  },
];

function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function generateColorScale(hex: string): ThemeColor["colors"] {
  const [h, s] = hexToHsl(hex);
  const lighter = (l: number) => hslToHex(h, Math.max(s - 10, 10), l);
  const darker = (l: number) => hslToHex(h, Math.min(s + 10, 90), l);
  return {
    50: lighter(97), 100: lighter(93), 200: lighter(86), 300: lighter(76),
    400: lighter(64), 500: hex, 600: darker(42), 700: darker(34),
    800: darker(26), 900: darker(18), foreground: "#ffffff",
  };
}

function applyThemeColor(colors: ThemeColor["colors"]) {
  const root = document.documentElement;
  root.style.setProperty("--primary-50", colors[50]);
  root.style.setProperty("--primary-100", colors[100]);
  root.style.setProperty("--primary-200", colors[200]);
  root.style.setProperty("--primary-300", colors[300]);
  root.style.setProperty("--primary-400", colors[400]);
  root.style.setProperty("--primary-500", colors[500]);
  root.style.setProperty("--primary-600", colors[600]);
  root.style.setProperty("--primary-700", colors[700]);
  root.style.setProperty("--primary-800", colors[800]);
  root.style.setProperty("--primary-900", colors[900]);
  root.style.setProperty("--primary", colors[500]);
  root.style.setProperty("--primary-foreground", colors.foreground);
}

export function getAllColors(customColors: ThemeColor[]): ThemeColor[] {
  return [...PRESET_COLORS, ...customColors];
}

export function findColorByName(name: string, customColors: ThemeColor[]): ThemeColor | undefined {
  return getAllColors(customColors).find((c) => c.name === name);
}

export function AppearanceSettings() {
  const { t } = useTranslation();
  const [themeMode, setThemeMode] = useState<ThemeMode>("system");
  const [themeColor, setThemeColor] = useState("indigo");
  const [customColors, setCustomColors] = useState<ThemeColor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerHex, setPickerHex] = useState("#6366f1");
  const [pickerLabel, setPickerLabel] = useState("");
  const pickerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadConfig = async () => {
      const [savedMode, savedColor, savedCustom] = await Promise.all([
        getConfig<ThemeMode>("theme_mode"),
        getConfig<string>("theme_color"),
        getConfig<ThemeColor[]>("theme_custom_colors"),
      ]);
      setThemeMode(savedMode ?? "system");
      setThemeColor(savedColor ?? "indigo");
      setCustomColors(savedCustom ?? []);
      setIsLoading(false);
    };
    loadConfig();
  }, []);

  useEffect(() => {
    if (isLoading) return;
    const allColors = getAllColors(customColors);
    const color = allColors.find((c) => c.name === themeColor) ?? allColors[0];
    if (color) applyThemeColor(color.colors);
    applyThemeModeLocal(themeMode);
  }, [themeMode, themeColor, customColors, isLoading]);

  useEffect(() => {
    if (themeMode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyThemeModeLocal("system");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [themeMode]);

  useEffect(() => {
    if (!showPicker) return;
    const handleClick = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showPicker]);

  const handleModeChange = async (mode: ThemeMode) => {
    setThemeMode(mode);
    await setConfig("theme_mode", mode);
    dispatchThemeChange();

    const rootEl = document.getElementById("root");
    if (rootEl) {
      rootEl.style.transition = "opacity 0.16s ease";
      rootEl.style.opacity = "0";
      setTimeout(() => {
        applyThemeModeLocal(mode);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => { rootEl.style.opacity = "1"; });
        });
      }, 170);
      setTimeout(() => { rootEl.style.transition = ""; }, 380);
    } else {
      applyThemeModeLocal(mode);
    }
  };

  const handleColorChange = async (colorName: string) => {
    setThemeColor(colorName);
    await setConfig("theme_color", colorName);
    dispatchThemeChange();
  };

  const handleAddCustom = async () => {
    const hex = pickerHex;
    const label = pickerLabel.trim() || hex.toUpperCase();
    const name = `custom-${Date.now()}`;
    const newColor: ThemeColor = {
      name,
      label,
      colors: generateColorScale(hex),
    };
    const updated = [...customColors, newColor];
    setCustomColors(updated);
    setThemeColor(name);
    await Promise.all([
      setConfig("theme_custom_colors", updated),
      setConfig("theme_color", name),
    ]);
    dispatchThemeChange();
    setShowPicker(false);
    setPickerLabel("");
  };

  const handleDeleteCustom = async (colorName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = customColors.filter((c) => c.name !== colorName);
    setCustomColors(updated);
    if (themeColor === colorName) {
      const fallback = PRESET_COLORS[0];
      setThemeColor(fallback.name);
      applyThemeColor(fallback.colors);
      await setConfig("theme_color", fallback.name);
    }
    await setConfig("theme_custom_colors", updated);
    dispatchThemeChange();
  };

  if (isLoading) return null;

  const modeOptions: { value: ThemeMode; label: string; icon: JSX.Element }[] = [
    { value: "light", label: t("settings.general.theme_light"), icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5"><circle cx="12" cy="12" r="5" /><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" /></svg> },
    { value: "dark", label: t("settings.general.theme_dark"), icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" /></svg> },
    { value: "system", label: t("settings.general.theme_system"), icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5"><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" /></svg> },
  ];

  return (
    <div className="space-y-6">
      {/* Theme Mode */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-foreground">{t("settings.appearance.theme_mode")}</p>
          <p className="text-sm text-muted mt-0.5">{t("settings.appearance.theme_mode_desc")}</p>
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
          <p className="font-medium text-foreground">{t("settings.appearance.theme_color")}</p>
          <p className="text-sm text-muted mt-0.5">{t("settings.appearance.theme_color_desc")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {PRESET_COLORS.map((color) => (
            <button
              key={color.name}
              onClick={() => handleColorChange(color.name)}
              className={`relative w-10 h-10 rounded-full transition-all duration-200 cursor-pointer ${
                themeColor === color.name ? "ring-2 ring-offset-2 ring-offset-background scale-110" : "hover:scale-105"
              }`}
              style={{
                backgroundColor: color.colors[500],
                ["--tw-ring-color" as string]: themeColor === color.name ? color.colors[500] : undefined,
              }}
              title={color.label}
            >
              {themeColor === color.name && (
                <svg className="absolute inset-0 m-auto w-5 h-5 drop-shadow-md" fill="none" stroke="white" viewBox="0 0 24 24" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          ))}

          {customColors.map((color) => (
            <button
              key={color.name}
              onClick={() => handleColorChange(color.name)}
              onContextMenu={(e) => handleDeleteCustom(color.name, e)}
              className={`relative w-10 h-10 rounded-full transition-all duration-200 cursor-pointer ${
                themeColor === color.name ? "ring-2 ring-offset-2 ring-offset-background scale-110" : "hover:scale-105"
              }`}
              style={{
                backgroundColor: color.colors[500],
                ["--tw-ring-color" as string]: themeColor === color.name ? color.colors[500] : undefined,
              }}
              title={`${color.label} (right-click to delete)`}
            >
              {themeColor === color.name && (
                <svg className="absolute inset-0 m-auto w-5 h-5 drop-shadow-md" fill="none" stroke="white" viewBox="0 0 24 24" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          ))}

          {/* Add button */}
          <div className="relative" ref={pickerRef}>
            <button
              onClick={() => setShowPicker(!showPicker)}
              className="w-10 h-10 rounded-full border-2 border-dashed border-default-300 hover:border-primary/60 flex items-center justify-center transition-all duration-200 cursor-pointer hover:scale-105 text-muted hover:text-primary"
              title="Add custom color"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
              </svg>
            </button>

            {showPicker && (
              <div className="absolute top-full left-0 mt-2 p-4 rounded-xl border border-separator bg-background glass-surface-strong shadow-xl animate-scale-in z-50 w-64">
                <p className="text-sm font-medium text-foreground mb-3">Custom Color</p>
                <div className="flex items-center gap-3 mb-3">
                  <input
                    ref={inputRef}
                    type="color"
                    value={pickerHex}
                    onChange={(e) => setPickerHex(e.target.value)}
                    className="w-10 h-10 rounded-lg border border-separator cursor-pointer shrink-0"
                  />
                  <input
                    type="text"
                    value={pickerHex}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (/^#[0-9a-fA-F]{6}$/.test(v)) setPickerHex(v);
                    }}
                    className="flex-1 px-3 py-1.5 rounded-lg border border-separator bg-background text-sm text-foreground font-mono"
                    placeholder="#000000"
                  />
                </div>
                <input
                  type="text"
                  value={pickerLabel}
                  onChange={(e) => setPickerLabel(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-separator bg-background text-sm text-foreground mb-3"
                  placeholder="Color name (optional)"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowPicker(false)}
                    className="flex-1 px-3 py-1.5 rounded-lg border border-separator text-sm text-muted hover:text-foreground hover:bg-default-100 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddCustom}
                    className="flex-1 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
                  >
                    Add
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function applyThemeModeLocal(mode: ThemeMode) {
  const root = document.documentElement;
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const isDark = mode === "dark" || (mode === "system" && systemDark);
  root.classList.toggle("dark", isDark);
  root.setAttribute("data-aura-mode", isDark ? "dark" : "light");
}

function dispatchThemeChange() {
  window.dispatchEvent(new CustomEvent("themeChange"));
}
