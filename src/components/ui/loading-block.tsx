import { Card, ProgressCircle, Spinner } from "@heroui/react";
import clsx from "clsx";

interface LoadingBlockProps {
  /** 标题,显示在 spinner 下方 */
  label?: React.ReactNode;
  /** 高度,默认 200 */
  minHeight?: number | string;
  className?: string;
}

/** 居中圆环 Loading */
export function LoadingBlock({
  label,
  minHeight = 200,
  className,
}: LoadingBlockProps) {
  return (
    <div
      className={clsx(
        "flex flex-col items-center justify-center gap-4 py-10",
        className,
      )}
      style={{ minHeight }}
      role="status"
    >
      <ProgressCircle isIndeterminate size="lg" aria-label="Loading">
        <ProgressCircle.Track>
          <ProgressCircle.TrackCircle />
          <ProgressCircle.FillCircle />
        </ProgressCircle.Track>
      </ProgressCircle>
      {label && <p className="text-sm text-muted/70 animate-pulse-soft">{label}</p>}
    </div>
  );
}

/** 小型行内 Loading(用于按钮/小区域) */
export function LoadingInline({ label }: { label?: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2" role="status">
      <Spinner size="sm" color="current" />
      {label && <span>{label}</span>}
    </span>
  );
}

/** 列表骨架(多行) */
interface SkeletonListProps {
  count: number;
  /** 单行高度,默认 80px */
  rowHeight?: number;
  /** 行间距(像素) */
  gap?: number;
  className?: string;
}

export function SkeletonList({
  count,
  rowHeight = 80,
  gap = 5,
  className,
}: SkeletonListProps) {
  return (
    <div
      className={clsx("space-y-3", className)}
      style={{ rowGap: gap }}
      aria-hidden
    >
      {Array.from({ length: count }).map((_, i) => (
        <Card
          key={i}
          className="p-4 glass-surface border border-separator/80"
          style={{ height: rowHeight }}
        >
          <div className="flex items-center gap-4 h-full">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-default-200 to-default-300 animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="w-32 h-4 rounded-lg bg-gradient-to-r from-default-200 to-default-100 animate-pulse" />
              <div className="w-24 h-3 rounded-lg bg-gradient-to-r from-default-200 to-default-100 animate-pulse" />
            </div>
            <div className="flex gap-2">
              <div className="w-20 h-8 rounded-lg bg-gradient-to-r from-default-200 to-default-100 animate-pulse" />
              <div className="w-20 h-8 rounded-lg bg-gradient-to-r from-default-200 to-default-100 animate-pulse" />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
