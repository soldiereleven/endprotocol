import { createContext, useContext } from "react";
import { cn } from "@/lib/cn";

export interface GlassSwitchProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
  isSelected?: boolean;
  onValueChange?: (selected: boolean) => void;
  isDisabled?: boolean;
}

const SwitchCtx = createContext<{ isSelected: boolean; disabled: boolean }>({
  isSelected: false,
  disabled: false,
});

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
    <button
      type="button"
      role="switch"
      aria-checked={isSelected}
      disabled={off}
      onClick={() => !off && onValueChange?.(!isSelected)}
      className={cn(
        "group inline-flex items-center gap-2 select-none cursor-pointer",
        "transition-all duration-200",
        "hover:scale-105 active:scale-95",
        "disabled:opacity-50 disabled:pointer-events-none",
        className,
      )}
      {...rest}
    >
      <SwitchCtx.Provider value={{ isSelected, disabled: off }}>{children}</SwitchCtx.Provider>
    </button>
  );
}

function Control({ className, children }: { className?: string; children?: React.ReactNode }) {
  const { isSelected, disabled } = useContext(SwitchCtx);
  return (
    <span
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200",
        isSelected ? "bg-primary" : "bg-default-300",
        disabled && "opacity-50",
        className,
      )}
    >
      {children}
    </span>
  );
}

function Thumb({ className }: { className?: string }) {
  const { isSelected } = useContext(SwitchCtx);
  return (
    <span
      className={cn(
        "block h-5 w-5 rounded-full bg-white transition-transform duration-200",
        isSelected ? "translate-x-[22px]" : "translate-x-0.5",
        className,
      )}
    />
  );
}

GlassSwitch.Control = Control;
GlassSwitch.Thumb = Thumb;

export { GlassSwitch };
