import { cn } from "@/lib/cn";

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

function TooltipContent({ className, children }: { className?: string; children?: React.ReactNode }) {
  return (
    <span
      role="tooltip"
      className={cn(
        "pointer-events-none absolute -top-1.5 left-1/2 z-50 -translate-x-1/2 -translate-y-full",
        "whitespace-nowrap rounded-lg glass-surface-strong border border-separator/80 px-2.5 py-1.5",
        "text-xs text-foreground opacity-0 shadow-xl transition-opacity duration-150",
        "group-hover:opacity-100",
        className,
      )}
    >
      {children}
    </span>
  );
}

GlassTooltip.Content = TooltipContent;

export { GlassTooltip };
