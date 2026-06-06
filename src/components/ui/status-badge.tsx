import { Chip } from "@heroui/react";
import clsx from "clsx";
import type { AccountSyncStatus } from "@/types";

export type StatusTone = "success" | "warning" | "danger" | "default";

export interface StatusConfig {
  tone: StatusTone;
  label: string;
  showLed?: boolean;
}

export const SYNC_STATUS_META: Record<
  NonNullable<AccountSyncStatus>,
  StatusConfig
> = {
  HYTOKEN_EXPIRED: { tone: "danger", label: "EXPIRED", showLed: true },
  FAILED: { tone: "warning", label: "SYNC FAILED", showLed: true },
  SYNCING: { tone: "default", label: "SYNCING" },
};

interface StatusBadgeProps {
  config: StatusConfig;
  className?: string;
}

export function StatusBadge({ config, className }: StatusBadgeProps) {
  return (
    <Chip
      size="sm"
      variant="soft"
      color={config.tone}
      className={clsx("font-bold tracking-wider text-[10px] h-5", className)}
    >
      {config.label}
    </Chip>
  );
}
