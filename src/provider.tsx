import { ToastProvider } from "@heroui/react";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { GlobalErrorFallback } from "@/components/ui/global-error-fallback";
import { GlobalAlertHost } from "@/components/ui/global-alert";
import { ConfirmDialogHost } from "@/components/ui/confirm-dialog";

interface ProviderProps {
  children: React.ReactNode;
}

export function Provider({ children }: ProviderProps) {
  return (
    <ErrorBoundary fallback={<GlobalErrorFallback />}>
      <ToastProvider
        placement="top"
        className="z-[10000]"
      />
      <GlobalAlertHost />
      <ConfirmDialogHost />
      {children}
    </ErrorBoundary>
  );
}
