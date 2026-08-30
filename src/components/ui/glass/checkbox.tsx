import { cn } from "@/lib/cn";

export interface GlassCheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "checked" | "onChange"> {
  isSelected?: boolean;
  onValueChange?: (selected: boolean) => void;
  onChange?: () => void;
}

export function GlassCheckbox({
  isSelected = false,
  onValueChange,
  onChange,
  children,
  className,
  ...rest
}: GlassCheckboxProps) {
  return (
    <label className={cn("inline-flex cursor-pointer select-none items-center gap-2", className)}>
      <input
        type="checkbox"
        className="sr-only"
        checked={isSelected}
        onChange={() => {
          onChange?.();
          onValueChange?.(!isSelected);
        }}
        {...rest}
      />
      <span
        aria-hidden
        className={cn(
          "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md border transition-all duration-200",
          "hover:scale-110 active:scale-90",
          isSelected ? "border-primary bg-primary text-white" : "border-default-400 bg-transparent",
        )}
      >
        {isSelected && (
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
            <path
              d="M2.5 6.2 5 8.7l4.5-5.4"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>
      {children}
    </label>
  );
}
