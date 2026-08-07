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
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200",
        "ring-1 ring-inset ring-black/10",
        isSelected ? "bg-primary" : "bg-default-200",
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
        "block h-4 w-4 rounded-full bg-white shadow transition-transform duration-200",
        isSelected ? "translate-x-[18px]" : "translate-x-0.5",
        className,
      )}
    />
  );
}

GlassSwitch.Control = Control;
GlassSwitch.Thumb = Thumb;

export { GlassSwitch };
