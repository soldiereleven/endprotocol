import { cn } from "@/lib/cn";

export type GlassChipTone = "default" | "primary" | "success" | "warning" | "danger" | "accent";

export interface GlassChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "soft" | "solid" | "outline";
  size?: "sm" | "md" | "lg";
  color?: GlassChipTone;
}

const softTone: Record<GlassChipTone, string> = {
  default: "bg-default-100 text-default-700",
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning-dark",
  danger: "bg-danger/10 text-danger",
  accent: "bg-accent/10 text-accent",
};

const solidTone: Record<GlassChipTone, string> = {
  default: "bg-default-500 text-white",
  primary: "bg-primary text-white",
  success: "bg-success text-success-foreground",
  warning: "bg-warning text-warning-foreground",
  danger: "bg-danger text-white",
  accent: "bg-accent text-white",
};

const outlineTone: Record<GlassChipTone, string> = {
  default: "border border-separator text-foreground",
  primary: "border border-primary/50 text-primary",
  success: "border border-success/50 text-success",
  warning: "border border-warning/50 text-warning-dark",
  danger: "border border-danger/50 text-danger",
  accent: "border border-accent/50 text-accent",
};

export function GlassChip({
  variant = "soft",
  size = "md",
  color = "default",
  className,
  children,
  ...rest
}: GlassChipProps) {
  const tone = variant === "solid" ? solidTone[color] : variant === "outline" ? outlineTone[color] : softTone[color];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap font-medium",
        size === "sm" ? "h-5 px-2 text-[11px]" : size === "lg" ? "h-8 px-3.5 text-sm" : "h-6 px-2.5 text-xs",
        "rounded-full",
        tone,
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  );
}
