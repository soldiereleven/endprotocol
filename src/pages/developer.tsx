import { useTranslation } from "react-i18next";
import {
  GlassButton,
  GlassCard,
  GlassLabel,
  GlassMeter,
  GlassNumberField,
  GlassSkeleton,
  GlassSwitch,
  GlassTable,
} from "@/components/ui/glass";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { getConfig, setConfig } from "@/utils/configService";
import { cacheManager, CacheMode } from "@/utils/imageCacheManager";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import logger, { LogEntry, LogLevel } from "@/utils/logger";
import { invoke } from "@tauri-apps/api/core";
import { logError } from "@/utils/logger";
import { MorphIcon } from "morphicons/react";
import { FileText, Settings } from "lucide";

interface WikiDumpEntry {
  name: string;
  path: string;
  code: number | null;
  message: string | null;
  catalog_count: number;
  type_sub_count: number;
  item_count: number;
}

interface UserInfoDumpEntry {
  name: string;
  path: string;
  code: number | null;
  message: string | null;
  info: string;
}

const LOG_LEVEL_NAMES: Record<LogLevel, string> = {
  [LogLevel.DEBUG]: "DEBUG",
  [LogLevel.INFO]: "INFO",
  [LogLevel.WARN]: "WARN",
  [LogLevel.ERROR]: "ERROR",
};

const LEVEL_BADGE_BG: Record<LogLevel, string> = {
  [LogLevel.DEBUG]: "bg-secondary",
  [LogLevel.INFO]: "bg-success",
  [LogLevel.WARN]: "bg-warning",
  [LogLevel.ERROR]: "bg-danger",
};

const LEVEL_TEXT: Record<LogLevel, string> = {
  [LogLevel.DEBUG]: "text-secondary",
  [LogLevel.INFO]: "text-success",
  [LogLevel.WARN]: "text-warning",
  [LogLevel.ERROR]: "text-danger",
};

const LEVEL_BG_SOFT: Record<LogLevel, string> = {
  [LogLevel.DEBUG]: "bg-secondary/15",
  [LogLevel.INFO]: "bg-success/15",
  [LogLevel.WARN]: "bg-warning/15",
  [LogLevel.ERROR]: "bg-danger/15",
};

const LEVEL_BORDER: Record<LogLevel, string> = {
  [LogLevel.DEBUG]: "border-secondary",
  [LogLevel.INFO]: "border-success",
  [LogLevel.WARN]: "border-warning",
  [LogLevel.ERROR]: "border-danger",
};

const MAX_VISIBLE_LOGS = 500;
const MAX_MESSAGE_LENGTH = 300;

type LogFilter = "all" | "frontend" | "backend";
type LogLevelFilter = LogLevel | "all";

export default function DeveloperPage() {
  const { t, i18n } = useTranslation();

  const [cacheMode, setCacheMode] = useState<CacheMode>("smart");
  const [cacheMaxEntries, setCacheMaxEntries] = useState(200);
  const [cacheMaxSizeMB, setCacheMaxSizeMB] = useState(100);
  const [cacheStats, setCacheStats] = useState(cacheManager.getStats());
  const [showCacheTable, setShowCacheTable] = useState(false);

  const [logSourceFilter, setLogSourceFilter] = useState<LogFilter>("all");
  const [logLevelFilter, setLogLevelFilter] = useState<LogLevelFilter>("all");
  const logContainerRef = useRef<HTMLDivElement>(null);
  const backendLogsRef = useRef<LogEntry[]>([]);
  const knownTimestampsRef = useRef<Set<string>>(new Set());
  const [displayKey, setDisplayKey] = useState(0);

  const cacheEntries = useMemo(() => cacheManager.getEntries(), [cacheStats]);

  const [isConfigLoading, setIsConfigLoading] = useState(true);

  const [dumpEntries, setDumpEntries] = useState<WikiDumpEntry[]>([]);
  const [isDumping, setIsDumping] = useState(false);
  const [dumpError, setDumpError] = useState<string | null>(null);
  const [dumpDir, setDumpDir] = useState<string>("");

  const [userInfoEntries, setUserInfoEntries] = useState<UserInfoDumpEntry[]>([]);
  const [isUserInfoDumping, setIsUserInfoDumping] = useState(false);
  const [userInfoError, setUserInfoError] = useState<string | null>(null);
  const [userInfoDir, setUserInfoDir] = useState<string>("");

  const handleDumpUserInfo = async () => {
    setIsUserInfoDumping(true);
    setUserInfoError(null);
    try {
      const entries = await invoke<UserInfoDumpEntry[]>("debug_dump_user_info");
      setUserInfoEntries(entries);
      const dir = await invoke<string>("debug_user_info_dir");
      setUserInfoDir(dir);
    } catch (e) {
      logError("[Developer] user info dump failed:", e);
      setUserInfoError(String(e));
    } finally {
      setIsUserInfoDumping(false);
    }
  };

  const handleDumpWiki = async () => {
    setIsDumping(true);
    setDumpError(null);
    try {
      const entries = await invoke<WikiDumpEntry[]>("debug_dump_wiki_catalogs");
      setDumpEntries(entries);
      const dir = await invoke<string>("debug_wiki_debug_dir");
      setDumpDir(dir);
    } catch (e) {
      logError("[Developer] wiki dump failed:", e);
      setDumpError(String(e));
    } finally {
      setIsDumping(false);
    }
  };

  useEffect(() => {
    const loadConfig = async () => {
      setIsConfigLoading(true);
      const [mode, maxEntries, maxSizeMB] = await Promise.all([
        getConfig<CacheMode>("cache_mode"),
        getConfig<number>("cache_max_entries"),
        getConfig<number>("cache_max_size_mb"),
      ]);
      const resolvedMode = mode ?? "smart";
      const resolvedEntries = maxEntries ?? 200;
      const resolvedSize = maxSizeMB ?? 100;
      setCacheMode(resolvedMode);
      setCacheMaxEntries(resolvedEntries);
      setCacheMaxSizeMB(resolvedSize);
      cacheManager.configure({
        mode: resolvedMode,
        maxEntries: resolvedEntries,
        maxSizeMB: resolvedSize,
      });
      setCacheStats(cacheManager.getStats());
      setIsConfigLoading(false);
    };
    loadConfig();
  }, []);

  const fetchBackendLogs = useCallback(async () => {
    try {
      const raw = await invoke<unknown[]>("get_backend_logs");
      const levelMap: Record<string, LogLevel> = {
        Debug: LogLevel.DEBUG,
        Info: LogLevel.INFO,
        Warn: LogLevel.WARN,
        Error: LogLevel.ERROR,
      };
      const newEntries: LogEntry[] = [];
      for (const r of raw as Record<string, unknown>[]) {
        const ts = r.timestamp as string;
        if (!knownTimestampsRef.current.has(ts)) {
          knownTimestampsRef.current.add(ts);
          newEntries.push({
            timestamp: ts,
            level: levelMap[r.level as string] ?? LogLevel.INFO,
            message: r.message as string,
            module: r.module as string,
            source: "backend" as const,
          });
        }
      }
      if (newEntries.length > 0) {
        const existing = backendLogsRef.current;
        backendLogsRef.current = [...existing, ...newEntries];
        if (backendLogsRef.current.length > MAX_VISIBLE_LOGS * 2) {
          backendLogsRef.current = backendLogsRef.current.slice(-MAX_VISIBLE_LOGS);
          knownTimestampsRef.current = new Set(
            backendLogsRef.current.map((e) => e.timestamp)
          );
        }
        setDisplayKey((k) => k + 1);
      }
    } catch {
      // Tauri not available
    }
  }, []);

  useEffect(() => {
    fetchBackendLogs();
    const interval = setInterval(fetchBackendLogs, 3000);
    return () => clearInterval(interval);
  }, [fetchBackendLogs]);

  useEffect(() => {
    if (logContainerRef.current) {
      const el = logContainerRef.current;
      const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
      if (isNearBottom) {
        requestAnimationFrame(() => {
          el.scrollTop = el.scrollHeight;
        });
      }
    }
  }, [displayKey]);

  const filteredLogs = useMemo(() => {
    const frontendLogs = logger.getLogs();
    const backendLogs = backendLogsRef.current;

    const source =
      logSourceFilter === "all"
        ? [...backendLogs, ...frontendLogs]
        : logSourceFilter === "frontend"
          ? frontendLogs
          : backendLogs;

    const filtered =
      logLevelFilter === "all"
        ? source
        : source.filter((e) => e.level === logLevelFilter);

    filtered.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    return filtered.slice(-MAX_VISIBLE_LOGS);
  }, [logSourceFilter, logLevelFilter, displayKey]);

  const handleCacheModeChange = async (value: CacheMode) => {
    setCacheMode(value);
    cacheManager.configure({ mode: value });
    await setConfig("cache_mode", value);
    setCacheStats(cacheManager.getStats());
  };

  const handleCacheMaxEntriesChange = async (value: number) => {
    const clamped = Math.max(10, Math.min(5000, value));
    setCacheMaxEntries(clamped);
    cacheManager.configure({ maxEntries: clamped });
    await setConfig("cache_max_entries", clamped);
    setCacheStats(cacheManager.getStats());
  };

  const handleCacheMaxSizeMBChange = async (value: number) => {
    const clamped = Math.max(10, Math.min(10000, value));
    setCacheMaxSizeMB(clamped);
    cacheManager.configure({ maxSizeMB: clamped });
    await setConfig("cache_max_size_mb", clamped);
    setCacheStats(cacheManager.getStats());
  };

  const refreshCacheStats = () => {
    setCacheStats(cacheManager.getStats());
  };

  const cleanInactive = () => {
    cacheManager.evictInactive();
    setCacheStats(cacheManager.getStats());
  };

  const clearLogs = () => {
    logger.clearLogs();
    backendLogsRef.current = [];
    knownTimestampsRef.current = new Set();
    setDisplayKey((k) => k + 1);
  };

  const truncateMessage = (msg: string): string => {
    if (msg.length > MAX_MESSAGE_LENGTH) {
      return msg.slice(0, MAX_MESSAGE_LENGTH) + "...";
    }
    return msg;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-foreground tracking-tight">
          {t("settings.developer.title")}
        </h1>
        <p className="text-foreground/70 mt-1.5">{t("settings.developer.enable_desc")}</p>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Image Cache Settings */}
        <GlassCard id="developer-cache" className="p-6 glass-surface border border-separator/90 overflow-hidden">
          <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
            <span className="w-1 h-5 bg-primary rounded-full" />
            {t("settings.cache.title")}
          </h2>
          {isConfigLoading ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <GlassSkeleton className="w-32 h-4 rounded-lg" />
                  <GlassSkeleton className="w-48 h-3 rounded-lg" />
                </div>
                <GlassSkeleton className="w-12 h-6 rounded-full" />
              </div>
            </div>
          ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-foreground">
                  {t("settings.cache.mode")}
                </p>
                <p className="text-sm text-muted mt-0.5">
                  {cacheMode === "smart"
                    ? t("settings.cache.mode_smart_desc")
                    : t("settings.cache.mode_manual_desc")}
                </p>
              </div>
              <GlassSwitch
                isSelected={cacheMode === "smart"}
                onValueChange={(v) => handleCacheModeChange(v ? "smart" : "manual")}
                className="shrink-0"
              >
                <GlassSwitch.Control>
                  <GlassSwitch.Thumb />
                </GlassSwitch.Control>
              </GlassSwitch>
            </div>

            {cacheMode === "manual" && (
              <>
                <div className="h-px bg-separator w-full" />

                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground">
                      {t("settings.cache.max_entries")}
                    </p>
                    <p className="text-sm text-muted mt-0.5">
                      {t("settings.cache.max_entries_desc")}
                    </p>
                  </div>
                    <GlassNumberField
                      value={cacheMaxEntries}
                      onChange={(v) => handleCacheMaxEntriesChange(v)}
                      minValue={10}
                      maxValue={5000}
                      aria-label={t("settings.cache.max_entries")}
                      className="shrink-0"
                    >
                      <GlassNumberField.Group className="text-foreground">
                        <GlassNumberField.DecrementButton aria-label="Decrease" className="text-foreground" />
                        <GlassNumberField.Input className="w-[120px]" />
                        <GlassNumberField.IncrementButton aria-label="Increase" className="text-foreground" />
                      </GlassNumberField.Group>
                    </GlassNumberField>
                </div>

                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground">
                      {t("settings.cache.max_size_mb")}
                    </p>
                    <p className="text-sm text-muted mt-0.5">
                      {t("settings.cache.max_size_mb_desc")}
                    </p>
                  </div>
                    <GlassNumberField
                      value={cacheMaxSizeMB}
                      onChange={(v) => handleCacheMaxSizeMBChange(v)}
                      minValue={10}
                      maxValue={10000}
                      aria-label={t("settings.cache.max_size_mb")}
                      className="shrink-0"
                    >
                      <GlassNumberField.Group className="text-foreground">
                        <GlassNumberField.DecrementButton aria-label="Decrease" className="text-foreground" />
                        <GlassNumberField.Input className="w-[120px]" />
                        <GlassNumberField.IncrementButton aria-label="Increase" className="text-foreground" />
                      </GlassNumberField.Group>
                    </GlassNumberField>
                </div>
              </>
            )}

            {cacheMode === "manual" && (
              <>
                <div className="h-px bg-separator w-full" />

                <div className="space-y-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-foreground">
                        {t("settings.cache.current_cache")}
                      </p>
                      <div className="flex items-center gap-2">
                        <GlassButton variant="outline" size="sm" onPress={cleanInactive}>
                          {t("settings.cache.clean_inactive")}
                        </GlassButton>
                        <GlassButton variant="outline" size="sm" onPress={refreshCacheStats} className="shrink-0">
                          {t("common.refresh")}
                        </GlassButton>
                      </div>
                    </div>

                  <GlassMeter aria-label="entries-usage" value={Math.round((cacheStats.entries / Math.max(cacheStats.maxEntries, 1)) * 100)} className="w-full">
                    <GlassLabel>
                      {t("settings.cache.entries_count")}: {cacheStats.entries} / {cacheStats.maxEntries}
                    </GlassLabel>
                    <GlassMeter.Output />
                    <GlassMeter.Track>
                      <GlassMeter.Fill />
                    </GlassMeter.Track>
                  </GlassMeter>

                  <GlassMeter aria-label="size-usage" value={cacheStats.maxSizeMB > 0 ? Math.round((cacheStats.totalSizeMB / cacheStats.maxSizeMB) * 100) : 0} className="w-full">
                    <GlassLabel>
                      {t("settings.cache.size_usage")}: {cacheStats.totalSizeMB} MB / {cacheStats.maxSizeMB} MB
                    </GlassLabel>
                    <GlassMeter.Output />
                    <GlassMeter.Track>
                      <GlassMeter.Fill />
                    </GlassMeter.Track>
                  </GlassMeter>
                </div>

                <div className="space-y-2">
                  <button
                    className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary transition-colors"
                    onClick={() => setShowCacheTable(!showCacheTable)}
                  >
                    <svg
                      className={`w-4 h-4 transition-transform ${showCacheTable ? "rotate-90" : ""}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    {t("settings.cache.cached_resources")} ({cacheEntries.length})
                  </button>

                  {showCacheTable && cacheEntries.length > 0 && (
                    <GlassTable>
                      <GlassTable.ScrollContainer>
                        <GlassTable.Content aria-label="Cached images" className="min-w-[400px]">
                          <GlassTable.Header>
                            <GlassTable.Column isRowHeader>{t("settings.cache.filename")}</GlassTable.Column>
                            <GlassTable.Column>{t("settings.cache.size")}</GlassTable.Column>
                            <GlassTable.Column>{t("settings.cache.status")}</GlassTable.Column>
                          </GlassTable.Header>
                          <GlassTable.Body>
                            {cacheEntries.map((entry) => (
                              <GlassTable.Row key={entry.path}>
                                <GlassTable.Cell className="font-mono text-xs truncate max-w-[200px]">
                                  <button
                                    className="hover:text-primary transition-colors truncate block w-full text-left"
                                    onClick={() => revealItemInDir(entry.path)}
                                    title={t("settings.cache.open_file_location")}
                                  >
                                    {entry.path.split(/[\\/]/).pop()}
                                  </button>
                                </GlassTable.Cell>
                                <GlassTable.Cell>{entry.sizeKB} KB</GlassTable.Cell>
                                <GlassTable.Cell>
                                  {entry.pinned
                                    ? t("settings.cache.status_pinned")
                                    : entry.refCount > 0
                                      ? t("settings.cache.status_active")
                                      : t("settings.cache.status_inactive")}
                                </GlassTable.Cell>
                              </GlassTable.Row>
                            ))}
                          </GlassTable.Body>
                        </GlassTable.Content>
                      </GlassTable.ScrollContainer>
                    </GlassTable>
                  )}

                  {showCacheTable && cacheEntries.length === 0 && (
                    <p className="text-sm text-muted">{t("settings.cache.no_cached")}</p>
                  )}
                </div>
              </>
            )}
          </div>
          )}
        </GlassCard>

        {/* Wiki 数据抓取（调试） */}
        <GlassCard id="developer-wiki-dump" className="p-6 glass-surface border border-separator/90 overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <span className="w-1 h-5 bg-warning rounded-full" />
              {i18n.language === "zh" ? "Wiki 数据抓取（调试）" : "Wiki Data Dump (Debug)"}
            </h2>
            <div className="flex items-center gap-2">
              {dumpDir && (
                <GlassButton variant="outline" size="sm" onPress={() => revealItemInDir(dumpDir)}>
                  {i18n.language === "zh" ? "打开目录" : "Open Folder"}
                </GlassButton>
              )}
              <GlassButton variant="outline" size="sm" isDisabled={isDumping} onPress={handleDumpWiki}>
                {isDumping
                  ? (i18n.language === "zh" ? "抓取中…" : "Fetching…")
                  : (i18n.language === "zh" ? "保存全部 Wiki JSON" : "Dump All Wiki JSON")}
              </GlassButton>
            </div>
          </div>
          <p className="text-sm text-muted mb-4">
            {i18n.language === "zh"
              ? "抓取 wiki 目录各接口变体的原始响应并保存到 wiki_debug 目录（含总目录、干员、武器、无 onlyOnline 变体），用于核对返回结构与 items 内容。"
              : "Fetch raw responses of each wiki catalog variant and save them to the wiki_debug folder (catalog, char, weapon, no-onlyOnline), for inspecting response structure and items."}
          </p>
          {dumpError && (
            <p className="text-sm text-danger mb-3 break-all">{dumpError}</p>
          )}
          {dumpEntries.length > 0 && (
            <GlassTable>
              <GlassTable.ScrollContainer>
                <GlassTable.Content aria-label="Wiki dump results" className="min-w-[520px]">
                  <GlassTable.Header>
                    <GlassTable.Column isRowHeader>{i18n.language === "zh" ? "变体" : "Variant"}</GlassTable.Column>
                    <GlassTable.Column>{i18n.language === "zh" ? "code" : "code"}</GlassTable.Column>
                    <GlassTable.Column>{i18n.language === "zh" ? "message" : "message"}</GlassTable.Column>
                    <GlassTable.Column>{i18n.language === "zh" ? "目录" : "Catalogs"}</GlassTable.Column>
                    <GlassTable.Column>{i18n.language === "zh" ? "子类" : "Subs"}</GlassTable.Column>
                    <GlassTable.Column>{i18n.language === "zh" ? "条目" : "Items"}</GlassTable.Column>
                  </GlassTable.Header>
                  <GlassTable.Body>
                    {dumpEntries.map((e) => (
                      <GlassTable.Row key={e.name}>
                        <GlassTable.Cell className="font-mono text-xs">{e.name}</GlassTable.Cell>
                        <GlassTable.Cell>
                          <span className={e.code === 0 ? "text-success" : "text-danger font-semibold"}>
                            {e.code ?? "—"}
                          </span>
                        </GlassTable.Cell>
                        <GlassTable.Cell className="text-xs text-muted max-w-[160px] truncate">
                          {e.message ?? "—"}
                        </GlassTable.Cell>
                        <GlassTable.Cell>{e.catalog_count}</GlassTable.Cell>
                        <GlassTable.Cell>{e.type_sub_count}</GlassTable.Cell>
                        <GlassTable.Cell className={e.item_count > 0 ? "text-success font-semibold" : "text-danger"}>
                          {e.item_count}
                        </GlassTable.Cell>
                      </GlassTable.Row>
                    ))}
                  </GlassTable.Body>
                </GlassTable.Content>
              </GlassTable.ScrollContainer>
            </GlassTable>
          )}
        </GlassCard>

        {/* 用户信息抓取（调试） */}
        <GlassCard id="developer-user-dump" className="p-6 glass-surface border border-separator/90 overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <span className="w-1 h-5 bg-primary rounded-full" />
              {i18n.language === "zh" ? "用户信息数据抓取（调试）" : "User Info Dump (Debug)"}
            </h2>
            <div className="flex items-center gap-2">
              {userInfoDir && (
                <GlassButton variant="outline" size="sm" onPress={() => revealItemInDir(userInfoDir)}>
                  {i18n.language === "zh" ? "打开目录" : "Open Folder"}
                </GlassButton>
              )}
              <GlassButton variant="outline" size="sm" isDisabled={isUserInfoDumping} onPress={handleDumpUserInfo}>
                {isUserInfoDumping
                  ? (i18n.language === "zh" ? "抓取中…" : "Fetching…")
                  : (i18n.language === "zh" ? "抓取用户信息" : "Dump User Info")}
              </GlassButton>
            </div>
          </div>
          <p className="text-sm text-muted mb-4">
            {i18n.language === "zh"
              ? "抓取玩家绑定（player/binding）与角色卡片详情（card/detail）的原始响应并保存到 user_debug 目录，用于核对用户信息字段。"
              : "Fetch raw responses of player binding and card detail, save them to the user_debug folder for inspecting user info fields."}
          </p>
          {userInfoError && (
            <p className="text-sm text-danger mb-3 break-all">{userInfoError}</p>
          )}
          {userInfoEntries.length > 0 && (
            <GlassTable>
              <GlassTable.ScrollContainer>
                <GlassTable.Content aria-label="User info dump results" className="min-w-[520px]">
                  <GlassTable.Header>
                    <GlassTable.Column isRowHeader>{i18n.language === "zh" ? "接口" : "API"}</GlassTable.Column>
                    <GlassTable.Column>{i18n.language === "zh" ? "code" : "code"}</GlassTable.Column>
                    <GlassTable.Column>{i18n.language === "zh" ? "message" : "message"}</GlassTable.Column>
                    <GlassTable.Column>{i18n.language === "zh" ? "摘要" : "Summary"}</GlassTable.Column>
                    <GlassTable.Column>JSON</GlassTable.Column>
                  </GlassTable.Header>
                  <GlassTable.Body>
                    {userInfoEntries.map((e) => (
                      <GlassTable.Row key={e.name}>
                        <GlassTable.Cell className="font-mono text-xs">{e.name}</GlassTable.Cell>
                        <GlassTable.Cell>
                          <span className={e.code === 0 ? "text-success" : "text-danger font-semibold"}>
                            {e.code ?? "—"}
                          </span>
                        </GlassTable.Cell>
                        <GlassTable.Cell className="text-xs text-muted max-w-[160px] truncate">
                          {e.message ?? "—"}
                        </GlassTable.Cell>
                        <GlassTable.Cell className="text-xs text-foreground max-w-[200px] truncate">
                          {e.info || "—"}
                        </GlassTable.Cell>
                        <GlassTable.Cell>
                          {e.path ? (
                            <button
                              className="text-primary hover:underline text-xs font-mono truncate block max-w-[140px]"
                              onClick={() => revealItemInDir(e.path)}
                              title={e.path}
                            >
                              {e.path.split(/[\\/]/).pop()}
                            </button>
                          ) : (
                            <span className="text-muted text-xs">—</span>
                          )}
                        </GlassTable.Cell>
                      </GlassTable.Row>
                    ))}
                  </GlassTable.Body>
                </GlassTable.Content>
              </GlassTable.ScrollContainer>
            </GlassTable>
          )}
        </GlassCard>

        {/* Log Viewer */}
        <GlassCard id="developer-logs" className="p-6 glass-surface border border-separator/90 overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <span className="w-1 h-5 bg-secondary rounded-full" />
              {t("settings.logs.title")}
            </h2>
            <div className="flex items-center gap-2">
              <GlassButton variant="outline" size="sm" onPress={fetchBackendLogs}>
                {t("common.refresh")}
              </GlassButton>
              <GlassButton variant="outline" size="sm" onPress={clearLogs}>
                {i18n.language === "zh" ? "清除" : "Clear"}
              </GlassButton>
            </div>
          </div>

          {/* Source tabs */}
          <div className="flex gap-1 mb-3 bg-default-100/60 p-1 rounded-xl">
            {(["all", "frontend", "backend"] as LogFilter[]).map((f) => {
              const isActive = logSourceFilter === f;
              return (
                <button
                  key={f}
                  onClick={() => setLogSourceFilter(f)}
                  className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 flex items-center justify-center gap-1 ${
                    isActive
                      ? "glass-surface text-foreground shadow-sm border border-separator/80"
                      : "text-muted hover:text-foreground"
                  }`}
                >
                  {f === "frontend" && <MorphIcon icon={FileText} size={12} />}
                  {f === "backend" && <MorphIcon icon={Settings} size={12} />}
                  {f === "all"
                    ? (i18n.language === "zh" ? "所有日志" : "All Logs")
                    : f === "frontend"
                      ? (i18n.language === "zh" ? "前端" : "Frontend")
                      : (i18n.language === "zh" ? "后端" : "Backend")}
                </button>
              );
            })}
          </div>

          {/* Level filter */}
          <div className="flex flex-wrap items-center gap-1.5 mb-3">
            {(["all" as const, LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR] as const).map((l) => {
              const isActive = logLevelFilter === l;
              return (
                <button
                  key={String(l)}
                  onClick={() => setLogLevelFilter(l)}
                  className={`px-2.5 py-1 text-xs rounded-lg border transition-all duration-200 font-medium ${
                    isActive && l !== "all"
                      ? `${LEVEL_TEXT[l]} ${LEVEL_BG_SOFT[l]} ${LEVEL_BORDER[l]} bg-background`
                      : "border-separator/60 text-muted hover:text-foreground hover:bg-default-50"
                  }`}
                >
                  {l === "all"
                    ? (i18n.language === "zh" ? "全部级别" : "All Levels")
                    : LOG_LEVEL_NAMES[l]}
                </button>
              );
            })}
            <span className="text-xs text-muted ml-auto">
              {filteredLogs.length} {i18n.language === "zh" ? "条" : "entries"}
            </span>
          </div>

          {/* Log entries */}
          <div
            ref={logContainerRef}
            className="glass-surface rounded-xl border border-separator/80 overflow-y-auto font-mono text-xs"
            style={{ maxHeight: "480px" }}
          >
            {filteredLogs.length === 0 ? (
              <div className="flex items-center justify-center h-24 text-muted/60">
                {i18n.language === "zh" ? "暂无日志" : "No logs"}
              </div>
            ) : (
              <div className="p-1 space-y-px">
                {filteredLogs.map((entry, idx) => {
                  const levelName = LOG_LEVEL_NAMES[entry.level];
                  return (
                    <div
                      key={`${entry.timestamp}-${idx}`}
                      className={`flex items-start gap-1.5 px-2 py-1 rounded transition-colors ${
                        entry.source === "backend"
                          ? "hover:bg-secondary/5"
                          : "hover:bg-success/5"
                      }`}
                    >
                      <span
                        className={`shrink-0 font-bold text-[10px] leading-5 px-1.5 rounded text-white text-center min-w-[44px] ${LEVEL_BADGE_BG[entry.level]}`}
                      >
                        {levelName}
                      </span>
                      <span className="shrink-0 text-muted/70 leading-5 whitespace-nowrap font-normal">
                        {entry.timestamp}
                      </span>
                      <span
                        className={`shrink-0 leading-5 font-semibold ${entry.source === "backend" ? "text-secondary" : "text-success"}`}
                      >
                        {entry.source === "backend" ? "Backend" : "Frontend"}
                      </span>
                      <span className="shrink-0 leading-5 text-muted/50 font-normal max-w-[100px] truncate">
                        {entry.module}
                      </span>
                      <span
                        className={`leading-5 break-all flex-1 min-w-0 font-normal ${LEVEL_TEXT[entry.level]}`}
                        title={entry.message.length > MAX_MESSAGE_LENGTH ? entry.message : undefined}
                      >
                        {truncateMessage(entry.message)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
