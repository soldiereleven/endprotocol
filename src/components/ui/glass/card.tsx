import { cn } from "@/lib/cn";

export interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  isPressable?: boolean;
  onPress?: () => void;
  shadow?: "none" | "sm" | "md" | "lg";
}

export function GlassCard({
  isPressable = false,
  onPress,
  shadow = "none",
  className,
  children,
  ...rest
}: GlassCardProps) {
  if (isPressable) {
    return (
      <button
        type="button"
        onClick={onPress}
        className={cn(
          "glass-surface rounded-xl overflow-hidden text-left w-full",
          "transition-all duration-200 cursor-pointer",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
          "hover:scale-[1.02] hover:-translate-y-0.5 active:scale-[0.98] active:translate-y-0",
          "hover:shadow-lg",
          shadow === "sm" && "shadow-sm",
          shadow === "md" && "shadow-md",
          shadow === "lg" && "shadow-lg",
          className,
        )}
        {...(rest as React.HTMLAttributes<HTMLButtonElement>)}
      >
        {children}
      </button>
    );
  }
  return (
    <div
      className={cn(
        "glass-surface rounded-xl overflow-hidden",
        "transition-all duration-200",
        "hover:scale-[1.02] hover:-translate-y-0.5",
        "hover:shadow-lg",
        shadow === "sm" && "shadow-sm",
        shadow === "md" && "shadow-md",
        shadow === "lg" && "shadow-lg",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
