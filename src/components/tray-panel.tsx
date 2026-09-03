import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import { Img } from "@/utils/imageLoader";

interface TrayUserInfo {
  roleId?: string;
  nickname?: string;
  avatar?: string;
  curStamina?: number;
  maxStamina?: number;
  maxTs?: number;
  dailyActivation?: number;
  maxDailyActivation?: number;
  weeklyScore?: number;
  weeklyTotal?: number;
  bpCurLevel?: number;
  bpMaxLevel?: number;
}

function formatRecoveryTime(maxTs: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = maxTs - now;
  if (diff <= 0) return "已满";
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const s = diff % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function StatItem({
  icon,
  label,
  cur,
  max,
  recovery,
}: {
  icon: string;
  label: string;
  cur: number;
  max: number;
  recovery?: string;
}) {
  const pct = max > 0 ? Math.min((cur / max) * 100, 100) : 0;
  return (
    <div className="flex items-center gap-2 px-3 py-1.5">
      <span className="text-sm w-5 text-center shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-[11px] font-medium text-foreground/80">{label}</span>
          <span className="text-[11px] font-semibold text-foreground">
            {cur}/{max}
            {recovery && recovery !== "已满" && (
              <span className="text-muted ml-1 text-[9px] font-normal">
                ({recovery})
              </span>
            )}
          </span>
        </div>
        <div className="h-1 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary/80 to-primary transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export function TrayPanel() {
  const [userInfo, setUserInfo] = useState<TrayUserInfo>({});
  const [now, setNow] = useState(() => Date.now());

  const loadUserInfo = useCallback(async () => {
    try {
      const info = await invoke<TrayUserInfo>("get_tray_user_info");
      setUserInfo(info);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadUserInfo();

    const unlisten = listen<TrayUserInfo>("tray-user-info-updated", (event) => {
      setUserInfo(event.payload);
    });

    const win = getCurrentWindow();
    const unlistenBlur = win.onFocusChanged(({ payload: focused }) => {
      if (!focused) {
        win.hide();
      }
    });

    const timer = window.setInterval(() => setNow(Date.now()), 1000);

    return () => {
      unlisten.then((fn) => fn());
      unlistenBlur.then((fn) => fn());
      window.clearInterval(timer);
    };
  }, [loadUserInfo]);

  const hasUser = !!userInfo.roleId;
  const curStamina = userInfo.curStamina ?? 0;
  const maxStamina = userInfo.maxStamina ?? 0;
  const maxTs = userInfo.maxTs ?? 0;
  const recovery = maxTs > 0 ? formatRecoveryTime(maxTs) : null;

  const handleShowMain = async () => {
    try {
      await invoke("show_main_window");
    } catch {
      const win = getCurrentWindow();
      await win.hide();
    }
  };

  const handleQuit = async () => {
    try {
      await invoke("app_quit");
    } catch {
      getCurrentWindow().app.exit(0);
    }
  };

  return (
    <div className="h-full w-full flex flex-col">
      {/* Header */}
      <div className="px-3 pt-3 pb-1.5">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-primary/60 shrink-0" />
          <h1 className="text-xs font-bold text-foreground tracking-widest">ENDPROTOCOL</h1>
        </div>
      </div>

      {/* User Info */}
      {hasUser ? (
        <div className="px-1.5 pb-1 flex-1">
          <div className="flex items-center gap-2 px-3 py-1.5">
            {userInfo.avatar ? (
              <Img
                src={userInfo.avatar}
                alt={userInfo.nickname ?? ""}
                className="w-7 h-7 rounded-full object-cover shrink-0"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                {(userInfo.nickname ?? "?")[0]}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-xs font-semibold text-foreground truncate">
                {userInfo.nickname}
              </p>
              <p className="text-[9px] text-muted">Lv.{userInfo.bpCurLevel ?? 0}</p>
            </div>
          </div>

          <div className="h-px bg-separator/40 mx-3 my-0.5" />

          <StatItem icon="⚡" label="理智" cur={curStamina} max={maxStamina} recovery={recovery ?? undefined} />
          <StatItem icon="📅" label="每日活跃" cur={userInfo.dailyActivation ?? 0} max={userInfo.maxDailyActivation ?? 0} />
          <StatItem icon="📊" label="每周事务" cur={userInfo.weeklyScore ?? 0} max={userInfo.weeklyTotal ?? 0} />
          <StatItem icon="🎖️" label="通行证" cur={userInfo.bpCurLevel ?? 0} max={userInfo.bpMaxLevel ?? 0} />
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center px-3 py-4">
          <p className="text-xs text-muted text-center">
            未选择用户
            <br />
            <span className="text-[10px] opacity-70">请在设置中选择</span>
          </p>
        </div>
      )}

      {/* Divider */}
      <div className="h-px bg-separator/40 mx-3" />

      {/* Menu */}
      <div className="px-1.5 py-1.5 space-y-0.5">
        <button
          onClick={handleShowMain}
          className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-foreground/80 hover:bg-white/10 hover:text-foreground transition-all duration-200 cursor-pointer"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
          </svg>
          显示窗口
        </button>
        <button
          onClick={handleQuit}
          className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-danger/80 hover:bg-danger/10 hover:text-danger transition-all duration-200 cursor-pointer"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
          </svg>
          退出
        </button>
      </div>
    </div>
  );
}
