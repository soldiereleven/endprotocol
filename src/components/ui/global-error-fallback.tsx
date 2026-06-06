import { Button } from "@heroui/react";
import { EmptyStateUserIcon } from "@/components/ui/empty-state";

/** 应用根 ErrorBoundary 兜底 */
export function GlobalErrorFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="max-w-md text-center space-y-4">
        <EmptyStateUserIcon className="mx-auto w-20 h-20 text-danger" />
        <h1 className="text-2xl font-bold text-foreground">
          Application Error
        </h1>
        <p className="text-sm text-muted">
          The application encountered a critical error and cannot continue.
        </p>
        <Button
          variant="primary"
          onPress={() => window.location.reload()}
        >
          Reload Application
        </Button>
      </div>
    </div>
  );
}
