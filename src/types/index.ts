import type { SVGProps } from "react";

/* ---------- Icon ---------- */
export type IconSvgProps = SVGProps<SVGSVGElement> & {
  size?: number;
};

/* ---------- Account ---------- */
export type AccountServer = "1" | "2" | string; // 1=官服 2=Bilibili
export type AccountSyncStatus =
  | "SYNCING"
  | "FAILED"
  | "HYTOKEN_EXPIRED"
  | null;

export interface AccountLike {
  id: string;
  nickname: string;
  level: number;
  server: AccountServer;
  avatar?: string;
  syncStatus?: AccountSyncStatus;
}

export interface AccountStatusMeta {
  /** 状态色: success / warning / danger / default */
  tone: "success" | "warning" | "danger" | "default";
  /** 状态文案,留空则由调用方提供 i18n key */
  label?: string;
  /** 是否展示 LED 灯指示 */
  showLed?: boolean;
}

/* ---------- Server ---------- */
export const SERVER_LABEL: Record<
  "1" | "2",
  { zh: string; en: string }
> = {
  "1": { zh: "官服", en: "Official" },
  "2": { zh: "Bilibili服", en: "Bilibili" },
};

export function resolveServerLabel(
  server: string,
  lang: string,
): string {
  const key = server as "1" | "2";
  return SERVER_LABEL[key]?.[lang === "zh" ? "zh" : "en"] ?? server;
}
