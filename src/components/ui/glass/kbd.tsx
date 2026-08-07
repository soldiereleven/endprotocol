import { cn } from "@/lib/cn";

export interface GlassKbdProps extends React.HTMLAttributes<HTMLElement> {}

const KEY_SYMBOLS: Record<string, string> = {
  command: "⌘",
  control: "⌃",
  option: "⌥",
  shift: "⇧",
  enter: "↵",
  backspace: "⌫",
  space: "␣",
  up: "↑",
  down: "↓",
  left: "←",
  right: "→",
};

function GlassKbd({ className, children, ...rest }: GlassKbdProps) {
  return (
    <kbd
      className={cn(
        "inline-flex items-center gap-0.5 rounded-md border border-separator bg-default-50/80 px-1.5 py-0.5",
        "font-sans text-[10px] font-medium text-muted",
        className,
      )}
      {...rest}
    >
      {children}
    </kbd>
  );
}

function Abbr({ keyValue, className }: { keyValue: string; className?: string }) {
  return (
    <abbr
      title={keyValue}
      className={cn("no-underline", className)}
    >
      {KEY_SYMBOLS[keyValue] ?? keyValue}
    </abbr>
  );
}

function Content({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <span className={className}>{children}</span>;
}

GlassKbd.Abbr = Abbr;
GlassKbd.Content = Content;

export { GlassKbd };
