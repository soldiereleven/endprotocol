import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@heroui/react";
import { EmptyStateUserIcon } from "@/components/ui/empty-state";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

/**
 * 应用级 Error Boundary
 * 任何子组件抛出未捕获错误时显示 fallback
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.props.onError?.(error, info);
  }

  reset = () => this.setState({ hasError: false, error: undefined });

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return <DefaultErrorFallback onReset={this.reset} />;
    }
    return this.props.children;
  }
}

function DefaultErrorFallback({ onReset }: { onReset: () => void }) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-md text-center space-y-4">
        <EmptyStateUserIcon className="mx-auto w-16 h-16 text-danger" />
        <h2 className="text-xl font-semibold text-foreground">
          Something went wrong
        </h2>
        <p className="text-sm text-muted">
          An unexpected error occurred. Please try again.
        </p>
        <Button variant="primary" onPress={onReset}>
          Reload
        </Button>
      </div>
    </div>
  );
}
