import { createContext, useContext } from "react";
import { cn } from "@/lib/cn";

export type GlassAlertStatus = "default" | "success" | "warning" | "danger";

export interface GlassAlertProps extends React.HTMLAttributes<HTMLDivElement> {
  status?: GlassAlertStatus;
}

const AlertCtx = createContext<{ status: GlassAlertStatus }>({ status: "default" });

const borderTone: Record<GlassAlertStatus, string> = {
  default: "border-separator/80 text-foreground",
  success: "border-success/40 text-foreground",
  warning: "border-warning/40 text-foreground",
  danger: "border-danger/40 text-foreground",
};

const dotTone: Record<GlassAlertStatus, string> = {
  default: "bg-default-400",
  success: "bg-success shadow-glow-success",
  warning: "bg-warning shadow-glow-warning",
  danger: "bg-danger shadow-glow-danger",
};

function GlassAlert({ status = "default", className, children, ...rest }: GlassAlertProps) {
  return (
    <div
      role="alert"
      className={cn(
        "glass-surface flex items-start gap-2.5 rounded-xl border p-3.5",
        borderTone[status],
        className,
      )}
      {...rest}
    >
      <AlertCtx.Provider value={{ status }}>{children}</AlertCtx.Provider>
    </div>
  );
}

function Indicator({ className }: { className?: string }) {
  const { status } = useContext(AlertCtx);
  return <span className={cn("mt-0.5 h-2 w-2 shrink-0 rounded-full", dotTone[status], className)} />;
}

function Content({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <div className={cn("min-w-0 flex-1", className)}>{children}</div>;
}

function Description({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <p className={cn("text-sm", className)}>{children}</p>;
}

GlassAlert.Indicator = Indicator;
GlassAlert.Content = Content;
GlassAlert.Description = Description;

export { GlassAlert };
