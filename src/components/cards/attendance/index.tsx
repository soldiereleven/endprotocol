import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Card, Button, ProgressCircle } from "@heroui/react";
import { useTranslation } from "react-i18next";
import { BaseCardProps } from "../registry/types";
import { CardConfigService } from "@/utils/cardConfigService";
import type { AttendanceCardSettings } from "@/types/card-settings";
import { AttendanceSettingsModal } from "./attendance-settings-modal";
import { getAccounts, type Account } from "@/utils/accountService";
import { Img } from "@/utils/imageLoader";
import { invoke } from "@tauri-apps/api/core";
import { logError } from "@/utils/logger";
import { resolveServerLabel } from "@/types";

interface CalendarEntry {
  awardId: string;
  available: boolean;
  done: boolean;
}

interface ResourceInfo {
  id: string;
  count: number;
  name: string;
  icon: string;
}

interface AttendanceData {
  currentTs: string;
  calendar: CalendarEntry[];
  first: CalendarEntry[];
  resourceInfoMap: Record<string, ResourceInfo>;
  hasToday: boolean;
}

type AttendanceState = "loading" | "signed" | "unsigned" | "error";
type SignPhase = "idle" | "spinning" | "completing" | "done";

function parseAttendanceData(json: any): AttendanceData | null {
  try {
    const data = json?.data;
    if (!data?.calendar || !data?.resourceInfoMap) return null;
    return {
      currentTs: data.currentTs ?? "",
      calendar: data.calendar,
      first: data.first ?? [],
      resourceInfoMap: data.resourceInfoMap,
      hasToday: data.hasToday ?? false,
    };
  } catch {
    return null;
  }
}

function findTodayEntry(calendar: CalendarEntry[]): { index: number; entry: CalendarEntry } | null {
  const unsignedIdx = calendar.findIndex((e) => e.available && !e.done);
  if (unsignedIdx >= 0) return { index: unsignedIdx, entry: calendar[unsignedIdx] };
  const doneIdx = findLastIndex(calendar, (e) => e.done);
  if (doneIdx >= 0) return { index: doneIdx, entry: calendar[doneIdx] };
  if (calendar.length > 0) return { index: 0, entry: calendar[0] };
  return null;
}

function findLastIndex<T>(arr: T[], predicate: (item: T) => boolean): number {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (predicate(arr[i])) return i;
  }
  return -1;
}

export default function AttendanceCard({
  roleId: _roleId,
  cardId,
  isEditMode = false,
}: BaseCardProps) {
  const { t, i18n } = useTranslation();
  const [settings, setSettings] = useState<AttendanceCardSettings>({});
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [firstTimePrompt, setFirstTimePrompt] = useState(true);

  const [attendanceData, setAttendanceData] = useState<AttendanceData | null>(null);
  const [attendanceState, setAttendanceState] = useState<AttendanceState>("loading");
  const [signPhase, setSignPhase] = useState<SignPhase>("idle");
  const [_signError, setSignError] = useState<string | null>(null);

  const [accountCache, setAccountCache] = useState<Account[]>([]);
  const autoSignAttempted = useRef(false);
  const completionTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const lang = i18n.language;

  const loadSettings = useCallback(async () => {
    try {
      const s = await CardConfigService.getCardSettings<AttendanceCardSettings>(cardId);
      setSettings(s);
      if (!s.selectedRoleId && firstTimePrompt) {
        setShowSettingsModal(true);
      }
      setSettingsLoaded(true);
    } catch (e) {
      logError("[Attendance] Failed to load settings:", e);
      setSettingsLoaded(true);
    }
  }, [cardId, firstTimePrompt]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const fetchAttendance = useCallback(async () => {
    const rid = settings.selectedRoleId;
    if (!rid) return;
    setAttendanceState("loading");
    setSignError(null);
    try {
      const result = await invoke<any>("get_attendance", { roleId: rid });
      const parsed = parseAttendanceData(result);
      if (!parsed) {
        setAttendanceState("error");
        setSignError(t("card:attendance_error"));
        return;
      }
      setAttendanceData(parsed);
      setAttendanceState(parsed.hasToday ? "signed" : "unsigned");
    } catch (e) {
      logError("[Attendance] GET failed:", e);
      setAttendanceState("error");
      setSignError(String(e));
    }
  }, [settings.selectedRoleId, t]);

  const loadAccounts = useCallback(async () => {
    try {
      const accs = await getAccounts();
      setAccountCache(accs);
    } catch (e) {
      logError("[Attendance] Failed to get accounts:", e);
    }
  }, []);

  useEffect(() => {
    if (!settingsLoaded) return;
    if (!settings.selectedRoleId) {
      setAttendanceState("unsigned");
      return;
    }
    fetchAttendance();
    loadAccounts();
  }, [settingsLoaded, settings.selectedRoleId, fetchAttendance, loadAccounts]);

  const completeSignIn = useCallback(() => {
    setSignPhase("completing");
    completionTimer.current = setTimeout(() => {
      setSignPhase("done");
      setAttendanceState("signed");
      fetchAttendance();
    }, 600);
  }, [fetchAttendance]);

  const handleSignIn = useCallback(async () => {
    if (signPhase !== "idle" || attendanceState === "signed") return;
    const rid = settings.selectedRoleId;
    if (!rid) {
      setShowSettingsModal(true);
      return;
    }
    setSignPhase("spinning");
    setSignError(null);
    try {
      await invoke<any>("do_attendance", { roleId: rid });
      completeSignIn();
    } catch (e) {
      logError("[Attendance] POST failed:", e);
      setSignError(String(e));
      setSignPhase("idle");
    }
  }, [signPhase, attendanceState, settings.selectedRoleId, completeSignIn]);

  useEffect(() => {
    return () => {
      if (completionTimer.current) clearTimeout(completionTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!settingsLoaded || !settings.selectedRoleId || !settings.autoSign) return;
    if (autoSignAttempted.current) return;
    if (attendanceState === "signed" || attendanceState === "loading") return;
    autoSignAttempted.current = true;
    const timer = setTimeout(() => { handleSignIn(); }, 1500);
    return () => clearTimeout(timer);
  }, [settingsLoaded, settings.autoSign, attendanceState, handleSignIn]);

  const handleSaveSettings = useCallback(
    async (selectedRoleId: string | undefined, autoSign: boolean) => {
      try {
        await CardConfigService.updateCardSetting(cardId, "selectedRoleId", selectedRoleId);
        await CardConfigService.updateCardSetting(cardId, "autoSign", autoSign);
        setSettings({ selectedRoleId, autoSign });
        setFirstTimePrompt(false);
      } catch (e) {
        logError("[Attendance] Failed to save settings:", e);
      }
    },
    [cardId],
  );

  const selectedAccount = useMemo(
    () => accountCache.find((a) => a.id === settings.selectedRoleId),
    [accountCache, settings.selectedRoleId],
  );

  const todayReward = useMemo(() => {
    if (!attendanceData) return null;
    const today = findTodayEntry(attendanceData.calendar);
    if (!today) return null;
    return attendanceData.resourceInfoMap[today.entry.awardId] ?? null;
  }, [attendanceData]);

  const todayClaimed = useMemo(() => {
    if (!attendanceData) return false;
    const today = findTodayEntry(attendanceData.calendar);
    return today ? today.entry.done : false;
  }, [attendanceData]);

  const tomorrowReward = useMemo(() => {
    if (!attendanceData) return null;
    const today = findTodayEntry(attendanceData.calendar);
    if (!today) return null;
    const tomorrowEntry = attendanceData.calendar[today.index + 1];
    if (!tomorrowEntry) return null;
    return attendanceData.resourceInfoMap[tomorrowEntry.awardId] ?? null;
  }, [attendanceData]);

  const tomorrowClaimed = useMemo(() => {
    if (!attendanceData) return false;
    const today = findTodayEntry(attendanceData.calendar);
    if (!today) return false;
    const tomorrowEntry = attendanceData.calendar[today.index + 1];
    return tomorrowEntry ? tomorrowEntry.done : false;
  }, [attendanceData]);

  if (!settingsLoaded) {
    return (
      <Card className="p-3 bg-content1 shadow-sm border border-separator h-full w-full flex items-center justify-center">
        <ProgressCircle isIndeterminate size="sm" aria-label="Loading">
          <ProgressCircle.Track>
            <ProgressCircle.TrackCircle />
            <ProgressCircle.FillCircle />
          </ProgressCircle.Track>
        </ProgressCircle>
      </Card>
    );
  }

  const showSignButton = attendanceState === "unsigned" && signPhase === "idle";
  const isSpinning = signPhase === "spinning" || signPhase === "completing";
  const isDone = signPhase === "done" || attendanceState === "signed";

  const R = 22;
  const CIRCUMFERENCE = 2 * Math.PI * R;
  const circleProps = { cx: 26, cy: 26, r: R, fill: "none", strokeWidth: 3 };

  function renderRewardBox(
    label: string,
    reward: ResourceInfo | null,
    claimed: boolean,
  ) {
    return (
      <div className="flex-1 min-w-0">
        <p className="text-[9px] text-muted mb-1">{label}</p>
        {reward ? (
          <div className={`flex items-center gap-1.5 ${claimed ? "opacity-40" : ""}`}>
            <div className="relative w-6 h-6 shrink-0">
              <Img
                src={reward.icon}
                alt={reward.name}
                className="w-full h-full object-contain rounded"
              />
              {claimed && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <svg className="w-3 h-3 text-default-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </div>
            <div className="min-w-0 leading-tight">
              <p className="text-[10px] font-medium truncate">{reward.name}</p>
              <p className="text-[10px] text-muted">{reward.count}</p>
            </div>
          </div>
        ) : (
          <p className="text-[10px] text-muted">--</p>
        )}
      </div>
    );
  }

  return (
    <>
      <Card className="p-0 bg-content1 shadow-sm border border-separator h-full w-full select-none rounded-[10px] overflow-hidden flex flex-col">
        <div
          className="flex h-full p-2.5 gap-2.5 cursor-pointer"
          {...(isEditMode ? {} : { onClick: () => setShowSettingsModal(true) })}
        >
          <div className="flex items-center justify-center shrink-0 w-[68px]">
            {!settings.selectedRoleId ? (
              <div className="flex flex-col items-center gap-1.5">
                <svg className="w-6 h-6 text-muted opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                <Button size="sm" variant="secondary" className="text-[9px] h-5 min-w-0 px-1.5" onPress={() => setShowSettingsModal(true)}>
                  {t("card:attendance_select_account")}
                </Button>
              </div>
            ) : attendanceState === "error" && signPhase === "idle" ? (
              <div className="flex flex-col items-center gap-1.5">
                <svg className="w-5 h-5 text-danger opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <Button size="sm" variant="secondary" className="text-[9px] h-5 min-w-0 px-1.5" onPress={fetchAttendance}>
                  {t("card:attendance_refresh")}
                </Button>
              </div>
            ) : attendanceState === "loading" && signPhase === "idle" ? (
              <div className="relative w-[68px] h-[68px]">
                <svg className="w-[68px] h-[68px]" viewBox="0 0 52 52">
                  <circle
                    cx={26} cy={26} r={22}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={3}
                    className="text-warning/20"
                  />
                  <circle
                    cx={26} cy={26} r={22}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={3}
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 22 * 0.25} ${2 * Math.PI * 22 * 0.75}`}
                    className="text-warning"
                    style={{
                      transformOrigin: "26px 26px",
                      transform: "rotate(-90deg)",
                      animation: "attendance-spin-arc 1s linear infinite",
                    }}
                  />
                </svg>
              </div>
            ) : showSignButton ? (
              <div
                className="flex flex-col items-center cursor-pointer hover:opacity-70 transition-opacity"
                onClick={(e) => { e.stopPropagation(); handleSignIn(); }}
              >
                <svg className="w-9 h-9 text-warning" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                </svg>
              </div>
            ) : (
              <div className="relative w-[68px] h-[68px]">
                <svg className="w-[68px] h-[68px]" viewBox="0 0 52 52">
                  {isSpinning && (
                    <circle
                      {...circleProps}
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeDasharray={`${CIRCUMFERENCE * 0.25} ${CIRCUMFERENCE * 0.75}`}
                      strokeDashoffset="0"
                      className="text-warning"
                      style={{
                        transformOrigin: "26px 26px",
                        transform: "rotate(-90deg)",
                        animation: "attendance-spin-arc 1s linear infinite",
                      }}
                    />
                  )}

                  {isDone && (
                    <>
                      <circle
                        {...circleProps}
                        stroke="currentColor"
                        className="text-success"
                        style={{
                          animation: "attendance-ring-in 0.35s ease-out forwards",
                          transformOrigin: "26px 26px",
                          transform: "scale(0)",
                          opacity: 0,
                        }}
                      />
                      <path
                        d="M18 26l5 5 11-11"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-success"
                        style={{
                          animation: "attendance-check-in 0.35s ease-out 0.25s forwards",
                          strokeDasharray: "20",
                          strokeDashoffset: "20",
                          opacity: 0,
                        }}
                      />
                    </>
                  )}
                </svg>
              </div>
            )}
          </div>

          <div className="flex-1 flex flex-col min-w-0 gap-1.5">
            {selectedAccount ? (
              <div
                className="flex items-center gap-1.5 cursor-pointer hover:opacity-70 transition-opacity"
                onClick={(e) => { e.stopPropagation(); setShowSettingsModal(true); }}
              >
                <div className="w-5 h-5 rounded-full overflow-hidden bg-default-200 shrink-0">
                  {selectedAccount.avatar ? (
                    <Img
                      src={selectedAccount.avatar}
                      alt={selectedAccount.nickname}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[7px] text-muted font-semibold">
                      {selectedAccount.nickname.charAt(0)}
                    </div>
                  )}
                </div>
                <div className="min-w-0 leading-tight">
                  <p className="text-[11px] font-medium truncate">{selectedAccount.nickname}</p>
                  <p className="text-[9px] text-muted truncate">{resolveServerLabel(selectedAccount.server, lang)}</p>
                </div>
              </div>
            ) : (
              <div
                className="flex items-center gap-1 cursor-pointer hover:opacity-70 transition-opacity"
                onClick={(e) => { e.stopPropagation(); setShowSettingsModal(true); }}
              >
                <svg className="w-4 h-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                <span className="text-[10px] text-muted">{t("card:attendance_no_account")}</span>
              </div>
            )}

            <div className="flex gap-2 flex-1">
              {renderRewardBox(t("card:attendance_today"), todayReward, todayClaimed)}
              <div className="w-px bg-separator self-stretch" />
              {renderRewardBox(t("card:attendance_tomorrow"), tomorrowReward, tomorrowClaimed)}
            </div>
          </div>
        </div>
      </Card>

      <AttendanceSettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        selectedRoleId={settings.selectedRoleId}
        autoSign={settings.autoSign ?? false}
        onSave={handleSaveSettings}
      />

      <style>{`
        @keyframes attendance-spin-arc {
          from { transform: rotate(-90deg); }
          to { transform: rotate(270deg); }
        }
        @keyframes attendance-ring-in {
          from { transform: scale(0); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        @keyframes attendance-check-in {
          from { stroke-dashoffset: 20; opacity: 0; }
          to { stroke-dashoffset: 0; opacity: 1; }
        }
      `}</style>
    </>
  );
}
