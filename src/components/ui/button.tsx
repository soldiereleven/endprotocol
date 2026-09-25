import { forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
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
  onPress?: React.MouseEventHandler<HTMLButtonElement>;
  startContent?: React.ReactNode;
  endContent?: React.ReactNode;
}

const buttonVariants = cva(
  "inline-flex items-center justify-center font-medium select-none whitespace-nowrap transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:opacity-50 disabled:pointer-events-none hover:scale-105 active:scale-95",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground hover:bg-primary/90",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        tertiary: "bg-transparent text-foreground/85 hover:text-foreground",
        outline: "border border-border bg-transparent hover:bg-foreground/5",
        ghost: "bg-transparent hover:bg-foreground/5",
        danger: "bg-danger text-danger-foreground hover:bg-danger/90",
      },
      size: {
        sm: "h-8 px-3 text-xs gap-1.5 rounded-xl",
        md: "h-9 px-4 text-sm gap-2 rounded-xl",
        lg: "h-10 px-5 text-sm gap-2 rounded-xl",
      },
      isIconOnly: {
        true: "px-0",
        false: "",
      },
      fullWidth: {
        true: "w-full",
        false: "",
      },
    },
    defaultVariants: {
      variant: "secondary",
      size: "md",
    },
  }
);

const iconOnlySize: Record<GlassButtonSize, string> = {
  sm: "w-8 h-8",
  md: "w-9 h-9",
  lg: "w-10 h-10",
};

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = "secondary",
      size = "md",
      className,
      type = "button",
      disabled,
      children,
      ...rest
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled}
        className={cn(buttonVariants({ variant, size, className }))}
        {...rest}
      >
        {children}
      </button>
    );
  },
);

Button.displayName = "Button";

export { Button, buttonVariants };

const GlassButton = forwardRef<HTMLButtonElement, GlassButtonProps>(
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
          buttonVariants({ variant, size, className }),
          isIconOnly && cn(iconOnlySize[size], "shrink-0 px-0"),
          fullWidth && "w-full",
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

export { GlassButton };
