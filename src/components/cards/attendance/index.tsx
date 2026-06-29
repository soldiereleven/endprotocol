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

interface AttendanceData {
  currentTs: string;
  calendar: { awardId: string; available: boolean; done: boolean }[];
  resourceInfoMap: Record<string, { id: string; count: number; name: string; icon: string }>;
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
      resourceInfoMap: data.resourceInfoMap,
      hasToday: data.hasToday ?? false,
    };
  } catch {
    return null;
  }
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

  const [attendanceState, setAttendanceState] = useState<AttendanceState>("loading");
  const [signPhase, setSignPhase] = useState<SignPhase>("idle");
  const [signError, setSignError] = useState<string | null>(null);

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
    const timer = setTimeout(() => {
      handleSignIn();
    }, 1500);
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

  if (!settingsLoaded) {
    return (
      <Card className="p-6 bg-content1 shadow-sm border border-separator h-full w-full flex items-center justify-center">
        <ProgressCircle isIndeterminate size="md" aria-label="Loading">
          <ProgressCircle.Track>
            <ProgressCircle.TrackCircle />
            <ProgressCircle.FillCircle />
          </ProgressCircle.Track>
        </ProgressCircle>
      </Card>
    );
  }

  const showSignButton = attendanceState === "unsigned" && signPhase === "idle";
  const isSpinning = signPhase === "spinning";
  const isCompleting = signPhase === "completing";
  const isDone = signPhase === "done" || attendanceState === "signed";

  const CIRCUMFERENCE = 2 * Math.PI * 22;

  return (
    <>
      <Card className="p-0 bg-content1 shadow-sm border border-separator h-full w-full select-none rounded-[10px] overflow-hidden flex flex-col">
        <div
          className="flex flex-col h-full p-3 cursor-pointer"
          {...(isEditMode ? {} : { onClick: () => setShowSettingsModal(true) })}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold">{t("card:attendance_title")}</span>
            {selectedAccount && (
              <div className="flex items-center gap-1.5 max-w-[60%]">
                <div className="w-4 h-4 rounded-full overflow-hidden bg-default-200 shrink-0">
                  {selectedAccount.avatar ? (
                    <Img
                      src={selectedAccount.avatar}
                      alt={selectedAccount.nickname}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[6px] text-muted font-semibold">
                      {selectedAccount.nickname.charAt(0)}
                    </div>
                  )}
                </div>
                <span className="text-[10px] text-muted truncate">
                  {selectedAccount.nickname}
                  <span className="ml-0.5 opacity-60">
                    ({resolveServerLabel(selectedAccount.server, lang)})
                  </span>
                </span>
              </div>
            )}
          </div>

          <div className="flex-1 flex items-center justify-center">
            {!settings.selectedRoleId ? (
              <div className="flex flex-col items-center gap-2">
                <svg className="w-8 h-8 text-muted opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                <p className="text-[10px] text-muted text-center">{t("card:attendance_no_account")}</p>
                <Button size="sm" variant="secondary" className="text-[10px] h-6 min-w-0 px-2" onPress={() => setShowSettingsModal(true)}>
                  {t("card:attendance_select_account")}
                </Button>
              </div>
            ) : attendanceState === "error" && signPhase === "idle" ? (
              <div className="flex flex-col items-center gap-2">
                <svg className="w-6 h-6 text-danger opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <p className="text-[10px] text-danger text-center">{signError}</p>
                <Button size="sm" variant="secondary" className="text-[10px] h-6 min-w-0 px-2" onPress={fetchAttendance}>
                  {t("card:attendance_refresh")}
                </Button>
              </div>
            ) : attendanceState === "loading" && signPhase === "idle" ? (
              <ProgressCircle isIndeterminate size="sm" aria-label="Loading">
                <ProgressCircle.Track>
                  <ProgressCircle.TrackCircle />
                  <ProgressCircle.FillCircle />
                </ProgressCircle.Track>
              </ProgressCircle>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div
                  className="relative w-16 h-16"
                  onClick={(e) => {
                    if (showSignButton) {
                      e.stopPropagation();
                      handleSignIn();
                    }
                  }}
                >
                  <svg className="w-16 h-16 -rotate-90" viewBox="0 0 52 52">
                    <circle
                      cx="26" cy="26" r="22"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      className="text-default-200"
                    />

                    {isSpinning && (
                      <circle
                        cx="26" cy="26" r="22"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeDasharray={`${CIRCUMFERENCE * 0.3} ${CIRCUMFERENCE * 0.7}`}
                        strokeDashoffset="0"
                        className="text-warning animate-spin origin-center"
                        style={{ animationDuration: "0.8s" }}
                      />
                    )}

                    {isCompleting && (
                      <circle
                        cx="26" cy="26" r="22"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeDasharray={CIRCUMFERENCE}
                        strokeDashoffset="0"
                        className="text-warning"
                        style={{
                          animation: "attendance-complete-spin 0.6s ease-out forwards",
                        }}
                      />
                    )}

                    {isDone && (
                      <>
                        <circle
                          cx="26" cy="26" r="22"
                          fill="currentColor"
                          stroke="currentColor"
                          strokeWidth="3"
                          className="text-success"
                          style={{
                            animation: "attendance-fill-in 0.4s ease-out forwards",
                            transformOrigin: "center",
                            transform: "scale(0)",
                          }}
                        />
                        <path
                          d="M18 26l5 5 11-11"
                          fill="none"
                          stroke="white"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          style={{
                            animation: "attendance-check-in 0.4s ease-out 0.3s forwards",
                            strokeDasharray: "20",
                            strokeDashoffset: "20",
                          }}
                        />
                      </>
                    )}

                    {showSignButton && (
                      <g className="cursor-pointer hover:opacity-70 transition-opacity">
                        <circle cx="26" cy="26" r="22" fill="none" stroke="currentColor" strokeWidth="3" className="text-warning" />
                        <path
                          d="M18 28l-2 4 4-2 8-8-2-2-8 8zm9-9l2-2a1 1 0 011.4 0l.6.6a1 1 0 010 1.4l-2 2-2-2z"
                          fill="currentColor"
                          className="text-warning"
                          transform="translate(26,26) translate(-1,0.5)"
                        />
                      </g>
                    )}
                  </svg>

                  {showSignButton && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <span className="text-[9px] text-warning font-medium">{t("card:attendance_sign_btn")}</span>
                    </div>
                  )}
                </div>

                {signError && !isDone && (
                  <p className="text-[10px] text-danger text-center max-w-[120px] leading-tight">{signError}</p>
                )}

                {isDone && (
                  <span
                    className="text-[10px] text-success font-medium"
                    style={{
                      animation: "attendance-fade-up 0.4s ease-out 0.5s both",
                    }}
                  >
                    {t("card:attendance_signed")}
                  </span>
                )}
              </div>
            )}
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
        @keyframes attendance-complete-spin {
          from {
            stroke-dashoffset: ${CIRCUMFERENCE * 0.7};
            transform: rotate(0deg);
          }
          to {
            stroke-dashoffset: 0;
            transform: rotate(360deg);
          }
        }
        @keyframes attendance-fill-in {
          from { transform: scale(0); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        @keyframes attendance-check-in {
          from { stroke-dashoffset: 20; }
          to { stroke-dashoffset: 0; }
        }
        @keyframes attendance-fade-up {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
}
