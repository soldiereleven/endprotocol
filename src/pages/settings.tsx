import { useTranslation } from "react-i18next";
import { GlassAlertDialog, GlassButton, GlassCard, GlassSkeleton, GlassSwitch } from "@/components/ui/glass";
import { AppearanceSettings } from "@/components/appearance-settings";
import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { getVersion, getTauriVersion, getIdentifier } from "@tauri-apps/api/app";
import { getConfig, setConfig } from "@/utils/configService";
import { roleDetailService } from "@/utils/roleDetailService";
import { SettingsDivider } from "@/components/ui/settings-row";
import {
  fetchRemoteVersion,
  getRemoteVersion,
  subscribeRemoteVersion,
  downloadAndInstall,
  type RemoteVersionState,
} from "@/utils/updateService";
import { pushGlobalAlert } from "@/components/ui/global-alert";

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
  const [appVersion, setAppVersion] = useState("");
  const [tauriVersion, setTauriVersion] = useState("");
  const [appId, setAppId] = useState("");
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [remoteVersion, setRemoteVersion] = useState<RemoteVersionState>(getRemoteVersion());
  const [isDownloadingUpdate, setIsDownloadingUpdate] = useState(false);

  const languages = [
    { key: "en", label: "English" },
    { key: "zh", label: "简体中文" },
  ];

  useEffect(() => {
    const loadConfig = async () => {
      setIsConfigLoading(true);
      const [value, lazyLoadValue, devMode, wikiPreload, version, tauriVer, identifier] = await Promise.all([
        getConfig<boolean>("refresh_on_account_switch"),
        roleDetailService.isLazyLoadEnabled(),
        getConfig<boolean>("developer_mode"),
        getConfig<boolean>("wiki_detail_preload"),
        getVersion(),
        getTauriVersion(),
        getIdentifier(),
      ]);
      setRefreshOnSwitch(value ?? false);
      setLazyLoadEnabled(lazyLoadValue);
      setWikiDetailPreload(wikiPreload ?? false);
      setDeveloperMode(devMode ?? false);
      setAppVersion(version);
      setTauriVersion(tauriVer);
      setAppId(identifier);
      setIsConfigLoading(false);
    };
    loadConfig();

    // Auto-fetch remote version on mount
    fetchRemoteVersion();

    // Subscribe to remote version changes
    const unsub = subscribeRemoteVersion(() => {
      setRemoteVersion(getRemoteVersion());
    });
    return unsub;
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

  const handleCheckUpdate = async () => {
    if (isCheckingUpdate) return;
    setIsCheckingUpdate(true);
    try {
      await fetchRemoteVersion();
      const state = getRemoteVersion();
      if (state.hasUpdate) {
        pushGlobalAlert("success", i18n.language === "zh" ? "发现新版本！" : "Update available!");
      } else if (state.error) {
        pushGlobalAlert("danger", i18n.language === "zh" ? "检查更新失败" : "Failed to check for updates");
      } else {
        pushGlobalAlert("success", i18n.language === "zh" ? "已是最新版本" : "Already up to date");
      }
    } catch {
      pushGlobalAlert("danger", i18n.language === "zh" ? "检查更新失败" : "Failed to check for updates");
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  const handleDownloadUpdate = async () => {
    if (isDownloadingUpdate) return;
    setIsDownloadingUpdate(true);
    try {
      await downloadAndInstall();
    } finally {
      setIsDownloadingUpdate(false);
    }
  };

  const platformInfo = (() => {
    const ua = navigator.userAgent;
    if (ua.includes("Win")) return "Windows x64";
    if (ua.includes("Mac")) return "macOS";
    if (ua.includes("Linux")) return "Linux";
    return navigator.platform || "Unknown";
  })();

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

        {/* About */}
        <GlassCard id="settings-about" className="p-6 glass-surface border border-separator/90">
          <h2 className="text-lg font-semibold mb-6 flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center ring-1 ring-primary/20">
              <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4M12 8h.01" />
              </svg>
            </div>
            {i18n.language === "zh" ? "关于" : "About"}
          </h2>

          <div className="space-y-5">
            {/* App Header */}
            <div className="flex items-center gap-4">
              <img
                src="/app-icon.png"
                alt="EndProtocol"
                className="w-16 h-16 rounded-2xl ring-1 ring-separator/50"
              />
              <div className="flex-1 min-w-0">
                <h3 className="text-xl font-bold text-foreground">EndProtocol</h3>
                <p className="text-sm text-muted mt-0.5">
                  {i18n.language === "zh"
                    ? "跨平台森空岛桌面客户端"
                    : "Cross-platform Skland desktop client"}
                </p>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  {remoteVersion.hasUpdate ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-danger/15 text-danger border border-danger/20">
                      {i18n.language === "zh" ? "有新版本" : "Update Available"}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-success/15 text-success border border-success/20">
                      {i18n.language === "zh" ? "已是最新" : "Up to Date"}
                    </span>
                  )}
                  <span className="text-[11px] text-muted">v{appVersion || "..."}</span>
                </div>
              </div>
            </div>

            <SettingsDivider />

            {/* Version Info */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl glass-surface border border-separator/40">
                <p className="text-[11px] text-muted uppercase tracking-wider mb-1">
                  {i18n.language === "zh" ? "应用版本" : "App Version"}
                </p>
                <p className="text-sm font-semibold text-foreground">{appVersion || "..."}</p>
              </div>
              <div className="p-3 rounded-xl glass-surface border border-separator/40">
                <p className="text-[11px] text-muted uppercase tracking-wider mb-1">
                  {i18n.language === "zh" ? "Tauri 版本" : "Tauri Version"}
                </p>
                <p className="text-sm font-semibold text-foreground">{tauriVersion || "..."}</p>
              </div>
              <div className="p-3 rounded-xl glass-surface border border-separator/40">
                <p className="text-[11px] text-muted uppercase tracking-wider mb-1">
                  {i18n.language === "zh" ? "平台" : "Platform"}
                </p>
                <p className="text-sm font-semibold text-foreground">{platformInfo}</p>
              </div>
              <div className="p-3 rounded-xl glass-surface border border-separator/40">
                <p className="text-[11px] text-muted uppercase tracking-wider mb-1">
                  {i18n.language === "zh" ? "远端最新版本" : "Latest Version"}
                </p>
                <p className="text-sm font-semibold text-foreground">
                  {remoteVersion.loading
                    ? "..."
                    : remoteVersion.error
                      ? (i18n.language === "zh" ? "获取失败" : "Failed")
                      : remoteVersion.version
                        ? `v${remoteVersion.version}`
                        : appVersion ? `v${appVersion}` : "..."}
                </p>
              </div>
            </div>

            {remoteVersion.date && (
              <div className="text-[11px] text-muted">
                {i18n.language === "zh" ? "发布日期" : "Released"}: {new Date(remoteVersion.date).toLocaleDateString()}
              </div>
            )}

            {/* Update Button */}
            {remoteVersion.hasUpdate && (
              <GlassButton
                variant="primary"
                fullWidth
                onPress={handleDownloadUpdate}
                isLoading={isDownloadingUpdate}
                startContent={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                }
              >
                {isDownloadingUpdate
                  ? (i18n.language === "zh" ? "下载中..." : "Downloading...")
                  : (i18n.language === "zh" ? `更新到 v${remoteVersion.version}` : `Update to v${remoteVersion.version}`)}
              </GlassButton>
            )}

            {/* Refresh Check Button */}
            <GlassButton
              variant="outline"
              fullWidth
              onPress={handleCheckUpdate}
              disabled={isCheckingUpdate}
              startContent={
                <svg className={`w-4 h-4 ${isCheckingUpdate ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              }
            >
              {isCheckingUpdate
                ? (i18n.language === "zh" ? "检查中..." : "Checking...")
                : (i18n.language === "zh" ? "检查更新" : "Check for Updates")}
            </GlassButton>

            <SettingsDivider />

            {/* Identifier */}
            <div className="text-[11px] text-muted/60 font-mono break-all">
              {appId}
            </div>

            <SettingsDivider />

            {/* License */}
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-2">
                {i18n.language === "zh" ? "许可证" : "License"}
              </h4>
              <p className="text-xs text-muted">
                GNU Affero General Public License v3.0 (AGPL-3.0)
              </p>
              <p className="text-[11px] text-muted/60 mt-1">
                {i18n.language === "zh"
                  ? "本软件采用 AGPL-3.0 许可证开源"
                  : "This software is open source under the AGPL-3.0 license"}
              </p>
            </div>

            <SettingsDivider />

            {/* Open Source Credits */}
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-3">
                {i18n.language === "zh" ? "开源致谢" : "Open Source Credits"}
              </h4>
              <div className="space-y-1.5">
                {[
                  { name: "Tauri", url: "https://tauri.app", desc: "Desktop framework" },
                  { name: "React", url: "https://react.dev", desc: "UI library" },
                  { name: "React Router", url: "https://reactrouter.com", desc: "Client-side routing" },
                  { name: "Vite", url: "https://vitejs.dev", desc: "Build tool" },
                  { name: "TypeScript", url: "https://www.typescriptlang.org", desc: "Type-safe JavaScript" },
                  { name: "Tailwind CSS", url: "https://tailwindcss.com", desc: "CSS framework" },
                  { name: "aura-glass", url: "https://github.com/user/aura-glass", desc: "Glassmorphism UI kit" },
                  { name: "ECharts", url: "https://echarts.apache.org", desc: "Charting library" },
                  { name: "Lucide", url: "https://lucide.dev", desc: "Icon library" },
                  { name: "morphicons", url: "https://github.com/nicedoc/morphicons", desc: "Morphing icons" },
                  { name: "i18next", url: "https://www.i18next.com", desc: "Internationalization" },
                  { name: "react-i18next", url: "https://github.com/i18next/react-i18next", desc: "React i18n bindings" },
                  { name: "clsx", url: "https://github.com/lukeed/clsx", desc: "Class name utility" },
                  { name: "Tailwind Variants", url: "https://tailwind-variants.com", desc: "Variant management" },
                  { name: "dnd-kit", url: "https://dndkit.com", desc: "Drag and drop" },
                  { name: "qrcode", url: "https://github.com/soldair/qrcode", desc: "QR code generation" },
                  { name: "react-beautiful-color", url: "https://github.com/nicedoc/react-beautiful-color", desc: "Color picker" },
                  { name: "uuid", url: "https://github.com/uuidjs/uuid", desc: "UUID generation" },
                  { name: "Tauri Plugin Updater", url: "https://github.com/tauri-apps/plugins-workspace/tree/v2/plugins/updater", desc: "In-app updater" },
                  { name: "Tauri Plugin Opener", url: "https://github.com/tauri-apps/plugins-workspace/tree/v2/plugins/opener", desc: "URL/file opener" },
                ].map((lib) => (
                  <div key={lib.name} className="flex items-center justify-between py-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-medium text-foreground">{lib.name}</span>
                      <span className="text-[10px] text-muted/50 hidden sm:inline">{lib.desc}</span>
                    </div>
                    <a
                      href={lib.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-primary hover:text-primary/80 hover:underline shrink-0"
                    >
                      {lib.url.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                    </a>
                  </div>
                ))}
              </div>
            </div>

            <SettingsDivider />

            {/* Links */}
            <div className="flex items-center gap-3">
              <a
                href="https://github.com/soldiereleven/endprotocol"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-foreground transition-colors"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
                GitHub
              </a>
              <a
                href="https://github.com/soldiereleven/endprotocol/blob/main/LICENSE"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-foreground transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                License
              </a>
            </div>
          </div>
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
