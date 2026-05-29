import { useTranslation } from "react-i18next";
import { Card, Button, Switch, NumberField, Label, Meter, Table, Skeleton } from "@heroui/react";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { getConfig, setConfig } from "@/utils/configService";
import { cacheManager, CacheMode } from "@/utils/imageCacheManager";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import logger, { LogEntry, LogLevel } from "@/utils/logger";
import { invoke } from "@tauri-apps/api/core";

const LOG_LEVEL_NAMES: Record<LogLevel, string> = {
  [LogLevel.DEBUG]: "DEBUG",
  [LogLevel.INFO]: "INFO",
  [LogLevel.WARN]: "WARN",
  [LogLevel.ERROR]: "ERROR",
};

const LEVEL_COLORS: Record<LogLevel, string> = {
  [LogLevel.DEBUG]: "#00BCD4",
  [LogLevel.INFO]: "#4CAF50",
  [LogLevel.WARN]: "#FF9800",
  [LogLevel.ERROR]: "#F44336",
};

const LEVEL_BGS: Record<LogLevel, string> = {
  [LogLevel.DEBUG]: "rgba(0, 188, 212, 0.12)",
  [LogLevel.INFO]: "rgba(76, 175, 80, 0.12)",
  [LogLevel.WARN]: "rgba(255, 152, 0, 0.12)",
  [LogLevel.ERROR]: "rgba(244, 67, 54, 0.12)",
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
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-foreground">
          {t("settings.developer.title")}
        </h1>
        <p className="text-muted mt-1">{t("settings.developer.enable_desc")}</p>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Image Cache Settings */}
        <Card id="developer-cache" className="p-6 bg-content1 shadow-sm overflow-hidden">
          <h2 className="text-lg font-semibold mb-6">
            {t("settings.cache.title")}
          </h2>
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
              <Switch
                isSelected={cacheMode === "smart"}
                onChange={(v) => handleCacheModeChange(v ? "smart" : "manual")}
                className="shrink-0"
              >
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
              </Switch>
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
                    <NumberField
                      value={cacheMaxEntries}
                      onChange={(v) => handleCacheMaxEntriesChange(v)}
                      minValue={10}
                      maxValue={5000}
                      aria-label={t("settings.cache.max_entries")}
                      className="shrink-0"
                    >
                      <NumberField.Group className="text-foreground">
                        <NumberField.DecrementButton aria-label="Decrease" className="text-foreground" />
                        <NumberField.Input className="w-[120px]" />
                        <NumberField.IncrementButton aria-label="Increase" className="text-foreground" />
                      </NumberField.Group>
                    </NumberField>
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
                    <NumberField
                      value={cacheMaxSizeMB}
                      onChange={(v) => handleCacheMaxSizeMBChange(v)}
                      minValue={10}
                      maxValue={10000}
                      aria-label={t("settings.cache.max_size_mb")}
                      className="shrink-0"
                    >
                      <NumberField.Group className="text-foreground">
                        <NumberField.DecrementButton aria-label="Decrease" className="text-foreground" />
                        <NumberField.Input className="w-[120px]" />
                        <NumberField.IncrementButton aria-label="Increase" className="text-foreground" />
                      </NumberField.Group>
                    </NumberField>
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
                        <Button variant="outline" size="sm" onPress={cleanInactive}>
                          {t("settings.cache.clean_inactive")}
                        </Button>
                        <Button variant="outline" size="sm" onPress={refreshCacheStats} className="shrink-0">
                          {t("common.refresh")}
                        </Button>
                      </div>
                    </div>

                  <Meter aria-label="entries-usage" value={Math.round((cacheStats.entries / Math.max(cacheStats.maxEntries, 1)) * 100)} className="w-full">
                    <Label>
                      {t("settings.cache.entries_count")}: {cacheStats.entries} / {cacheStats.maxEntries}
                    </Label>
                    <Meter.Output />
                    <Meter.Track>
                      <Meter.Fill />
                    </Meter.Track>
                  </Meter>

                  <Meter aria-label="size-usage" value={cacheStats.maxSizeMB > 0 ? Math.round((cacheStats.totalSizeMB / cacheStats.maxSizeMB) * 100) : 0} className="w-full">
                    <Label>
                      {t("settings.cache.size_usage")}: {cacheStats.totalSizeMB} MB / {cacheStats.maxSizeMB} MB
                    </Label>
                    <Meter.Output />
                    <Meter.Track>
                      <Meter.Fill />
                    </Meter.Track>
                  </Meter>
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
                    <Table>
                      <Table.ScrollContainer>
                        <Table.Content aria-label="Cached images" className="min-w-[400px]">
                          <Table.Header>
                            <Table.Column isRowHeader>{t("settings.cache.filename")}</Table.Column>
                            <Table.Column>{t("settings.cache.size")}</Table.Column>
                            <Table.Column>{t("settings.cache.status")}</Table.Column>
                          </Table.Header>
                          <Table.Body>
                            {cacheEntries.map((entry) => (
                              <Table.Row key={entry.path}>
                                <Table.Cell className="font-mono text-xs truncate max-w-[200px]">
                                  <button
                                    className="hover:text-primary transition-colors truncate block w-full text-left"
                                    onClick={() => revealItemInDir(entry.path)}
                                    title={t("settings.cache.open_file_location")}
                                  >
                                    {entry.path.split(/[\\/]/).pop()}
                                  </button>
                                </Table.Cell>
                                <Table.Cell>{entry.sizeKB} KB</Table.Cell>
                                <Table.Cell>
                                  {entry.pinned
                                    ? t("settings.cache.status_pinned")
                                    : entry.refCount > 0
                                      ? t("settings.cache.status_active")
                                      : t("settings.cache.status_inactive")}
                                </Table.Cell>
                              </Table.Row>
                            ))}
                          </Table.Body>
                        </Table.Content>
                      </Table.ScrollContainer>
                    </Table>
                  )}

                  {showCacheTable && cacheEntries.length === 0 && (
                    <p className="text-sm text-muted">{t("settings.cache.no_cached")}</p>
                  )}
                </div>
              </>
            )}
          </div>
          )}
        </Card>

        {/* Log Viewer */}
        <Card id="developer-logs" className="p-6 bg-content1 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">
              {t("settings.logs.title")}
            </h2>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onPress={fetchBackendLogs}>
                {t("common.refresh")}
              </Button>
              <Button variant="outline" size="sm" onPress={clearLogs}>
                {i18n.language === "zh" ? "清除" : "Clear"}
              </Button>
            </div>
          </div>

          {/* Source tabs */}
          <div className="flex gap-1 mb-3 bg-default-100 dark:bg-default-50 p-1 rounded-lg">
            {(["all", "frontend", "backend"] as LogFilter[]).map((f) => {
              const isActive = logSourceFilter === f;
              const label =
                f === "all"
                  ? (i18n.language === "zh" ? "所有日志" : "All Logs")
                  : f === "frontend"
                    ? (i18n.language === "zh" ? "📄 前端" : "📄 Frontend")
                    : (i18n.language === "zh" ? "⚙️ 后端" : "⚙️ Backend");
              return (
                <button
                  key={f}
                  onClick={() => setLogSourceFilter(f)}
                  className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                    isActive
                      ? "bg-background text-foreground shadow-sm border border-separator"
                      : "text-muted hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Level filter */}
          <div className="flex flex-wrap items-center gap-1.5 mb-3">
            {(["all" as const, LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR] as const).map((l) => {
              const isActive = logLevelFilter === l;
              const color = l !== "all" ? LEVEL_COLORS[l] : undefined;
              const bg = l !== "all" ? LEVEL_BGS[l] : undefined;
              return (
                <button
                  key={String(l)}
                  onClick={() => setLogLevelFilter(l)}
                  className="px-2.5 py-1 text-xs rounded-md border transition-all font-medium"
                  style={{
                    color: isActive && color ? color : undefined,
                    backgroundColor: isActive && bg ? bg : undefined,
                    borderColor: isActive ? (color ?? "var(--heroui-separator)") : "var(--heroui-separator)",
                  }}
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
            className="bg-background rounded-lg border border-separator overflow-y-auto font-mono text-xs"
            style={{ maxHeight: "480px" }}
          >
            {filteredLogs.length === 0 ? (
              <div className="flex items-center justify-center h-24 text-muted">
                {i18n.language === "zh" ? "暂无日志" : "No logs"}
              </div>
            ) : (
              <div className="p-1 space-y-px">
                {filteredLogs.map((entry, idx) => {
                  const levelName = LOG_LEVEL_NAMES[entry.level];
                  const color = LEVEL_COLORS[entry.level];
                  return (
                    <div
                      key={`${entry.timestamp}-${idx}`}
                      className="flex items-start gap-1.5 px-2 py-1 rounded hover:bg-default-50 transition-colors"
                      style={{ backgroundColor: entry.source === "backend" ? "rgba(99,102,241,0.04)" : "rgba(34,197,94,0.04)" }}
                    >
                      <span
                        className="shrink-0 font-bold text-[10px] leading-5 px-1.5 rounded-sm text-white text-center min-w-[44px]"
                        style={{ backgroundColor: color }}
                      >
                        {levelName}
                      </span>
                      <span className="shrink-0 text-muted leading-5 whitespace-nowrap font-normal">
                        {entry.timestamp}
                      </span>
                      <span
                        className="shrink-0 leading-5 font-semibold"
                        style={{
                          color: entry.source === "backend" ? "#818CF8" : "#4ADE80",
                        }}
                      >
                        {entry.source === "backend" ? "Backend" : "Frontend"}
                      </span>
                      <span className="shrink-0 leading-5 text-muted font-normal max-w-[100px] truncate">
                        {entry.module}
                      </span>
                      <span
                        className="leading-5 break-all flex-1 min-w-0 font-normal"
                        style={{ color }}
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
        </Card>
      </div>
    </div>
  );
}
