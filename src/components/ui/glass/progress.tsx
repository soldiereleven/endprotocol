import { createContext, useContext } from "react";
import { cn } from "@/lib/cn";

/* ======================================================
 * GlassProgressCircle — 环形加载
 * 用法（对齐 HeroUI compound）：
 * <GlassProgressCircle isIndeterminate size="lg" aria-label="Loading">
 *   <GlassProgressCircle.Track>
 *     <GlassProgressCircle.TrackCircle />
 *     <GlassProgressCircle.FillCircle />
 *   </GlassProgressCircle.Track>
 * </GlassProgressCircle>
 * ====================================================== */

interface ProgressCtxValue {
  size: number;
  strokeWidth: number;
  value: number;
  isIndeterminate: boolean;
}

const ProgressCtx = createContext<ProgressCtxValue>({
  size: 32,
  strokeWidth: 3,
  value: 0,
  isIndeterminate: false,
});

function GlassProgressCircle({
  isIndeterminate = false,
  size = "md",
  value = 0,
  "aria-label": ariaLabel,
  className,
  children,
}: {
  isIndeterminate?: boolean;
  size?: "sm" | "md" | "lg" | number;
  value?: number;
  "aria-label"?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  const px = typeof size === "number" ? size : size === "sm" ? 24 : size === "md" ? 32 : 40;
  const sw = Math.max(2, Math.round(px / 10));
  const clamped = Math.max(0, Math.min(100, value));

  return (
    <div
      role="progressbar"
      aria-label={ariaLabel}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={isIndeterminate ? undefined : clamped}
      className={cn(
        "inline-flex items-center justify-center",
        "transition-all duration-200",
        "hover:scale-110",
        className,
      )}
    >
      <ProgressCtx.Provider
        value={{ size: px, strokeWidth: sw, value: clamped, isIndeterminate }}
      >
        <svg width={px} height={px} viewBox={`0 0 ${px} ${px}`} className="-rotate-90">
          {children}
        </svg>
      </ProgressCtx.Provider>
    </div>
  );
}

function Track({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <g className={className}>{children}</g>;
}

function TrackCircle({ className }: { className?: string }) {
  const { size, strokeWidth } = useContext(ProgressCtx);
  const r = (size - strokeWidth) / 2;
  return (
    <circle
      cx={size / 2}
      cy={size / 2}
      r={r}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      className={cn("text-separator", className)}
    />
  );
}

function FillCircle({ className }: { className?: string }) {
  const { size, strokeWidth, value, isIndeterminate } = useContext(ProgressCtx);
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const offset = isIndeterminate ? c * 0.75 : c * (1 - value / 100);
  return (
    <circle
      cx={size / 2}
      cy={size / 2}
      r={r}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeDasharray={c}
      strokeDashoffset={offset}
      className={cn(
        "text-primary",
        isIndeterminate && "animate-spin",
        className,
      )}
      style={{
        transition: "stroke-dashoffset 0.2s ease",
        transformBox: "fill-box",
        transformOrigin: "center",
      }}
    />
  );
}

GlassProgressCircle.Track = Track;
GlassProgressCircle.TrackCircle = TrackCircle;
GlassProgressCircle.FillCircle = FillCircle;

export { GlassProgressCircle };

/* ======================================================
 * GlassMeter — 进度条
 * 用法：
 * <GlassMeter aria-label value className>
 *   <GlassMeter.Output />
 *   <GlassMeter.Track><GlassMeter.Fill /></GlassMeter.Track>
 * </GlassMeter>
 * ====================================================== */

const MeterCtx = createContext<{ value: number }>({ value: 0 });

function GlassMeter({
  value = 0,
  "aria-label": ariaLabel,
  className,
  children,
}: {
  value?: number;
  "aria-label"?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div role="meter" aria-label={ariaLabel} aria-valuemin={0} aria-valuemax={100} aria-valuenow={clamped} className={className}>
      <MeterCtx.Provider value={{ value: clamped }}>{children}</MeterCtx.Provider>
    </div>
  );
}

function MeterOutput({ className }: { className?: string }) {
  const { value } = useContext(MeterCtx);
  return <span className={cn("sr-only", className)}>{Math.round(value)}%</span>;
}

function MeterTrack({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full", className)}>
      {children}
    </div>
  );
}

function MeterFill({ className }: { className?: string }) {
  const { value } = useContext(MeterCtx);
  return (
    <div
      className={cn("h-full rounded-full bg-primary transition-all duration-500", className)}
      style={{ width: `${value}%` }}
    />
  );
}

GlassMeter.Output = MeterOutput;
GlassMeter.Track = MeterTrack;
GlassMeter.Fill = MeterFill;

export { GlassMeter };
