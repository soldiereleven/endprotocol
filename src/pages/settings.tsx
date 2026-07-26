import { useTranslation } from "react-i18next";
import { Card, Button, Switch, AlertDialog, Skeleton } from "@heroui/react";
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
  const [wikiDetailPreload, setWikiDetailPreload] = useState(false);
  const [themeChangeKey, setThemeChangeKey] = useState(0);

  const [developerMode, setDeveloperMode] = useState(false);
  const [showDevWarning, setShowDevWarning] = useState(false);
  const [isConfigLoading, setIsConfigLoading] = useState(true);

  const languages = [
    { key: "en", label: "English" },
    { key: "zh", label: "简体中文" },
  ];

  useEffect(() => {
    const loadConfig = async () => {
      setIsConfigLoading(true);
      const [value, lazyLoadValue, devMode, wikiPreload] = await Promise.all([
        getConfig<boolean>("refresh_on_account_switch"),
        roleDetailService.isLazyLoadEnabled(),
        getConfig<boolean>("developer_mode"),
        getConfig<boolean>("wiki_detail_preload"),
      ]);
      setRefreshOnSwitch(value ?? false);
      setLazyLoadEnabled(lazyLoadValue);
      setWikiDetailPreload(wikiPreload ?? false);
      setDeveloperMode(devMode ?? false);
      setIsConfigLoading(false);
    };
    loadConfig();
  }, []);

  useEffect(() => {
    const handleThemeChange = () => {
      setThemeChangeKey((prev) => prev + 1);
    };

    window.addEventListener("themeChange", handleThemeChange);
    return () => {
      window.removeEventListener("themeChange", handleThemeChange);
    };
  }, []);

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
    } catch {
      setLazyLoadEnabled(!value);
    }
  };

  const handleWikiDetailPreloadChange = async (value: boolean) => {
    setWikiDetailPreload(value);
    await setConfig("wiki_detail_preload", value);
  };

  const handleDevModeToggle = (value: boolean) => {
    if (value) {
      setShowDevWarning(true);
    } else {
      setDeveloperMode(false);
      setConfig("developer_mode", false);
      window.dispatchEvent(
        new CustomEvent("developerModeChange", { detail: { enabled: false } })
      );
    }
  };

  const confirmDevMode = () => {
    setDeveloperMode(true);
    setConfig("developer_mode", true);
    setShowDevWarning(false);
    window.dispatchEvent(
      new CustomEvent("developerModeChange", { detail: { enabled: true } })
    );
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-foreground tracking-tight">
          {t("settings.title")}
        </h1>
        <p className="text-muted/80 mt-1.5">{t("common.managePreferences")}</p>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* General Settings */}
        <Card id="settings-general" className="p-6 glass-surface border border-separator/90">
          <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
            <span className="w-1 h-5 bg-primary rounded-full" />
            {t("settings.general.title")}
          </h2>
          {isConfigLoading ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <Skeleton className="w-32 h-4 rounded-lg" />
                  <Skeleton className="w-48 h-3 rounded-lg" />
                </div>
                <Skeleton className="w-40 h-10 rounded-lg" />
              </div>
              <div className="h-px bg-separator w-full" />
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <Skeleton className="w-24 h-4 rounded-lg" />
                  <Skeleton className="w-40 h-3 rounded-lg" />
                </div>
                <Skeleton className="w-12 h-6 rounded-full" />
              </div>
              <div className="h-px bg-separator w-full" />
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <Skeleton className="w-36 h-4 rounded-lg" />
                  <Skeleton className="w-56 h-3 rounded-lg" />
                </div>
                <Skeleton className="w-12 h-6 rounded-full" />
              </div>
              <div className="h-px bg-separator w-full" />
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <Skeleton className="w-28 h-4 rounded-lg" />
                  <Skeleton className="w-44 h-3 rounded-lg" />
                </div>
                <Skeleton className="w-12 h-6 rounded-full" />
              </div>
              <div className="h-px bg-separator w-full" />
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <Skeleton className="w-36 h-4 rounded-lg" />
                  <Skeleton className="w-56 h-3 rounded-lg" />
                </div>
                <Skeleton className="w-12 h-6 rounded-full" />
              </div>
            </div>
          ) : (
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
              <div className="w-full sm:w-44" ref={langDropdownRef}>
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
                      className={`w-4 h-4 transition-transform duration-200 ${isLangDropdownOpen ? "rotate-180" : ""}`}
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
                    <div className="absolute left-0 right-0 mt-2 glass-surface border border-separator/80 rounded-xl shadow-xl z-50 overflow-hidden animate-scale-in">
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
                                className="w-4 h-4 text-primary"
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
              <div className="p-1.5 rounded-xl bg-default-100/60">
                <ThemeSwitch />
              </div>
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

            <div className="h-px bg-separator w-full" />

            <div
              id="settings-wiki-detail-preload"
              className="flex items-center justify-between"
            >
              <div>
                <p className="font-medium text-foreground">
                  {i18n.language === "zh"
                    ? "启动时预加载 Wiki 详情"
                    : "Preload Wiki Details on Startup"}
                </p>
                <p className="text-sm text-muted mt-0.5">
                  {i18n.language === "zh"
                    ? "关闭后将按需逐个加载角色 Wiki 详情，加快启动速度"
                    : "When disabled, wiki details load on demand per character"}
                </p>
              </div>
              <Switch
                isSelected={wikiDetailPreload}
                onChange={handleWikiDetailPreloadChange}
              >
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
              </Switch>
            </div>
          </div>
          )}
        </Card>

        {/* Developer Mode */}
        <Card id="settings-developer" className="p-6 glass-surface border border-separator/90">
          {isConfigLoading ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <Skeleton className="w-32 h-4 rounded-lg" />
                  <Skeleton className="w-48 h-3 rounded-lg" />
                </div>
                <Skeleton className="w-12 h-6 rounded-full" />
              </div>
            </div>
          ) : (
          <>
          <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
            <span className="w-1 h-5 bg-warning rounded-full" />
            {t("settings.developer.title")}
          </h2>
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">
                  {t("settings.developer.enable")}
                </p>
                <p className="text-sm text-muted mt-0.5">
                  {t("settings.developer.enable_desc")}
                </p>
              </div>
              <Switch
                isSelected={developerMode}
                onChange={handleDevModeToggle}
              >
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
              </Switch>
            </div>
          </div>
          </>
          )}
        </Card>
      </div>

      {/* Developer Mode Warning Dialog */}
      <AlertDialog isOpen={showDevWarning} onOpenChange={setShowDevWarning}>
        <AlertDialog.Backdrop>
          <AlertDialog.Container>
            <AlertDialog.Dialog className="sm:max-w-[400px]">
              <AlertDialog.CloseTrigger />
              <AlertDialog.Header>
                <AlertDialog.Icon status="warning" />
                <AlertDialog.Heading>
                  {t("settings.developer.warning_title")}
                </AlertDialog.Heading>
              </AlertDialog.Header>
              <AlertDialog.Body>
                <p>{t("settings.developer.warning_body")}</p>
              </AlertDialog.Body>
              <AlertDialog.Footer>
                <Button variant="tertiary" onPress={() => setShowDevWarning(false)}>
                  {t("settings.developer.warning_cancel")}
                </Button>
                <Button variant="primary" onPress={confirmDevMode}>
                  {t("settings.developer.warning_confirm")}
                </Button>
              </AlertDialog.Footer>
            </AlertDialog.Dialog>
          </AlertDialog.Container>
        </AlertDialog.Backdrop>
      </AlertDialog>
    </div>
  );
}
