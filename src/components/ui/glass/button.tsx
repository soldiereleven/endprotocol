import { forwardRef } from "react";
import { cn } from "@/lib/cn";
import { GlassSpinner } from "./spinner";

export type GlassButtonVariant = "primary" | "secondary" | "tertiary" | "outline" | "ghost" | "danger";
export type GlassButtonSize = "sm" | "md" | "lg";

export interface GlassButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "size"> {
  variant?: GlassButtonVariant;
  size?: GlassButtonSize;
  isIconOnly?: boolean;
  isDisabled?: boolean;
  isLoading?: boolean;
  fullWidth?: boolean;
  /** HeroUI 兼容别名 */
  onPress?: React.MouseEventHandler<HTMLButtonElement>;
  startContent?: React.ReactNode;
  endContent?: React.ReactNode;
}

const variantClasses: Record<GlassButtonVariant, string> = {
  primary:
    "glass-surface-strong border border-primary/50 text-primary hover:border-primary/90 hover:brightness-110",
  secondary:
    "glass-surface border border-separator/70 text-foreground hover:border-primary/50 hover:text-primary",
  tertiary:
    "glass-surface border border-transparent text-foreground/85 hover:text-foreground hover:brightness-110",
  outline:
    "glass-surface border border-separator/70 text-foreground hover:border-primary/50 hover:text-primary",
  ghost:
    "border border-transparent text-foreground/80 hover:bg-foreground/5 hover:text-foreground",
  danger:
    "glass-surface-strong border border-danger/50 text-danger hover:border-danger/90 hover:brightness-110",
};

const sizeClasses: Record<GlassButtonSize, string> = {
  sm: "h-8 px-3 text-xs gap-1.5 rounded-xl",
  md: "h-9 px-4 text-sm gap-2 rounded-xl",
  lg: "h-10 px-5 text-sm gap-2 rounded-xl",
};

const iconOnlySize: Record<GlassButtonSize, string> = {
  sm: "w-8 h-8",
  md: "w-9 h-9",
  lg: "w-10 h-10",
};

export const GlassButton = forwardRef<HTMLButtonElement, GlassButtonProps>(
  function GlassButton(
    {
      variant = "secondary",
      size = "md",
      isIconOnly = false,
      isDisabled = false,
      isLoading = false,
      fullWidth = false,
      onPress,
      startContent,
      endContent,
      className,
      type = "button",
      disabled,
      children,
      ...rest
    },
    ref,
  ) {
    const pressed = disabled || isDisabled || isLoading;
    return (
      <button
        ref={ref}
        type={type}
        disabled={pressed}
        onClick={(e) => {
          if (!pressed) onPress?.(e);
        }}
        className={cn(
          "inline-flex items-center justify-center font-medium select-none whitespace-nowrap",
          "transition-all duration-200 cursor-pointer",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
          "disabled:opacity-50 disabled:pointer-events-none",
          variantClasses[variant],
          isIconOnly ? cn(iconOnlySize[size], "shrink-0 px-0") : sizeClasses[size],
          fullWidth && "w-full",
          className,
        )}
        {...rest}
      >
        {isLoading && <GlassSpinner size="sm" className="shrink-0" />}
        {startContent}
        {children}
        {endContent}
      </button>
    );
  },
);

GlassButton.displayName = "GlassButton";
