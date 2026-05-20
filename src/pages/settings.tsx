import { useTranslation } from "react-i18next";
import { Card, Button, Switch, Label } from "@heroui/react";
import { ThemeSwitch } from "@/components/theme-switch";
import { useState, useEffect, useRef } from "react";
import { getConfig, setConfig } from "@/utils/configService";
import { roleDetailService } from "@/utils/roleDetailService";

export default function SettingsPage() {
  const { t, i18n } = useTranslation();
  const [isLangDropdownOpen, setIsLangDropdownOpen] = useState(false);
  const langDropdownRef = useRef<HTMLDivElement>(null);
  const [refreshOnSwitch, setRefreshOnSwitch] = useState(false);
  const [lazyLoadEnabled, setLazyLoadEnabled] = useState(true);
  const [themeChangeKey, setThemeChangeKey] = useState(0);

  const languages = [
    { key: "en", label: "English" },
    { key: "zh", label: "简体中文" },
  ];

  // Load config on mount
  useEffect(() => {
    const loadConfig = async () => {
      const value = await getConfig<boolean>("refresh_on_account_switch");
      setRefreshOnSwitch(value ?? false); // 默认为false

      // 加载懒加载配置
      const lazyLoadValue = await roleDetailService.isLazyLoadEnabled();
      setLazyLoadEnabled(lazyLoadValue);
    };
    loadConfig();
  }, []);

  // 监听主题变化，强制重新渲染
  useEffect(() => {
    const handleThemeChange = () => {
      setThemeChangeKey((prev) => prev + 1);
    };

    window.addEventListener("themeChange", handleThemeChange);
    return () => {
      window.removeEventListener("themeChange", handleThemeChange);
    };
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        langDropdownRef.current &&
        !langDropdownRef.current.contains(event.target as Node)
      ) {
        setIsLangDropdownOpen(false);
      }
    };

    if (isLangDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isLangDropdownOpen]);

  const handleLanguageChange = (langKey: string) => {
    i18n.changeLanguage(langKey);
    setIsLangDropdownOpen(false);
  };

  const handleRefreshOnSwitchChange = async (value: boolean) => {
    setRefreshOnSwitch(value);
    await setConfig("refresh_on_account_switch", value);
  };

  const handleLazyLoadChange = async (value: boolean) => {
    setLazyLoadEnabled(value);
    try {
      await roleDetailService.setLazyLoadEnabled(value);
    } catch (error) {
      console.error("Failed to set lazy load:", error);
      // 回滚状态
      setLazyLoadEnabled(!value);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-foreground">
          {t("settings.title")}
        </h1>
        <p className="text-muted mt-1">{t("common.managePreferences")}</p>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* General Settings */}
        <Card id="settings-general" className="p-6 bg-content1 shadow-sm">
          <h2 className="text-lg font-semibold mb-6">
            {t("settings.general.title")}
          </h2>
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div id="settings-language">
                <p className="font-medium text-foreground">
                  {t("settings.general.language")}
                </p>
                <p className="text-sm text-muted mt-0.5">
                  {i18n.language === "zh"
                    ? "选择您偏好的界面语言"
                    : "Choose your preferred language"}
                </p>
              </div>
              <div className="w-full sm:w-48" ref={langDropdownRef}>
                <div className="relative">
                  <Button
                    variant="outline"
                    className="w-full justify-between"
                    onPress={() => setIsLangDropdownOpen(!isLangDropdownOpen)}
                  >
                    <span>
                      {languages.find((lang) => lang.key === i18n.language)
                        ?.label ||
                        (i18n.language === "zh" ? "简体中文" : "English")}
                    </span>
                    <svg
                      className={`w-4 h-4 transition-transform ${isLangDropdownOpen ? "rotate-180" : ""}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </Button>

                  {isLangDropdownOpen && (
                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-content1 border border-separator rounded-lg shadow-lg z-50 min-w-[200px]">
                      <div className="py-1">
                        {languages.map((lang) => (
                          <button
                            key={lang.key}
                            className="w-full px-4 py-2.5 text-left hover:bg-default-100 transition-colors flex items-center justify-between"
                            onClick={() => handleLanguageChange(lang.key)}
                          >
                            <span className="text-sm">{lang.label}</span>
                            {i18n.language === lang.key && (
                              <svg
                                className="w-4 h-4 text-success"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="h-px bg-separator w-full" />

            <div
              key={themeChangeKey}
              id="settings-theme"
              className="flex items-center justify-between"
            >
              <div>
                <p className="font-medium text-foreground">
                  {t("settings.general.theme")}
                </p>
                <p className="text-sm text-muted mt-0.5">
                  {i18n.language === "zh"
                    ? "切换深色或浅色模式"
                    : "Toggle light or dark mode"}
                </p>
              </div>
              <ThemeSwitch />
            </div>

            <div className="h-px bg-separator w-full" />

            <div
              id="settings-refresh-on-switch"
              className="flex items-center justify-between"
            >
              <div>
                <p className="font-medium text-foreground">
                  {i18n.language === "zh"
                    ? "切换账户时刷新数据"
                    : "Refresh on Account Switch"}
                </p>
                <p className="text-sm text-muted mt-0.5">
                  {i18n.language === "zh"
                    ? "切换账户时是否访问API获取最新数据"
                    : "Whether to fetch latest data from API when switching accounts"}
                </p>
              </div>
              <Switch
                isSelected={refreshOnSwitch}
                onChange={handleRefreshOnSwitchChange}
              >
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
              </Switch>
            </div>

            <div className="h-px bg-separator w-full" />

            <div
              id="settings-lazy-load"
              className="flex items-center justify-between"
            >
              <div>
                <p className="font-medium text-foreground">
                  {i18n.language === "zh" ? "懒加载模式" : "Lazy Load Mode"}
                </p>
                <p className="text-sm text-muted mt-0.5">
                  {i18n.language === "zh"
                    ? "开启时只加载当前角色的数据，节省内存"
                    : "Only load current role's data when enabled, saving memory"}
                </p>
              </div>
              <Switch
                isSelected={lazyLoadEnabled}
                onChange={handleLazyLoadChange}
              >
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
              </Switch>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
