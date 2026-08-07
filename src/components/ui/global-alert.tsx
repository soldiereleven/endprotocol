import { GlassAlert } from "@/components/ui/glass";
import { useEffect, useState } from "react";

type GlobalAlertTone = "success" | "danger" | "warning" | "default";

interface GlobalAlertState {
  id: number;
  tone: GlobalAlertTone;
  message: string;
  duration?: number;
}

let counter = 0;
const listeners = new Set<(a: GlobalAlertState) => void>();

/** 全局 Alert 触发器(可在任意位置调用) */
export function pushGlobalAlert(
  tone: GlobalAlertTone,
  message: string,
  duration = 3000,
) {
  const alert: GlobalAlertState = {
    id: ++counter,
    tone,
    message,
    duration,
  };
  listeners.forEach((fn) => fn(alert));
}

/** 全局 Alert 容器 - 挂载在根布局 */
export function GlobalAlertHost() {
  const [current, setCurrent] = useState<GlobalAlertState | null>(null);

  useEffect(() => {
    const handler = (alert: GlobalAlertState) => {
      setCurrent(alert);
      window.setTimeout(() => {
        setCurrent((prev) => (prev?.id === alert.id ? null : prev));
      }, alert.duration ?? 3000);
    };
    listeners.add(handler);
    return () => {
      listeners.delete(handler);
    };
  }, []);

  if (!current) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-slide-down">
      <GlassAlert
        status={current.tone}
        className="shadow-lg min-w-[300px] max-w-[500px]"
      >
        <GlassAlert.Indicator />
        <GlassAlert.Content>
          <GlassAlert.Description>{current.message}</GlassAlert.Description>
        </GlassAlert.Content>
      </GlassAlert>
    </div>
  );
}
