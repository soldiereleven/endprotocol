import { useTranslation } from "react-i18next";
import { GlassAlertDialog, GlassButton, GlassCard, GlassSkeleton, GlassSwitch } from "@/components/ui/glass";
import { AppearanceSettings } from "@/components/appearance-settings";
import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { getConfig, setConfig } from "@/utils/configService";
import { roleDetailService } from "@/utils/roleDetailService";
import { SettingsDivider } from "@/components/ui/settings-row";

export default function SettingsPage() {
  const { t, i18n } = useTranslation();
  const [isLangDropdownOpen, setIsLangDropdownOpen] = useState(false);
  const langDropdownRef = useRef<HTMLDivElement>(null);
  const langBtnRef = useRef<HTMLButtonElement>(null);
  const langDropdownMenuRef = useRef<HTMLDivElement>(null);
  const [langDropdownPos, setLangDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const [refreshOnSwitch, setRefreshOnSwitch] = useState(false);
  const [lazyLoadEnabled, setLazyLoadEnabled] = useState(true);
  const [wikiDetailPreload, setWikiDetailPreload] = useState(false);

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
    if (!isLangDropdownOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (langDropdownMenuRef.current?.contains(event.target as Node)) return;
      if (langDropdownRef.current?.contains(event.target as Node)) return;
      setIsLangDropdownOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
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
        <p className="text-foreground/70 mt-1.5">{t("common.managePreferences")}</p>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* General Settings */}
        <GlassCard id="settings-general" className="p-6 glass-surface border border-separator/90">
          <h2 className="text-lg font-semibold mb-6 flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center ring-1 ring-primary/20">
              <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
              </svg>
            </div>
            {t("settings.general.title")}
          </h2>
          {isConfigLoading ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-2 flex-1">
                  <GlassSkeleton className="w-32 h-4 rounded-lg" />
                  <GlassSkeleton className="w-48 h-3 rounded-lg" />
                </div>
                <GlassSkeleton className="w-40 h-10 rounded-lg shrink-0" />
              </div>
              <SettingsDivider />
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-2 flex-1">
                  <GlassSkeleton className="w-24 h-4 rounded-lg" />
                  <GlassSkeleton className="w-40 h-3 rounded-lg" />
                </div>
                <GlassSkeleton className="w-12 h-6 rounded-full shrink-0" />
              </div>
              <SettingsDivider />
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-2 flex-1">
                  <GlassSkeleton className="w-36 h-4 rounded-lg" />
                  <GlassSkeleton className="w-56 h-3 rounded-lg" />
                </div>
                <GlassSkeleton className="w-12 h-6 rounded-full shrink-0" />
              </div>
              <SettingsDivider />
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-2 flex-1">
                  <GlassSkeleton className="w-28 h-4 rounded-lg" />
                  <GlassSkeleton className="w-44 h-3 rounded-lg" />
                </div>
                <GlassSkeleton className="w-12 h-6 rounded-full shrink-0" />
              </div>
              <SettingsDivider />
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-2 flex-1">
                  <GlassSkeleton className="w-36 h-4 rounded-lg" />
                  <GlassSkeleton className="w-56 h-3 rounded-lg" />
                </div>
                <GlassSkeleton className="w-12 h-6 rounded-full shrink-0" />
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
              <div className="w-full sm:w-48" ref={langDropdownRef}>
                <GlassButton
                  ref={langBtnRef}
                  variant="outline"
                  className="w-full justify-between gap-2"
                  onPress={() => {
                    const next = !isLangDropdownOpen;
                    if (next && langBtnRef.current) {
                      const r = langBtnRef.current.getBoundingClientRect();
                      setLangDropdownPos({ top: r.bottom + 8, left: r.left, width: r.width });
                    }
                    setIsLangDropdownOpen(next);
                  }}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <svg className="w-4 h-4 text-muted shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M2 12h20" />
                      <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
                    </svg>
                    <span className="truncate">
                      {languages.find((lang) => lang.key === i18n.language)
                        ?.label ||
                        (i18n.language === "zh" ? "简体中文" : "English")}
                    </span>
                  </span>
                  <svg
                    className={`w-4 h-4 shrink-0 transition-transform duration-200 ${isLangDropdownOpen ? "rotate-180" : ""}`}
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
                </GlassButton>

                {isLangDropdownOpen && createPortal(
                  <div
                    ref={langDropdownMenuRef}
                    className="fixed z-[9999] overflow-y-auto rounded-xl border border-separator/60 bg-background glass-surface-strong shadow-xl animate-scale-in"
                    style={{ top: langDropdownPos.top, left: langDropdownPos.left, width: langDropdownPos.width }}
                    onClick={(e) => e.stopPropagation()}
                  >
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
                  </div>,
                  document.body,
                )}
              </div>
            </div>

            <SettingsDivider />

            <div
              id="settings-refresh-on-switch"
              className="flex items-center justify-between gap-4"
            >
              <div className="min-w-0">
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
              <GlassSwitch
                isSelected={refreshOnSwitch}
                onValueChange={handleRefreshOnSwitchChange}
              >
                <GlassSwitch.Control>
                  <GlassSwitch.Thumb />
                </GlassSwitch.Control>
              </GlassSwitch>
            </div>

            <SettingsDivider />

            <div
              id="settings-lazy-load"
              className="flex items-center justify-between gap-4"
            >
              <div className="min-w-0">
                <p className="font-medium text-foreground">
                  {i18n.language === "zh" ? "懒加载模式" : "Lazy Load Mode"}
                </p>
                <p className="text-sm text-muted mt-0.5">
                  {i18n.language === "zh"
                    ? "开启时只加载当前角色的数据，节省内存"
                    : "Only load current role's data when enabled, saving memory"}
                </p>
              </div>
              <GlassSwitch
                isSelected={lazyLoadEnabled}
                onValueChange={handleLazyLoadChange}
              >
                <GlassSwitch.Control>
                  <GlassSwitch.Thumb />
                </GlassSwitch.Control>
              </GlassSwitch>
            </div>

            <SettingsDivider />

            <div
              id="settings-wiki-detail-preload"
              className="flex items-center justify-between gap-4"
            >
              <div className="min-w-0">
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
              <GlassSwitch
                isSelected={wikiDetailPreload}
                onValueChange={handleWikiDetailPreloadChange}
              >
                <GlassSwitch.Control>
                  <GlassSwitch.Thumb />
                </GlassSwitch.Control>
              </GlassSwitch>
            </div>
          </div>
          )}
        </GlassCard>

        {/* Appearance Settings */}
        <GlassCard id="settings-appearance" className="p-6 glass-surface border border-separator/90">
          <h2 className="text-lg font-semibold mb-6 flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center ring-1 ring-primary/20">
              <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                <path d="M12 2.69l5.66 5.66a8 8 0 11-11.31 0z" />
              </svg>
            </div>
            {t("settings.appearance.title")}
          </h2>
          <AppearanceSettings />
        </GlassCard>

        {/* Developer Mode */}
        <GlassCard id="settings-developer" className="p-6 glass-surface border border-separator/90">
          {isConfigLoading ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-2 flex-1">
                  <GlassSkeleton className="w-32 h-4 rounded-lg" />
                  <GlassSkeleton className="w-48 h-3 rounded-lg" />
                </div>
                <GlassSkeleton className="w-12 h-6 rounded-full shrink-0" />
              </div>
            </div>
          ) : (
          <>
          <h2 className="text-lg font-semibold mb-6 flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center ring-1 ring-primary/20">
              <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                <polyline points="16 18 22 12 16 6" />
                <polyline points="8 6 2 12 8 18" />
              </svg>
            </div>
            {t("settings.developer.title")}
          </h2>
          <div className="space-y-6">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="font-medium text-foreground">
                  {t("settings.developer.enable")}
                </p>
                <p className="text-sm text-muted mt-0.5">
                  {t("settings.developer.enable_desc")}
                </p>
              </div>
              <GlassSwitch
                isSelected={developerMode}
                onValueChange={handleDevModeToggle}
              >
                <GlassSwitch.Control>
                  <GlassSwitch.Thumb />
                </GlassSwitch.Control>
              </GlassSwitch>
            </div>
          </div>
          </>
          )}
        </GlassCard>
      </div>

      {/* Developer Mode Warning Dialog */}
      <GlassAlertDialog isOpen={showDevWarning} onOpenChange={setShowDevWarning}>
        <GlassAlertDialog.Backdrop>
          <GlassAlertDialog.Container>
            <GlassAlertDialog.Dialog className="sm:max-w-[400px]">
              <GlassAlertDialog.CloseTrigger />
              <GlassAlertDialog.Header>
                <GlassAlertDialog.Icon status="warning" />
                <GlassAlertDialog.Heading>
                  {t("settings.developer.warning_title")}
                </GlassAlertDialog.Heading>
              </GlassAlertDialog.Header>
              <GlassAlertDialog.Body>
                <p>{t("settings.developer.warning_body")}</p>
              </GlassAlertDialog.Body>
              <GlassAlertDialog.Footer>
                <GlassButton variant="tertiary" onPress={() => setShowDevWarning(false)}>
                  {t("settings.developer.warning_cancel")}
                </GlassButton>
                <GlassButton variant="primary" onPress={confirmDevMode}>
                  {t("settings.developer.warning_confirm")}
                </GlassButton>
              </GlassAlertDialog.Footer>
            </GlassAlertDialog.Dialog>
          </GlassAlertDialog.Container>
        </GlassAlertDialog.Backdrop>
      </GlassAlertDialog>
    </div>
  );
}
