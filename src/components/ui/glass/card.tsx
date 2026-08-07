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
