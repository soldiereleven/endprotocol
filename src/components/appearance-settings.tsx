import { useState, useEffect, useCallback, useRef, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
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
  const [pickerPos, setPickerPos] = useState<{ top: number; left: number } | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [hexDraft, setHexDraft] = useState("");

  const repositionPicker = useCallback(() => {
    if (!showPicker) {
      setPickerPos(null);
      return;
    }
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const panelWidth = 264;
    const panelHeight = 240;
    const gap = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // 默认在触发器下方，空间不足时翻转到上方
    let top = rect.bottom + gap;
    let left = rect.left;
    if (top + panelHeight > vh - 8) {
      top = rect.top - panelHeight - gap;
    }
    top = Math.max(8, Math.min(top, vh - panelHeight - 8));
    left = Math.max(8, Math.min(left, vw - panelWidth - 8));
    setPickerPos({ top, left });
  }, [showPicker]);

  useEffect(() => {
    if (showPicker) {
      setHexDraft(pickerHex);
    }
  }, [showPicker, pickerHex]);

  useLayoutEffect(() => {
    repositionPicker();
  }, [repositionPicker]);

  useEffect(() => {
    if (!showPicker) return;
    window.addEventListener("resize", repositionPicker);
    window.addEventListener("scroll", repositionPicker, true);
    return () => {
      window.removeEventListener("resize", repositionPicker);
      window.removeEventListener("scroll", repositionPicker, true);
    };
  }, [showPicker, repositionPicker]);

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

  // 监听 themeChange（侧边栏切换主题时），保持设置页高亮同步
  useEffect(() => {
    const handler = async () => {
      const [savedMode, savedColor, savedCustom] = await Promise.all([
        getConfig<ThemeMode>("theme_mode"),
        getConfig<string>("theme_color"),
        getConfig<ThemeColor[]>("theme_custom_colors"),
      ]);
      setThemeMode(savedMode ?? "system");
      setThemeColor(savedColor ?? "indigo");
      setCustomColors(savedCustom ?? []);
    };
    window.addEventListener("themeChange", handler);
    return () => window.removeEventListener("themeChange", handler);
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
        // 恢复透明度：不依赖 rAF（透明窗口合成时可能不触发），用普通定时器兜底
        setTimeout(() => {
          rootEl.style.opacity = "1";
          rootEl.style.transition = "";
        }, 40);
      }, 170);
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
    const normalized = pickerHex.replace(/^#?([0-9a-fA-F]{6})$/, "#$1");
    const hex = /^#[0-9a-fA-F]{6}$/.test(normalized) ? normalized : "#6366f1";
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
          <div className="relative" ref={triggerRef}>
            <button
              onClick={() => setShowPicker(!showPicker)}
              className="w-10 h-10 rounded-full border-2 border-dashed border-default-300 hover:border-primary/60 flex items-center justify-center transition-all duration-200 cursor-pointer hover:scale-105 text-muted hover:text-primary"
              title="Add custom color"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
              </svg>
            </button>

            {showPicker && createPortal(
              <>
                <div className="fixed inset-0 z-[9998]" onClick={() => setShowPicker(false)} />
                <div
                  ref={pickerRef}
                  className="fixed p-4 rounded-2xl glass-surface-strong shadow-2xl animate-scale-in z-[9999] w-64"
                  style={{
                    top: pickerPos?.top ?? -9999,
                    left: pickerPos?.left ?? -9999,
                  }}
                >
                  <p className="text-sm font-medium text-foreground mb-3">Custom Color</p>

                  {/* 颜色预览 + 原生取色器 */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="relative w-10 h-10 shrink-0">
                      <input
                        ref={inputRef}
                        type="color"
                        value={pickerHex}
                        onChange={(e) => {
                          setPickerHex(e.target.value);
                          setHexDraft(e.target.value);
                        }}
                        className="absolute inset-0 w-10 h-10 cursor-pointer opacity-0"
                        aria-label="Pick color"
                      />
                      <div
                        className="w-10 h-10 rounded-xl ring-1 ring-separator shadow-inner pointer-events-none"
                        style={{ backgroundColor: pickerHex }}
                      />
                    </div>
                    <input
                      type="text"
                      value={hexDraft}
                      onChange={(e) => {
                        const v = e.target.value;
                        setHexDraft(v);
                        if (/^#[0-9a-fA-F]{6}$/.test(v)) setPickerHex(v);
                      }}
                      onBlur={() => {
                        if (/^#[0-9a-fA-F]{6}$/.test(hexDraft)) {
                          setPickerHex(hexDraft);
                        } else {
                          setHexDraft(pickerHex);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && /^#[0-9a-fA-F]{6}$/.test(hexDraft)) {
                          setPickerHex(hexDraft);
                          handleAddCustom();
                        }
                      }}
                      className="glass-field flex-1 min-w-0 h-9 px-3 rounded-xl text-sm text-foreground placeholder:text-muted/70 font-mono transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/40"
                      placeholder="#000000"
                      maxLength={7}
                    />
                  </div>

                  <input
                    type="text"
                    value={pickerLabel}
                    onChange={(e) => setPickerLabel(e.target.value)}
                    className="glass-field w-full min-w-0 h-9 px-3 rounded-xl text-sm text-foreground placeholder:text-muted/70 mb-3 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/40"
                    placeholder="Color name (optional)"
                  />

                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowPicker(false)}
                      className="flex-1 h-9 px-3 rounded-xl glass-field text-sm text-muted hover:text-foreground transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAddCustom}
                      className="flex-1 h-9 px-3 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity cursor-pointer"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </>,
              document.body,
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
