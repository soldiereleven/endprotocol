import { useState, useEffect, useLayoutEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { GlassAlertDialogCompound as GlassAlertDialog, GlassModalCompound as GlassModal } from "@/components/ui/glass/modal";
import { GlassButton } from "@/components/ui/glass/button";
import {
  type GameChannel,
  type GameStatus,
  type DownloadProgress,
  type FileScanResult,
  type DiskSpace,
  ALL_CHANNELS,
  checkGameStatus,
  installOrUpdate,
  verifyAndRepair,
  cancelDownload,
  resetDownloadCancel,
  hasDownloadCache,
  preloadDownload,
  startGame,
  browseFolder,
  checkGameRunning,
  killGame,
  detectChannel,
  scanInstallDir,
  getDiskSpace,
  onLauncherProgress,
  formatBytes,
  CHANNEL_LABELS,
} from "@/utils/launcherService";
import { addMessage } from "@/utils/messageStore";

const STORAGE_KEY_INSTALL_PATH = "launcher_install_path";
const STORAGE_KEY_CHANNEL = "launcher_channel";
const STORAGE_KEY_SKIP_STOP_CONFIRM = "launcher_skip_stop_confirm";
const STORAGE_KEY_CANCELLED = "launcher_download_cancelled";
const STORAGE_KEY_CANCEL_BEHAVIOR = "launcher_cancel_behavior"; // "ask" | "keep" | "delete"

// Module-level progress store — survives component remounts during mode switches
let _persistedProgress: DownloadProgress | null = null;
let _persistedPreparing = false;
let _persistedLastStage: string | null = null;

export function GameActionPanel() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === "zh" ? "zh" : "en";
  const [channel, setChannel] = useState<GameChannel>(() => {
    return (localStorage.getItem(STORAGE_KEY_CHANNEL) as GameChannel) || "official";
  });
  const [gameStatus, setGameStatus] = useState<GameStatus | null>(null);
  const [installPath, setInstallPath] = useState(() => {
    return localStorage.getItem(STORAGE_KEY_INSTALL_PATH) || "";
  });
  const [detectedChannel, setDetectedChannel] = useState<GameChannel | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [statusReady, setStatusReady] = useState(false);
  const [progress, setProgress] = useState<DownloadProgress | null>(_persistedProgress);
  const [preparing, setPreparing] = useState(_persistedPreparing);
  const [flyoutOpen, setFlyoutOpen] = useState(false);
  const [hasTempFiles, setHasTempFiles] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [gameRunning, setGameRunning] = useState(false);
  const [btnHovered, setBtnHovered] = useState(false);
  const [preloadHovered, setPreloadHovered] = useState(false);
  const [downloadSpeed, setDownloadSpeed] = useState(0);
  const [channelSelectOpen, setChannelSelectOpen] = useState(false);
  const [pendingInstallPath, setPendingInstallPath] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<FileScanResult | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [diskSpace, setDiskSpace] = useState<DiskSpace | null>(null);
  const [verifySpeed, setVerifySpeed] = useState(0);
  const flyoutRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const hamburgerRef = useRef<HTMLButtonElement>(null);
  const [progressFlyoutPos, setProgressFlyoutPos] = useState<{ x: number; y: number } | null>(null);
  const [menuFlyoutPos, setMenuFlyoutPos] = useState<{ x: number; y: number } | null>(null);
  const speedRef = useRef({ lastBytes: 0, lastTime: Date.now() });
  const verifySpeedRef = useRef({ lastVerifiedBytes: 0, lastTime: Date.now() });
  const cancellingRef = useRef(localStorage.getItem(STORAGE_KEY_CANCELLED) === "1");
  const preparingRef = useRef(_persistedPreparing);
  const lastStageRef = useRef<string | null>(_persistedLastStage);
  const menuFlyoutRef = useRef<HTMLDivElement>(null);

  // Confirm dialog state
  const [confirmAction, setConfirmAction] = useState<"cancel-download" | "stop-game" | "resume-install" | "delete-temp" | "verify-confirm" | null>(null);
  const [confirmCheckbox, setConfirmCheckbox] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_CHANNEL, channel);
  }, [channel]);

  // Reset persisted preparing on unmount (mode switch) — backend keeps running,
  // but on remount we need to re-detect the actual stage from progress events
  useEffect(() => {
    return () => {
      _persistedPreparing = false;
      preparingRef.current = false;
    };
  }, []);

  // Check game status
  const checkStatus = useCallback(async () => {
    if (!installPath) {
      setGameStatus(null);
      setStatusReady(true);
      return;
    }
    try {
      const status = await checkGameStatus(channel, installPath);
      setGameStatus(status);
    } catch {
      setGameStatus(null);
    } finally {
      setStatusReady(true);
    }
  }, [channel, installPath]);

  // Auto-detect channel from install path
  useEffect(() => {
    if (!installPath) {
      setDetectedChannel(null);
      return;
    }
    let cancelled = false;
    setDetecting(true);
    detectChannel(installPath)
      .then((detected) => {
        if (cancelled) return;
        setDetectedChannel(detected);
        if (detected && detected !== channel) {
          setChannel(detected);
          localStorage.setItem(STORAGE_KEY_CHANNEL, detected);
        }
      })
      .catch(() => {
        if (!cancelled) setDetectedChannel(null);
      })
      .finally(() => {
        if (!cancelled) setDetecting(false);
      });
    return () => { cancelled = true; };
  }, [installPath]);

  // Silent status refresh — used by progress listener
  const refreshStatus = useCallback(async () => {
    if (!installPath) {
      setGameStatus(null);
      return;
    }
    try {
      const status = await checkGameStatus(channel, installPath);
      setGameStatus(status);
    } catch {
      setGameStatus(null);
    }
  }, [channel, installPath]);

  useEffect(() => {
    // If an action is already running (persisted from before remount), the service
    // lock is held — check_status would block forever. Skip and use persisted state.
    if (_persistedProgress && _persistedProgress.stage !== "completed" && _persistedProgress.stage !== "error") {
      setStatusReady(true);
      return;
    }
    checkStatus();
  }, [checkStatus]);

  // Poll game running status
  const checkRunning = useCallback(async () => {
    try {
      const running = await checkGameRunning(channel);
      setGameRunning(running);
    } catch {
      setGameRunning(false);
    }
  }, [channel]);

  useEffect(() => {
    checkRunning();
    const timer = setInterval(checkRunning, 3000);
    return () => clearInterval(timer);
  }, [checkRunning]);

  // Listen for download progress + calculate speed
  useEffect(() => {
    // If we previously cancelled, ignore stale events for a few seconds
    const wasCancelled = cancellingRef.current;
    const graceTimer = wasCancelled
      ? setTimeout(() => {
          cancellingRef.current = false;
          localStorage.removeItem(STORAGE_KEY_CANCELLED);
        }, 3000)
      : null;

    const unlisten = onLauncherProgress((p) => {
      if (cancellingRef.current) return;
      if (preparingRef.current) {
        setPreparing(false);
        preparingRef.current = false;
        _persistedPreparing = false;
      }
      _persistedProgress = p;
      if (p.stage !== "completed" && p.stage !== "error") {
        lastStageRef.current = p.stage;
        _persistedLastStage = p.stage;
      }
      setProgress(p);
      if (p.stage === "downloading") {
        const now = Date.now();
        const ref = speedRef.current;
        const dt = (now - ref.lastTime) / 1000;
        if (dt > 0.3 && p.downloaded >= ref.lastBytes) {
          const bytesPerSec = (p.downloaded - ref.lastBytes) / dt;
          setDownloadSpeed(bytesPerSec);
          ref.lastBytes = p.downloaded;
          ref.lastTime = now;
        }
      } else if (p.stage === "verifying") {
        const now = Date.now();
        const ref = verifySpeedRef.current;
        const dt = (now - ref.lastTime) / 1000;
        if (dt > 0.3 && p.verified_bytes >= ref.lastVerifiedBytes) {
          const bytesPerSec = (p.verified_bytes - ref.lastVerifiedBytes) / dt;
          setVerifySpeed(bytesPerSec);
          ref.lastVerifiedBytes = p.verified_bytes;
          ref.lastTime = now;
        }
      } else {
        setDownloadSpeed(0);
        setVerifySpeed(0);
        speedRef.current = { lastBytes: 0, lastTime: Date.now() };
        verifySpeedRef.current = { lastVerifiedBytes: 0, lastTime: Date.now() };
      }
      if (p.stage === "completed" || p.stage === "error") {
        cancellingRef.current = false;
        localStorage.removeItem(STORAGE_KEY_CANCELLED);
        _persistedProgress = null;
        _persistedPreparing = false;
        preparingRef.current = false;
        const wasVerify = lastStageRef.current === "verifying" || lastStageRef.current === "checking" || lastStageRef.current === "comparing";
        if ((p.stage === "completed" || p.stage === "error") && wasVerify) {
          // 校验结果由 handleVerify / handleQuickVerify 根据返回值显示，此处跳过
        }
        lastStageRef.current = null;
        _persistedLastStage = null;
        setTimeout(() => {
          setProgress(null);
          setPreparing(false);
          setDownloadSpeed(0);
          refreshStatus();
        }, 500);
      }
    });
    return () => {
      if (graceTimer) clearTimeout(graceTimer);
      unlisten.then((fn) => fn());
    };
  }, [refreshStatus]);

  // Close menu flyout on outside click
  useEffect(() => {
    if (!flyoutOpen) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        (flyoutRef.current && flyoutRef.current.contains(target)) ||
        document.querySelector('[data-flyout-menu]')?.contains(target)
      ) {
        return;
      }
      setFlyoutOpen(false);
      setMenuFlyoutPos(null);
    };
    const onScroll = () => {
      setFlyoutOpen(false);
      setMenuFlyoutPos(null);
    };
    document.addEventListener("mousedown", handleClick);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [flyoutOpen]);

  const handleLocate = useCallback(async () => {
    setFlyoutOpen(false);
    const selected = await browseFolder();
    if (selected) {
      setInstallPath(selected);
      localStorage.setItem(STORAGE_KEY_INSTALL_PATH, selected);
      setDetecting(true);
      try {
        const detected = await detectChannel(selected);
        if (detected) {
          setDetectedChannel(detected);
          setChannel(detected);
          localStorage.setItem(STORAGE_KEY_CHANNEL, detected);
        }
      } catch {
        // detection failed, leave channel as-is
      } finally {
        setDetecting(false);
      }
    }
  }, []);

  const startInstall = useCallback(async (cleanCache: boolean) => {
    if (!installPath) return;
    if (cleanCache) {
      await cancelDownload(installPath);
    }
    cancellingRef.current = false;
    localStorage.removeItem(STORAGE_KEY_CANCELLED);
    await resetDownloadCancel();
    setPreparing(true);
    preparingRef.current = true;
    _persistedPreparing = true;
    try {
      setProgress(null);
      const result = await installOrUpdate(channel, installPath);
      // After successful install, run quick verify
      if (result.success) {
        await verifyAndRepair(channel, installPath, 4, true);
      }
    } catch {
      // error handled by progress
    }
  }, [channel, installPath]);

  const handleInstall = useCallback(async () => {
    if (!installPath) {
      const selected = await browseFolder();
      if (selected) {
        setInstallPath(selected);
        localStorage.setItem(STORAGE_KEY_INSTALL_PATH, selected);
        setDetecting(true);
        try {
          const detected = await detectChannel(selected);
          if (detected) {
            setDetectedChannel(detected);
            setChannel(detected);
            localStorage.setItem(STORAGE_KEY_CHANNEL, detected);
            // Channel detected, check for cache and install
            const hasCache = await hasDownloadCache(selected);
            if (hasCache) {
              setConfirmAction("resume-install");
              setConfirmCheckbox(false);
            } else {
              startInstall(false);
            }
          } else {
            // No channel detected, show channel picker
            setPendingInstallPath(selected);
            setChannelSelectOpen(true);
          }
        } catch {
          setPendingInstallPath(selected);
          setChannelSelectOpen(true);
        } finally {
          setDetecting(false);
        }
      }
      return;
    }
    // Has install path but no channel detected
    if (!detectedChannel) {
      setPendingInstallPath(installPath);
      setChannelSelectOpen(true);
      return;
    }
    const hasCache = await hasDownloadCache(installPath);
    if (hasCache) {
      setConfirmAction("resume-install");
      setConfirmCheckbox(false);
    } else {
      startInstall(false);
    }
  }, [installPath, detectedChannel, startInstall]);

  const handleChannelSelected = useCallback(async (selectedChannel: GameChannel) => {
    setChannelSelectOpen(false);
    const path = pendingInstallPath || installPath;
    if (!path) return;

    setChannel(selectedChannel);
    setDetectedChannel(selectedChannel);
    localStorage.setItem(STORAGE_KEY_CHANNEL, selectedChannel);

    // Scan existing files before installing
    setScanning(true);
    try {
      const [result, ds] = await Promise.all([
        scanInstallDir(selectedChannel, path),
        getDiskSpace(path).catch(() => null),
      ]);
      setScanResult(result);
      setDiskSpace(ds);
      setScanOpen(true);
    } catch {
      // Scan failed, proceed directly
      const hasCache = await hasDownloadCache(path);
      if (hasCache) {
        setConfirmAction("resume-install");
        setConfirmCheckbox(false);
      } else {
        startInstall(false);
      }
    } finally {
      setScanning(false);
    }
  }, [pendingInstallPath, installPath, startInstall]);

  const handleStart = useCallback(async () => {
    if (!installPath) {
      const selected = await browseFolder();
      if (selected) {
        setInstallPath(selected);
        localStorage.setItem(STORAGE_KEY_INSTALL_PATH, selected);
        setDetecting(true);
        try {
          const detected = await detectChannel(selected);
          if (detected) {
            setDetectedChannel(detected);
            setChannel(detected);
            localStorage.setItem(STORAGE_KEY_CHANNEL, detected);
          }
        } catch {
          // detection failed
        } finally {
          setDetecting(false);
        }
      }
      return;
    }

    try {
      await startGame(installPath, channel);
    } catch {
      // error handled by result
    }
  }, [installPath, channel]);

  const handleUpdate = useCallback(async () => {
    if (!installPath) return;
    cancellingRef.current = false;
    localStorage.removeItem(STORAGE_KEY_CANCELLED);
    await resetDownloadCancel();
    setPreparing(true);
    preparingRef.current = true;
    _persistedPreparing = true;
    try {
      setProgress(null);
      await installOrUpdate(channel, installPath);
    } catch {
      // error handled by progress
    }
  }, [channel, installPath]);

  // 解析校验结果 JSON，构建本地化消息
  const formatVerifyResult = useCallback((msg: string): { type: "info" | "warn"; body: string } => {
    try {
      const data = JSON.parse(msg);
      const { ok, failed, repaired, files } = data as { ok: number; failed: number; repaired: number; files: string[] };
      if (failed > 0) {
        const lines = [
          t("launcher.verify_repair_summary", { total: ok + failed, ok, failed }),
          t("launcher.verify_repair_detail", { repaired, failed }),
          ...files.map((f) => `  ${f}`),
        ];
        return { type: "warn", body: lines.join("\n") };
      }
      return { type: "info", body: t("launcher.verify_complete_body", { checked: ok, total: ok }) };
    } catch {
      return { type: "info", body: msg };
    }
  }, [t]);

  const handleVerify = useCallback(async () => {
    if (!installPath) return;
    setFlyoutOpen(false);
    cancellingRef.current = false;
    localStorage.removeItem(STORAGE_KEY_CANCELLED);
    await resetDownloadCancel();
    const threads = parseInt(localStorage.getItem("launcher_verify_threads") || "4", 10);
    setPreparing(true);
    preparingRef.current = true;
    _persistedPreparing = true;
    try {
      setProgress(null);
      const result = await verifyAndRepair(channel, installPath, threads);
      const { type, body } = formatVerifyResult(result.message);
      addMessage({ type, title: t("launcher.verify_complete_title"), body, tag: "verify-result" });
    } catch {
      // error handled by progress
    } finally {
      checkStatus();
    }
  }, [channel, installPath, checkStatus, formatVerifyResult]);

  const handleQuickVerify = useCallback(async () => {
    if (!installPath) return;
    setFlyoutOpen(false);
    cancellingRef.current = false;
    localStorage.removeItem(STORAGE_KEY_CANCELLED);
    await resetDownloadCancel();
    const threads = parseInt(localStorage.getItem("launcher_verify_threads") || "4", 10);
    setPreparing(true);
    preparingRef.current = true;
    _persistedPreparing = true;
    try {
      setProgress(null);
      const result = await verifyAndRepair(channel, installPath, threads, true);
      const { type, body } = formatVerifyResult(result.message);
      addMessage({ type, title: t("launcher.verify_complete_title"), body, tag: "verify-result" });
    } catch {
      // error handled by progress
    } finally {
      checkStatus();
    }
  }, [channel, installPath, checkStatus]);

  const handleCancel = useCallback(async () => {
    cancellingRef.current = true;
    localStorage.setItem(STORAGE_KEY_CANCELLED, "1");
    setProgress(null);
    setPreparing(false);
    preparingRef.current = false;
    _persistedProgress = null;
    _persistedPreparing = false;
    setDownloadSpeed(0);
    await cancelDownload(installPath);
    checkStatus();
  }, [installPath, checkStatus]);

  const handlePreload = useCallback(async () => {
    if (!installPath) return;
    cancellingRef.current = false;
    localStorage.removeItem(STORAGE_KEY_CANCELLED);
    await resetDownloadCancel();
    setPreparing(true);
    preparingRef.current = true;
    _persistedPreparing = true;
    try {
      setProgress(null);
      await preloadDownload(channel, installPath);
    } catch {
      // error handled by progress
    }
  }, [channel, installPath]);

  const handleKill = useCallback(async () => {
    await killGame(channel);
    setTimeout(checkRunning, 500);
  }, [channel, checkRunning]);

  const isInstalled = gameStatus?.is_installed ?? false;
  const hasUpdate = gameStatus?.has_update ?? false;
  const hasPreload = gameStatus?.has_preload ?? false;
  const preloadVersion = gameStatus?.preload_version ?? null;
  const preloadCompleted = gameStatus?.preload_completed ?? false;
  const isDownloading = progress?.stage === "downloading";
  const isVerifying = progress?.stage === "verifying";
  const isChecking = progress?.stage === "checking";
  const isComparing = progress?.stage === "comparing";
  const isRepairing = progress?.stage === "repairing";
  const isApplying = progress?.stage === "applying";
  const isActionRunning = preparing || isDownloading || isApplying || isVerifying || isChecking || isComparing || isRepairing;

  // Recalculate progress flyout position when button content changes (label width shift)
  useLayoutEffect(() => {
    if (!btnHovered || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const fw = 256;
    const fh = 140;
    let x = r.left + r.width / 2;
    let y = r.top - 8;
    if (x - fw / 2 < 8) x = fw / 2 + 8;
    if (x + fw / 2 > window.innerWidth - 8) x = window.innerWidth - fw / 2 - 8;
    if (y - fh < 8) y = r.bottom + 8;
    setProgressFlyoutPos({ x, y });
  }, [btnHovered, isDownloading, gameRunning]);

  // Adjust menu flyout position after render to place it above the hamburger
  useLayoutEffect(() => {
    if (!flyoutOpen || !menuFlyoutPos || !hamburgerRef.current || !menuFlyoutRef.current) return;
    const hr = hamburgerRef.current.getBoundingClientRect();
    const fh = menuFlyoutRef.current.offsetHeight;
    const fw = 208;
    let x = hr.right - fw;
    let y = hr.top - fh - 8;
    if (x < 8) x = 8;
    if (x + fw > window.innerWidth - 8) x = window.innerWidth - fw - 8;
    if (y < 8) y = hr.bottom + 8;
    if (x !== menuFlyoutPos.x || y !== menuFlyoutPos.y) {
      setMenuFlyoutPos({ x, y });
    }
  }, [flyoutOpen, menuFlyoutPos]);

  const getButtonLabel = (): string => {
    if (gameRunning) return btnHovered ? t("launcher.stop") : t("launcher.running");
    if (!installPath) return t("launcher.locate_game");
    if (preparing) return btnHovered ? t("launcher.cancel_verify") : t("launcher.preparing");
    if (isChecking) return t("launcher.checking");
    if (isComparing) return t("launcher.checking");
    if (isVerifying) return btnHovered ? t("launcher.cancel_verify") : t("launcher.verifying");
    if (isRepairing) return btnHovered ? t("launcher.cancel_verify") : t("launcher.repairing");
    if (isDownloading) return btnHovered ? t("launcher.cancel_download") : t("launcher.installing");
    if (isApplying) return btnHovered ? t("launcher.cancel_download") : t("launcher.installing");
    if (!isInstalled) return t("launcher.install_game");
    if (hasUpdate) return t("launcher.update_game");
    return t("launcher.start_game");
  };

  const getButtonIcon = () => {
    if (gameRunning) {
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {btnHovered ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0zM10 9v6m4-6v6" />
          )}
        </svg>
      );
    }
    if (isActionRunning) {
      if (btnHovered) {
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      }
      return (
        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      );
    }
    if (!isInstalled) {
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
      );
    }
    if (hasUpdate) {
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      );
    }
    return (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    );
  };

  const handleButtonClick = () => {
    if (gameRunning) {
      if (localStorage.getItem(STORAGE_KEY_SKIP_STOP_CONFIRM) === "1") {
        handleKill();
      } else {
        setConfirmAction("stop-game");
        setConfirmCheckbox(false);
      }
    } else if (preparing || isVerifying || isChecking || isComparing || isRepairing) {
      handleCancel();
    } else if (isDownloading || isApplying) {
      const behavior = localStorage.getItem(STORAGE_KEY_CANCEL_BEHAVIOR) || "ask";
      if (behavior === "keep") {
        cancellingRef.current = true;
        localStorage.setItem(STORAGE_KEY_CANCELLED, "1");
        setProgress(null);
        setDownloadSpeed(0);
        cancelDownload(); // no path → keep files
        checkStatus();
      } else if (behavior === "delete") {
        handleCancel();
      } else {
        setConfirmAction("cancel-download");
        setConfirmCheckbox(false);
      }
    } else if (!isInstalled) {
      handleInstall();
    } else if (hasUpdate) {
      handleUpdate();
    } else {
      handleStart();
    }
  };

  const handleConfirmAction = useCallback((deleteFiles: boolean) => {
    if (confirmAction === "cancel-download") {
      cancellingRef.current = true;
      localStorage.setItem(STORAGE_KEY_CANCELLED, "1");
      setProgress(null);
      setDownloadSpeed(0);
      if (deleteFiles) {
        cancelDownload(installPath);
      } else {
        cancelDownload(); // no path → just set flag, no cleanup
      }
      checkStatus();
    } else if (confirmAction === "stop-game") {
      if (confirmCheckbox) localStorage.setItem(STORAGE_KEY_SKIP_STOP_CONFIRM, "1");
      handleKill();
    } else if (confirmAction === "resume-install") {
      startInstall(deleteFiles); // deleteFiles=true → clean cache → fresh; deleteFiles=false → resume
    } else if (confirmAction === "delete-temp") {
      if (installPath) {
        cancelDownload(installPath);
        checkStatus();
      }
    } else if (confirmAction === "verify-confirm") {
      handleVerify();
    }
    setConfirmAction(null);
    setConfirmCheckbox(false);
  }, [confirmAction, confirmCheckbox, installPath, handleKill, checkStatus, startInstall, handleVerify]);

  return (
    <>
      <div className="relative inline-flex items-center gap-2" ref={flyoutRef}>
        {/* Detected channel badge */}
        {installPath && isInstalled && detectedChannel && (
          <div className="h-11 px-4 rounded-full glass-surface border border-white/15 flex items-center gap-1.5 text-sm text-white/80 shrink-0">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400/80" />
            <span>{CHANNEL_LABELS[detectedChannel][lang]}</span>
          </div>
        )}

        {/* Detecting channel indicator */}
        {installPath && detecting && !detectedChannel && (
          <div className="h-11 px-4 rounded-full glass-surface border border-white/15 flex items-center gap-1.5 text-sm text-white/50 shrink-0">
            <div className="w-1.5 h-1.5 rounded-full bg-yellow-400/60 animate-pulse" />
            <span>{t("launcher.detecting_channel")}</span>
          </div>
        )}

        {/* Preload button */}
        {hasUpdate && hasPreload && !preloadCompleted && isInstalled && (
          <button
            type="button"
            onClick={handlePreload}
            onMouseEnter={() => setPreloadHovered(true)}
            onMouseLeave={() => setPreloadHovered(false)}
            disabled={isActionRunning}
            className="h-11 px-4 rounded-full text-xs font-medium text-white/80
              glass-surface border border-white/15
              hover:bg-white/15 hover:text-white
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-all duration-200 cursor-pointer
              flex items-center gap-2"
            title={t("launcher.preload_tooltip")}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
            </svg>
            <span className="whitespace-nowrap">{t("launcher.preload")}</span>
          </button>
        )}

        {/* Preload completed indicator */}
        {hasUpdate && hasPreload && preloadCompleted && isInstalled && (
          <div className="h-11 px-3 rounded-full flex items-center gap-1.5 text-xs text-emerald-400/80">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>{t("launcher.preloaded")}</span>
          </div>
        )}

        <button
          ref={btnRef}
          type="button"
          onClick={handleButtonClick}
          onMouseEnter={() => {
            setBtnHovered(true);
            if (btnRef.current) {
              const r = btnRef.current.getBoundingClientRect();
              const fw = 256;
              const fh = 140;
              let x = r.left + r.width / 2;
              let y = r.top - 8;
              if (x - fw / 2 < 8) x = fw / 2 + 8;
              if (x + fw / 2 > window.innerWidth - 8) x = window.innerWidth - fw / 2 - 8;
              if (y - fh < 8) {
                y = r.bottom + 8;
              }
              setProgressFlyoutPos({ x, y });
            }
          }}
          onMouseLeave={() => { setBtnHovered(false); setProgressFlyoutPos(null); }}
          disabled={!statusReady}
          className={`h-11 px-6 rounded-full text-sm font-semibold text-white
            glass-surface border border-white/15
            shadow-lg active:scale-95
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-all duration-200 cursor-pointer
            flex items-center gap-2.5 ${
              gameRunning
                ? btnHovered
                  ? "bg-red-500/80 hover:bg-red-500 shadow-red-500/20"
                  : "bg-red-500/40 shadow-red-500/10"
                : (preparing || isDownloading || isApplying || isVerifying || isComparing || isRepairing) && btnHovered
                  ? "bg-red-500/60 hover:bg-red-500/80 shadow-red-500/20"
                  : "bg-gradient-to-r from-primary/80 to-primary/60 hover:from-primary hover:to-primary/80 shadow-primary/20"
            }`}
        >
          {getButtonIcon()}
          <span className="whitespace-nowrap">{getButtonLabel()}</span>
        </button>

        {/* Progress flyout — fixed portal, auraglass styling */}
        {btnHovered && isActionRunning && (preparing || progress) && (preparing || isDownloading || isApplying || isVerifying || isComparing || isRepairing) && progressFlyoutPos && !confirmAction && createPortal(
          <div
            className="fixed z-[200] w-64 rounded-xl glass-surface-strong border border-separator/70 shadow-2xl px-4 py-3 pointer-events-none"
            style={{
              left: progressFlyoutPos.x,
              top: progressFlyoutPos.y,
              transform: progressFlyoutPos.y < 200 ? "translate(-50%, 0)" : "translate(-50%, -100%)",
            }}
          >
            {preparing && !progress && (
              <div className="flex items-center gap-2 text-xs text-white/50">
                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span>{t("launcher.preparing")}</span>
              </div>
            )}
            {isDownloading && (
              <>
                <div className="flex items-center justify-between text-xs text-white/50 mb-1.5">
                  <span>{formatBytes(progress.downloaded)}</span>
                  <span>{formatBytes(progress.total)}</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-white/10 mb-2 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-300"
                    style={{ width: `${progress.total > 0 ? (progress.downloaded / progress.total) * 100 : 0}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] text-white/40">
                  <span>{downloadSpeed > 0 ? `${formatBytes(Math.round(downloadSpeed))}/s` : "—"}</span>
                  <span>
                    {progress.total > progress.downloaded
                      ? downloadSpeed > 0
                        ? (() => {
                            const remaining = Math.round((progress.total - progress.downloaded) / downloadSpeed);
                            const h = Math.floor(remaining / 3600);
                            const m = Math.floor((remaining % 3600) / 60);
                            const s = remaining % 60;
                            return h > 0
                              ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
                              : `${m}:${String(s).padStart(2, "0")}`;
                          })()
                        : t("launcher.calculating")
                      : ""}
                  </span>
                </div>
                {progress.current_file && (
                  <div className="mt-1.5 text-[10px] text-white/30 truncate" title={progress.current_file}>
                    {progress.current_file.split("/").pop()}
                  </div>
                )}
              </>
            )}
            {isVerifying && (
              <>
                <div className="flex items-center justify-between text-xs text-white/50 mb-1.5">
                  <span>{t("launcher.verifying")}</span>
                  <span>{progress.total > 0 ? `${Math.round((progress.verified_bytes / progress.total) * 100)}%` : ""}</span>
                </div>
                {progress.total > 0 && (
                  <div className="w-full h-1.5 rounded-full bg-white/10 mb-2 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-300"
                      style={{ width: `${(progress.verified_bytes / progress.total) * 100}%` }}
                    />
                  </div>
                )}
                <div className="flex items-center justify-between text-[10px] text-white/40">
                  <span>{verifySpeed > 0 ? `${(verifySpeed / 1048576).toFixed(1)} MB/s` : "—"}</span>
                  <span>{progress.file_count > 0 ? `${progress.file_index + 1} / ${progress.file_count}` : ""}</span>
                </div>
              </>
            )}
            {isComparing && (
              <div className="text-xs text-white/60 text-center py-1">
                {t("launcher.checking")}
              </div>
            )}
            {isRepairing && (
              <>
                <div className="flex items-center justify-between text-xs text-white/50 mb-1.5">
                  <span>{t("launcher.repairing")}</span>
                  <span>{progress.total > 0 ? `${Math.round((progress.verified_bytes / progress.total) * 100)}%` : ""}</span>
                </div>
                {progress.total > 0 && (
                  <div className="w-full h-1.5 rounded-full bg-white/10 mb-2 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-300"
                      style={{ width: `${(progress.verified_bytes / progress.total) * 100}%` }}
                    />
                  </div>
                )}
                <div className="flex items-center justify-between text-[10px] text-white/40">
                  <span>{progress.file_count > 0 ? `${progress.file_index + 1} / ${progress.file_count}` : ""}</span>
                </div>
              </>
            )}
            {isApplying && (
              <div className="text-xs text-white/60 text-center py-1">
                {t("launcher.applying")}
              </div>
            )}
          </div>,
          document.body
        )}

        <button
          ref={hamburgerRef}
          type="button"
          onClick={() => {
            const next = !flyoutOpen;
            setFlyoutOpen(next);
            if (next && hamburgerRef.current) {
              const r = hamburgerRef.current.getBoundingClientRect();
              const fw = 208;
              let x = r.right - fw;
              let y = r.top - 8;
              if (x < 8) x = 8;
              if (x + fw > window.innerWidth - 8) x = window.innerWidth - fw - 8;
              setMenuFlyoutPos({ x, y });
              if (installPath) {
                hasDownloadCache(installPath).then(setHasTempFiles);
              }
            } else {
              setMenuFlyoutPos(null);
            }
          }}
          className="w-11 h-11 rounded-full flex items-center justify-center
            glass-surface border border-white/15
            text-white/70 hover:text-white hover:bg-white/20
            transition-all duration-200 cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {flyoutOpen && menuFlyoutPos && createPortal(
          <div
            ref={menuFlyoutRef}
            data-flyout-menu
            className="fixed z-[200] w-52 rounded-xl glass-surface-strong border border-separator/70 shadow-2xl"
            style={{
              left: menuFlyoutPos.x,
              top: menuFlyoutPos.y,
            }}
          >
            <button
              type="button"
              onClick={() => {
                setFlyoutOpen(false);
                setMenuFlyoutPos(null);
                setSettingsOpen(true);
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground/80 hover:bg-white/10 hover:text-foreground transition-colors cursor-pointer"
            >
              <svg className="w-4 h-4 text-foreground/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {t("launcher.game_settings")}
            </button>

            <button
              type="button"
              onClick={() => {
                setFlyoutOpen(false);
                setMenuFlyoutPos(null);
                setConfirmAction("verify-confirm");
                setConfirmCheckbox(false);
              }}
              disabled={isActionRunning}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground/80 hover:bg-white/10 hover:text-foreground transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <svg className="w-4 h-4 text-foreground/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              {t("launcher.verify_integrity")}
            </button>

            <button
              type="button"
              onClick={() => {
                setFlyoutOpen(false);
                setMenuFlyoutPos(null);
                handleQuickVerify();
              }}
              disabled={isActionRunning}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground/80 hover:bg-white/10 hover:text-foreground transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <svg className="w-4 h-4 text-foreground/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              {t("launcher.quick_verify")}
            </button>

            <button
              type="button"
              onClick={() => {
                setFlyoutOpen(false);
                setMenuFlyoutPos(null);
                setConfirmAction("delete-temp");
                setConfirmCheckbox(false);
              }}
              disabled={isActionRunning || !installPath || !hasTempFiles}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground/80 hover:bg-white/10 hover:text-foreground transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <svg className="w-4 h-4 text-foreground/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              {t("launcher.delete_temp_files")}
            </button>

            <button
              type="button"
              onClick={() => {
                setFlyoutOpen(false);
                setMenuFlyoutPos(null);
                handleLocate();
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground/80 hover:bg-white/10 hover:text-foreground transition-colors cursor-pointer border-t border-separator/50"
            >
              <svg className="w-4 h-4 text-foreground/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              {t("launcher.locate_game")}
            </button>
          </div>,
          document.body
        )}
      </div>

      {settingsOpen && (
        <GameSettingsModal
          initialPath={installPath}
          onClose={() => setSettingsOpen(false)}
          onSave={(path) => {
            setInstallPath(path);
            localStorage.setItem(STORAGE_KEY_INSTALL_PATH, path);
            setSettingsOpen(false);
            checkStatus();
          }}
        />
      )}

      {/* Confirm dialog for cancel download / stop game / resume install / delete temp / verify */}
      <GlassAlertDialog isOpen={confirmAction !== null} onOpenChange={(o) => { if (!o) { setConfirmAction(null); setConfirmCheckbox(false); } }}>
        <GlassAlertDialog.Backdrop className="z-[300]">
          <GlassAlertDialog.Container>
            <GlassAlertDialog.Dialog className="sm:max-w-[380px]">
              <GlassAlertDialog.CloseTrigger />
              <GlassAlertDialog.Header>
                <GlassAlertDialog.Icon status={confirmAction === "verify-confirm" ? "warning" : "danger"} />
                <GlassAlertDialog.Heading>
                  {confirmAction === "cancel-download"
                    ? t("launcher.cancel_download_confirm_title")
                    : confirmAction === "resume-install"
                      ? t("launcher.resume_install_title")
                      : confirmAction === "delete-temp"
                        ? t("launcher.delete_temp_confirm_title")
                        : confirmAction === "verify-confirm"
                          ? t("launcher.verify_confirm_title")
                          : t("launcher.stop_game_confirm_title")}
                </GlassAlertDialog.Heading>
              </GlassAlertDialog.Header>
              <GlassAlertDialog.Body>
                <p className="text-sm text-muted">
                  {confirmAction === "cancel-download"
                    ? t("launcher.cancel_download_confirm_body")
                    : confirmAction === "resume-install"
                      ? t("launcher.resume_install_body")
                      : confirmAction === "delete-temp"
                        ? t("launcher.delete_temp_confirm_body")
                        : confirmAction === "verify-confirm"
                          ? t("launcher.verify_confirm_body")
                          : t("launcher.stop_game_confirm_body")}
                </p>
                {confirmAction === "stop-game" && (
                  <label className="flex items-center gap-2 mt-4 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={confirmCheckbox}
                      onChange={(e) => setConfirmCheckbox(e.target.checked)}
                      className="w-4 h-4 rounded border-separator bg-background accent-primary cursor-pointer"
                    />
                    <span className="text-xs text-muted">{t("launcher.dont_ask_again")}</span>
                  </label>
                )}
              </GlassAlertDialog.Body>
              <GlassAlertDialog.Footer>
                {confirmAction === "cancel-download" ? (
                  <>
                    <GlassButton variant="tertiary" onPress={() => handleConfirmAction(false)}>
                      {t("launcher.keep_files")}
                    </GlassButton>
                    <GlassButton variant="danger" onPress={() => handleConfirmAction(true)}>
                      {t("launcher.delete_files")}
                    </GlassButton>
                  </>
                ) : confirmAction === "resume-install" ? (
                  <>
                    <GlassButton variant="tertiary" onPress={() => handleConfirmAction(true)}>
                      {t("launcher.start_fresh")}
                    </GlassButton>
                    <GlassButton variant="primary" onPress={() => handleConfirmAction(false)}>
                      {t("launcher.continue_download")}
                    </GlassButton>
                  </>
                ) : confirmAction === "delete-temp" ? (
                  <>
                    <GlassButton variant="tertiary" onPress={() => { setConfirmAction(null); setConfirmCheckbox(false); }}>
                      {t("launcher.cancel")}
                    </GlassButton>
                    <GlassButton variant="danger" onPress={() => handleConfirmAction(true)}>
                      {t("launcher.delete_files")}
                    </GlassButton>
                  </>
                ) : confirmAction === "verify-confirm" ? (
                  <>
                    <GlassButton variant="tertiary" onPress={() => { setConfirmAction(null); setConfirmCheckbox(false); }}>
                      {t("launcher.cancel")}
                    </GlassButton>
                    <GlassButton variant="primary" onPress={() => handleConfirmAction(false)}>
                      {t("launcher.confirm")}
                    </GlassButton>
                  </>
                ) : (
                  <>
                    <GlassButton variant="tertiary" onPress={() => { setConfirmAction(null); setConfirmCheckbox(false); }}>
                      {t("launcher.cancel")}
                    </GlassButton>
                    <GlassButton variant="danger" onPress={() => handleConfirmAction(false)}>
                      {t("launcher.confirm_stop")}
                    </GlassButton>
                  </>
                )}
              </GlassAlertDialog.Footer>
            </GlassAlertDialog.Dialog>
          </GlassAlertDialog.Container>
        </GlassAlertDialog.Backdrop>
      </GlassAlertDialog>

      {/* Channel Selection Dialog */}
      {channelSelectOpen && (
        <GlassAlertDialog isOpen onOpenChange={(o) => { if (!o) { setChannelSelectOpen(false); setPendingInstallPath(null); } }}>
          <GlassAlertDialog.Backdrop className="z-[300]">
            <GlassAlertDialog.Container>
              <GlassAlertDialog.Dialog className="sm:max-w-[420px]">
                <GlassAlertDialog.CloseTrigger />
                <GlassAlertDialog.Header>
                  <GlassAlertDialog.Icon status="info" />
                  <GlassAlertDialog.Heading>{t("launcher.select_channel_title")}</GlassAlertDialog.Heading>
                </GlassAlertDialog.Header>
                <GlassAlertDialog.Body>
                  <p className="text-sm text-muted mb-4">{t("launcher.select_channel_desc")}</p>
                  <div className="flex flex-col gap-2">
                    {ALL_CHANNELS.map((ch) => (
                      <button
                        key={ch}
                        type="button"
                        onClick={() => handleChannelSelected(ch)}
                        disabled={scanning}
                        className="flex items-center gap-3 p-3 rounded-lg glass-surface border border-separator/50 hover:border-primary/50 hover:bg-primary/10 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                          <span className="text-sm font-bold text-primary">
                            {ch === "official" ? "官" : ch === "bilibili" ? "B" : ch === "global" ? "G" : "GP"}
                          </span>
                        </div>
                        <span className="text-sm font-medium text-foreground/80">
                          {CHANNEL_LABELS[ch]?.[lang] || ch}
                        </span>
                      </button>
                    ))}
                  </div>
                  {scanning && (
                    <div className="flex items-center gap-2 mt-4 text-xs text-muted">
                      <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                      <span>{t("launcher.scanning_files")}</span>
                    </div>
                  )}
                </GlassAlertDialog.Body>
                <GlassAlertDialog.Footer>
                  <GlassButton variant="tertiary" onPress={() => { setChannelSelectOpen(false); setPendingInstallPath(null); }}>
                    {t("launcher.cancel")}
                  </GlassButton>
                </GlassAlertDialog.Footer>
              </GlassAlertDialog.Dialog>
            </GlassAlertDialog.Container>
          </GlassAlertDialog.Backdrop>
        </GlassAlertDialog>
      )}

      {/* Scan Result Dialog */}
      {scanOpen && scanResult && (
        <GlassAlertDialog isOpen onOpenChange={(o) => { if (!o) { setScanOpen(false); setScanResult(null); setDiskSpace(null); } }}>
          <GlassAlertDialog.Backdrop className="z-[300]">
            <GlassAlertDialog.Container>
              <GlassAlertDialog.Dialog className="sm:max-w-[400px]">
                <GlassAlertDialog.CloseTrigger />
                <GlassAlertDialog.Header>
                  <GlassAlertDialog.Icon status={
                    scanResult.download_bytes === 0
                      ? "success"
                      : diskSpace !== null && diskSpace.free < scanResult.download_bytes
                        ? "danger"
                        : "info"
                  } />
                  <GlassAlertDialog.Heading>
                    {scanResult.download_bytes === 0
                      ? t("launcher.scan_result_all_valid")
                      : t("launcher.confirm_install")
                    }
                  </GlassAlertDialog.Heading>
                </GlassAlertDialog.Header>
                <GlassAlertDialog.Body>
                  {scanResult.download_bytes === 0 ? (
                    <p className="text-sm text-muted">{t("launcher.no_files_found")}</p>
                  ) : (
                    <div className="space-y-4">
                      {/* Disk space usage bar */}
                      {diskSpace !== null && (() => {
                        const downloadBytes = scanResult.download_bytes;
                        const diskUsed = diskSpace.total - diskSpace.free;
                        const freeAfter = diskSpace.free - downloadBytes;
                        const totalSpace = diskSpace.total;
                        const usedPct = totalSpace > 0 ? (diskUsed / totalSpace) * 100 : 0;
                        const downloadPct = totalSpace > 0 ? (downloadBytes / totalSpace) * 100 : 0;
                        const freePct = totalSpace > 0 ? (freeAfter / totalSpace) * 100 : 0;
                        const insufficient = freeAfter < 0;
                        return (
                          <div className="space-y-2">
                            <div className="w-full h-3 rounded-full bg-white/5 overflow-hidden flex">
                              {usedPct > 0 && (
                                <div
                                  className="h-full bg-blue-400/70 transition-all duration-300"
                                  style={{ width: `${Math.min(usedPct, 100)}%` }}
                                />
                              )}
                              {downloadPct > 0 && (
                                <div
                                  className={`h-full transition-all duration-300 ${insufficient ? "bg-red-400/70" : "bg-emerald-400/70"}`}
                                  style={{ width: `${Math.min(downloadPct, 100 - usedPct)}%` }}
                                />
                              )}
                              {freePct > 0 && (
                                <div
                                  className="h-full bg-white/10 transition-all duration-300"
                                  style={{ width: `${Math.min(freePct, 100 - usedPct - downloadPct)}%` }}
                                />
                              )}
                            </div>
                            <div className="flex items-center gap-4 text-[11px] text-muted">
                              <div className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-sm bg-blue-400/70" />
                                <span>{t("launcher.disk_used")}: {formatBytes(diskUsed)}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <div className={`w-2 h-2 rounded-sm ${insufficient ? "bg-red-400/70" : "bg-emerald-400/70"}`} />
                                <span>{t("launcher.need_download")}: {formatBytes(downloadBytes)}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-sm bg-white/10" />
                                <span>{t("launcher.disk_free_space")}: {formatBytes(freeAfter > 0 ? freeAfter : 0)}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                      {diskSpace === null && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted">{t("launcher.need_download")}</span>
                          <span className="font-medium text-foreground">
                            {scanResult.missing_files + scanResult.corrupted_files} {t("launcher.files_count")}，{formatBytes(scanResult.download_bytes)}
                          </span>
                        </div>
                      )}
                      {diskSpace !== null && diskSpace.free < scanResult.download_bytes && (
                        <p className="text-xs text-red-400">{t("launcher.disk_space_insufficient")}</p>
                      )}
                    </div>
                  )}
                </GlassAlertDialog.Body>
                <GlassAlertDialog.Footer>
                  <GlassButton variant="tertiary" onPress={() => { setScanOpen(false); setScanResult(null); setDiskSpace(null); }}>
                    {t("launcher.cancel")}
                  </GlassButton>
                  <GlassButton
                    variant="primary"
                    disabled={scanResult.download_bytes > 0 && diskSpace !== null && diskSpace.free < scanResult.download_bytes}
                    onPress={() => {
                      setScanOpen(false);
                      setScanResult(null);
                      setDiskSpace(null);
                      if (scanResult.download_bytes === 0) {
                        startInstall(false);
                      } else {
                        hasDownloadCache(installPath).then((has) => {
                          if (has) {
                            setConfirmAction("resume-install");
                            setConfirmCheckbox(false);
                          } else {
                            startInstall(false);
                          }
                        });
                      }
                    }}
                  >
                    {scanResult.download_bytes === 0 ? t("launcher.start_game") : t("launcher.confirm_install_btn")}
                  </GlassButton>
                </GlassAlertDialog.Footer>
              </GlassAlertDialog.Dialog>
            </GlassAlertDialog.Container>
          </GlassAlertDialog.Backdrop>
        </GlassAlertDialog>
      )}
    </>
  );
}

// ========== Game Settings Modal ==========

interface GameSettingsModalProps {
  initialPath: string;
  onClose: () => void;
  onSave: (path: string) => void;
}

function GameSettingsModal({ initialPath, onClose, onSave }: GameSettingsModalProps) {
  const { t } = useTranslation();
  const [path, setPath] = useState(initialPath);

  const handleBrowse = useCallback(async () => {
    const selected = await browseFolder();
    if (selected) setPath(selected);
  }, []);

  return (
    <GlassModal isOpen onOpenChange={(open) => !open && onClose()}>
      <GlassModal.Backdrop isDismissable>
        <GlassModal.Container size="sm">
          <GlassModal.Dialog>
            <GlassModal.Header>
              <div className="flex items-center justify-between px-5 py-4 border-b border-separator/50">
                <GlassModal.Heading className="text-sm">{t("launcher.game_settings")}</GlassModal.Heading>
                <GlassModal.CloseTrigger />
              </div>
            </GlassModal.Header>
            <GlassModal.Body>
              <div className="px-5 py-4 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-muted mb-1.5">{t("launcher.install_path")}</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={path}
                      onChange={(e) => setPath(e.target.value)}
                      className="flex-1 h-9 px-3 rounded-lg glass-field border border-separator text-sm text-foreground outline-none placeholder:text-muted"
                      placeholder="C:\Games\Endfield"
                    />
                    <button
                      type="button"
                      onClick={handleBrowse}
                      className="h-9 px-3 rounded-lg glass-surface border border-primary/30 text-xs font-medium text-primary hover:bg-primary/20 transition-colors cursor-pointer shrink-0"
                    >
                      {t("launcher.browse")}
                    </button>
                  </div>
                </div>
              </div>
            </GlassModal.Body>
            <GlassModal.Footer>
              <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-separator/50">
                <button
                  type="button"
                  onClick={onClose}
                  className="h-8 px-4 rounded-lg text-xs font-medium text-muted hover:text-foreground hover:bg-white/10 transition-colors cursor-pointer"
                >
                  {t("launcher.cancel")}
                </button>
                <button
                  type="button"
                  onClick={() => onSave(path)}
                  className="h-8 px-4 rounded-lg text-xs font-medium text-white bg-primary hover:bg-primary/90 transition-colors cursor-pointer"
                >
                  OK
                </button>
              </div>
            </GlassModal.Footer>
          </GlassModal.Dialog>
        </GlassModal.Container>
      </GlassModal.Backdrop>
    </GlassModal>
  );
}
