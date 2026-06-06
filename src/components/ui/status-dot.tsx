import clsx from "clsx";

export type StatusDotTone = "success" | "danger" | "warning" | "default";

interface StatusDotProps {
  tone: StatusDotTone;
  ping?: boolean;
  className?: string;
}

const TONE_STYLES: Record<
  StatusDotTone,
  { dot: string; ping: string; shadow: string }
> = {
  success: {
    dot: "bg-success",
    ping: "bg-success",
    shadow: "shadow-glow-success",
  },
  danger: {
    dot: "bg-danger",
    ping: "bg-danger",
    shadow: "shadow-glow-danger",
  },
  warning: {
    dot: "bg-warning",
    ping: "bg-warning",
    shadow: "shadow-glow-warning",
  },
  default: {
    dot: "bg-default-400 dark:bg-default-500",
    ping: "",
    shadow: "",
  },
};

/**
 * Small circular status indicator with optional ping animation and glow.
 * Used in account cards to show sync/selection state.
 */
export function StatusDot({ tone, ping = false, className }: StatusDotProps) {
  const styles = TONE_STYLES[tone];
  return (
    <div className={clsx("relative flex-shrink-0", className)}>
      <div
        className={clsx(
          "w-3 h-3 rounded-full",
          styles.dot,
          styles.shadow,
        )}
      />
      {ping && styles.ping && (
        <div
          className={clsx(
            "absolute inset-0 w-3 h-3 rounded-full animate-ping opacity-20",
            styles.ping,
          )}
        />
      )}
    </div>
  );
}
