import { cn } from "@/lib/utils";

export interface GlassTooltipProps extends React.HTMLAttributes<HTMLSpanElement> {
  delay?: number;
}

function GlassTooltip({ className, children, ...rest }: GlassTooltipProps) {
  return (
    <span className={cn("group relative inline-flex", className)} {...rest}>
      {children}
    </span>
  );
}

function TooltipContent({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <span
      role="tooltip"
      className={cn(
        "pointer-events-none absolute -top-1.5 left-1/2 z-50 -translate-x-1/2 -translate-y-full",
        "whitespace-nowrap rounded-lg border border-separator/80 bg-surface px-2.5 py-1.5",
        "text-xs text-foreground opacity-0 shadow-xl transition-all duration-200",
        "group-hover:opacity-100 group-hover:-translate-y-1",
        className,
      )}
    >
      {children}
    </span>
  );
}

GlassTooltip.Content = TooltipContent;

interface TooltipProps extends React.HTMLAttributes<HTMLSpanElement> {}

function Tooltip({ className, children, ...rest }: TooltipProps) {
  return (
    <span className={cn("peer/group relative inline-flex", className)} {...rest}>
      {children}
    </span>
  );
}

function TooltipContentAlt({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <span
      role="tooltip"
      className={cn(
        "pointer-events-none absolute -top-1.5 left-1/2 z-50 -translate-x-1/2 -translate-y-full",
        "whitespace-nowrap rounded-lg border border-separator/80 bg-surface px-2.5 py-1.5",
        "text-xs text-foreground opacity-0 shadow-xl transition-all duration-200",
        "group-hover:opacity-100 group-hover:-translate-y-1",
        "peer-focus-within:opacity-100 peer-focus-within:-translate-y-1",
        className,
      )}
    >
      {children}
    </span>
  );
}

Tooltip.Content = TooltipContentAlt;

export { Tooltip, GlassTooltip };
