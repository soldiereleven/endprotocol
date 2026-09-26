import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";

export interface GlassSwitchProps extends Omit<
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>,
  "onCheckedChange"
> {
  isSelected?: boolean;
  onValueChange?: (selected: boolean) => void;
  isDisabled?: boolean;
}

function GlassSwitch({
  isSelected = false,
  onValueChange,
  isDisabled = false,
  disabled,
  className,
  children,
  ...rest
}: GlassSwitchProps) {
  const off = disabled || isDisabled;
  return (
    <SwitchPrimitive.Root
      checked={isSelected}
      onCheckedChange={onValueChange}
      disabled={off}
      className={cn(
        "group inline-flex items-center gap-2 select-none cursor-pointer",
        "transition-transform duration-200 hover:scale-105 active:scale-95",
        "disabled:opacity-50 disabled:pointer-events-none",
        className,
      )}
      {...rest}
    >
      {children ?? <SwitchPrimitive.Thumb />}
    </SwitchPrimitive.Root>
  );
}

function Control({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full",
        "border border-white/20 bg-default-200/80 shadow-[inset_0_1px_1px_rgba(255,255,255,0.22)]",
        "transition-colors duration-200 group-data-[state=checked]:border-primary/50 group-data-[state=checked]:bg-primary",
        className,
      )}
    >
      {children}
    </span>
  );
}

function Thumb({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "pointer-events-none block h-5 w-5 translate-x-0.5 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.75)] transition-transform duration-200 group-data-[state=checked]:translate-x-[22px]",
        className,
      )}
    />
  );
}

GlassSwitch.Control = Control;
GlassSwitch.Thumb = Thumb;

const SwitchThumb = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Thumb>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Thumb>
>(({ className, ...props }, ref) => (
  <SwitchPrimitive.Thumb
    ref={ref}
    className={cn(
      "pointer-events-none block h-5 w-5 translate-x-0.5 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.75)] transition-transform data-[state=checked]:translate-x-[22px]",
      className,
    )}
    {...props}
  />
));

SwitchThumb.displayName = SwitchPrimitive.Thumb.displayName;

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(({ className, children, ...props }, ref) => (
  <SwitchPrimitive.Root
    ref={ref}
    className={cn(
      "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-white/20 bg-default-200/80 shadow-[inset_0_1px_1px_rgba(255,255,255,0.22)] transition-colors data-[state=checked]:border-primary/50 data-[state=checked]:bg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
  >
    {children ?? <SwitchThumb />}
  </SwitchPrimitive.Root>
));

Switch.displayName = SwitchPrimitive.Root.displayName;

export { Switch, SwitchThumb, GlassSwitch };
