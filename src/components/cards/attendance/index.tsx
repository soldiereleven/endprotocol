import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Card, Button, Chip, ProgressCircle } from "@heroui/react";
import { useTranslation } from "react-i18next";
import { BaseCardProps } from "../registry/types";
import { CardConfigService } from "@/utils/cardConfigService";
import type { AttendanceCardSettings } from "@/types/card-settings";
import { AttendanceSettingsModal } from "./attendance-settings-modal";
import { getAccounts, type Account } from "@/utils/accountService";
import { Img } from "@/utils/imageLoader";
import { invoke } from "@tauri-apps/api/core";
import { logDebug, logError } from "@/utils/logger";
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
  const [signingIn, setSigningIn] = useState(false);
  const [signError, setSignError] = useState<string | null>(null);

  const [accountCache, setAccountCache] = useState<Account[]>([]);
  const autoSignAttempted = useRef(false);

  const lang = i18n.language;

  const loadSettings = useCallback(async () => {
    try {
      const s = await CardConfigService.getCardSettings<AttendanceCardSettings>(cardId);
      logDebug(`[Attendance] Loaded settings for card ${cardId}:`, s);
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
      logDebug("[Attendance] GET response:", result);

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

  const handleSignIn = useCallback(async () => {
    if (signingIn || attendanceState === "signed") return;
    const rid = settings.selectedRoleId;
    if (!rid) {
      setShowSettingsModal(true);
      return;
    }

    setSigningIn(true);
    setSignError(null);

    try {
      const result = await invoke<any>("do_attendance", { roleId: rid });
      logDebug("[Attendance] POST response:", result);

      setAttendanceState("signed");
      fetchAttendance();
    } catch (e) {
      logError("[Attendance] POST failed:", e);
      setSignError(String(e));
    } finally {
      setSigningIn(false);
    }
  }, [signingIn, attendanceState, settings.selectedRoleId, fetchAttendance]);

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

  const todayReward = useMemo(() => {
    if (!attendanceData) return null;
    const today = findTodayEntry(attendanceData.calendar);
    if (!today) return null;
    return attendanceData.resourceInfoMap[today.entry.awardId] ?? null;
  }, [attendanceData]);

  const tomorrowReward = useMemo(() => {
    if (!attendanceData) return null;
    const today = findTodayEntry(attendanceData.calendar);
    if (!today) return null;
    const tomorrowEntry = attendanceData.calendar[today.index + 1];
    if (!tomorrowEntry) return null;
    return attendanceData.resourceInfoMap[tomorrowEntry.awardId] ?? null;
  }, [attendanceData]);

  const firstRewards = useMemo(() => {
    if (!attendanceData) return [];
    return attendanceData.first
      .filter((e) => !e.done)
      .map((e) => attendanceData.resourceInfoMap[e.awardId])
      .filter(Boolean);
  }, [attendanceData]);

  const statusChip = useMemo(() => {
    if (attendanceState === "loading") {
      return (
        <Chip size="sm" variant="soft" color="default" className="text-xs">
          <span className="flex items-center gap-1">
            <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            {t("card:attendance_loading")}
          </span>
        </Chip>
      );
    }
    if (attendanceState === "signed") {
      return (
        <Chip size="sm" variant="soft" color="success" className="text-xs">
          <span className="flex items-center gap-1">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
            </svg>
            {t("card:attendance_signed")}
          </span>
        </Chip>
      );
    }
    return (
      <Chip size="sm" variant="soft" color="warning" className="text-xs">
        <span className="flex items-center gap-1">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
          </svg>
          {t("card:attendance_not_signed")}
        </span>
      </Chip>
    );
  }, [attendanceState, t]);

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

  const cardClickableProps = isEditMode ? {} : {
    onClick: () => setShowSettingsModal(true),
  };

  return (
    <>
      <Card
        className="p-0 bg-content1 shadow-sm border border-separator h-full w-full select-none rounded-[10px] overflow-hidden flex flex-col"
      >
        <div
          className="flex flex-col h-full p-3 cursor-pointer"
          {...cardClickableProps}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <span className="text-lg">📅</span>
              <span className="text-sm font-semibold">{t("card:attendance_title")}</span>
            </div>
            {statusChip}
          </div>

          {selectedAccount && (
            <div className="flex items-center gap-1.5 mb-2">
              <div className="w-5 h-5 rounded-full overflow-hidden bg-default-200 shrink-0">
                {selectedAccount.avatar ? (
                  <Img
                    src={selectedAccount.avatar}
                    alt={selectedAccount.nickname}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[8px] text-muted font-semibold">
                    {selectedAccount.nickname.charAt(0)}
                  </div>
                )}
              </div>
              <span className="text-xs text-muted truncate">
                {selectedAccount.nickname}
                <span className="ml-1 opacity-60">
                  ({resolveServerLabel(selectedAccount.server, lang)})
                </span>
              </span>
            </div>
          )}

          {!settings.selectedRoleId ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-2">
              <svg className="w-10 h-10 text-muted opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
              </svg>
              <p className="text-xs text-muted text-center">
                {t("card:attendance_no_account")}
              </p>
              <Button
                size="sm"
                variant="secondary"
                onPress={() => setShowSettingsModal(true)}
              >
                {t("card:attendance_select_account")}
              </Button>
            </div>
          ) : attendanceState === "error" ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-2">
              <svg className="w-8 h-8 text-danger opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <p className="text-xs text-danger text-center">{signError}</p>
              <Button
                size="sm"
                variant="secondary"
                onPress={fetchAttendance}
              >
                {t("card:attendance_refresh")}
              </Button>
            </div>
          ) : attendanceState === "loading" ? (
            <div className="flex-1 flex items-center justify-center">
              <ProgressCircle isIndeterminate size="sm" aria-label="Loading">
                <ProgressCircle.Track>
                  <ProgressCircle.TrackCircle />
                  <ProgressCircle.FillCircle />
                </ProgressCircle.Track>
              </ProgressCircle>
            </div>
          ) : (
            <div className="flex-1 flex flex-col gap-2">
              <div className="flex gap-2">
                <div className="flex-1 bg-default-50 rounded-lg border border-separator p-2">
                  <p className="text-[10px] text-muted mb-1">{t("card:attendance_today")}</p>
                  {todayReward ? (
                    <div className="flex items-center gap-1.5">
                      <Img
                        src={todayReward.icon}
                        alt={todayReward.name}
                        className="w-7 h-7 object-contain rounded"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate">{todayReward.name}</p>
                        <p className="text-[10px] text-muted">x{todayReward.count}</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted">—</p>
                  )}
                </div>

                <div className="flex-1 bg-default-50 rounded-lg border border-separator p-2">
                  <p className="text-[10px] text-muted mb-1">{t("card:attendance_tomorrow")}</p>
                  {tomorrowReward ? (
                    <div className="flex items-center gap-1.5">
                      <Img
                        src={tomorrowReward.icon}
                        alt={tomorrowReward.name}
                        className="w-7 h-7 object-contain rounded"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate">{tomorrowReward.name}</p>
                        <p className="text-[10px] text-muted">x{tomorrowReward.count}</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted opacity-60">{t("card:attendance_no_tomorrow")}</p>
                  )}
                </div>
              </div>

              {firstRewards.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {firstRewards.map((r) => (
                    <Chip
                      key={r.id}
                      size="sm"
                      variant="soft"
                      color="accent"
                      className="text-[10px]"
                    >
                      <span className="flex items-center gap-1">
                        <Img
                          src={r.icon}
                          alt=""
                          className="w-3 h-3 object-contain"
                        />
                        {r.name} x{r.count}
                      </span>
                    </Chip>
                  ))}
                </div>
              )}

              {signError && attendanceState === "unsigned" && (
                <p className="text-[10px] text-danger text-center">{signError}</p>
              )}

              <div className="flex gap-2 mt-auto">
                {attendanceState === "unsigned" && (
                  <Button
                    size="sm"
                    variant="primary"
                    className="flex-1 min-w-0 text-xs"
                    isDisabled={signingIn}
                    onPress={() => {
                      if (signingIn) return;
                      handleSignIn();
                    }}
                  >
                    {signingIn ? (
                      <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    ) : t("card:attendance_sign_btn")}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="secondary"
                  className="flex-shrink-0"
                  onPress={() => setShowSettingsModal(true)}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>

      <AttendanceSettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        selectedRoleId={settings.selectedRoleId}
        autoSign={settings.autoSign ?? false}
        onSave={handleSaveSettings}
      />
    </>
  );
}
