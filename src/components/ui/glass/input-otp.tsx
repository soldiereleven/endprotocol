import { createContext, useContext, useRef } from "react";
import { cn } from "@/lib/cn";

export interface GlassInputOTPProps {
  value?: string;
  onChange?: (value: string) => void;
  onComplete?: (value: string) => void;
  maxLength?: number;
  isInvalid?: boolean;
  "aria-describedby"?: string;
  className?: string;
  children?: React.ReactNode;
}

const OTPCtx = createContext<{ value: string; isInvalid: boolean }>({ value: "", isInvalid: false });

function GlassInputOTP({
  value = "",
  onChange,
  onComplete,
  maxLength = 6,
  isInvalid = false,
  "aria-describedby": ariaDescribedBy,
  className,
  children,
}: GlassInputOTPProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      className={cn("inline-flex cursor-text items-center gap-2", className)}
      onClick={() => inputRef.current?.focus()}
    >
      <input
        ref={inputRef}
        className="sr-only"
        value={value}
        maxLength={maxLength}
        inputMode="numeric"
        autoComplete="one-time-code"
        aria-describedby={ariaDescribedBy}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^0-9A-Za-z]/g, "").slice(0, maxLength);
          onChange?.(raw);
          if (raw.length === maxLength) onComplete?.(raw);
        }}
      />
      <OTPCtx.Provider value={{ value, isInvalid }}>{children}</OTPCtx.Provider>
    </div>
  );
}

function Group({ className, children }: { className?: string; children?: React.ReactNode }) {
  return <div className={cn("flex gap-2", className)}>{children}</div>;
}

function Slot({ index, className }: { index: number; className?: string }) {
  const { value, isInvalid } = useContext(OTPCtx);
  const ch = value[index] ?? "";
  return (
    <span
      className={cn(
        "glass-field flex h-11 w-9 items-center justify-center rounded-lg",
        "text-base font-semibold text-foreground",
        isInvalid && "border border-danger",
        className,
      )}
    >
      {ch}
    </span>
  );
}

function Separator({ className }: { className?: string }) {
  return <span className={cn("text-muted/70", className)}>—</span>;
}

GlassInputOTP.Group = Group;
GlassInputOTP.Slot = Slot;
GlassInputOTP.Separator = Separator;

export { GlassInputOTP };
