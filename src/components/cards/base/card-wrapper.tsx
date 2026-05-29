import React, { Suspense } from "react";
import { Card, ProgressCircle } from "@heroui/react";

interface CardWrapperProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

// Error Boundary 组件
class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || <ErrorState />;
    }
    return this.props.children;
  }
}

export function CardWrapper({ children, fallback }: CardWrapperProps) {
  return (
    <ErrorBoundary fallback={fallback}>
      <Suspense fallback={<LoadingSkeleton />}>{children}</Suspense>
    </ErrorBoundary>
  );
}

function LoadingSkeleton() {
  return (
    <Card className="p-6 bg-content1 shadow-sm border border-separator h-full w-full flex items-center justify-center">
      <ProgressCircle isIndeterminate size="md" aria-label="Loading">
        <ProgressCircle.Track>
          <ProgressCircle.TrackCircle />
          <ProgressCircle.FillCircle />
        </ProgressCircle.Track>
      </ProgressCircle>
    </Card>
  );
}

function ErrorState() {
  return (
    <Card className="p-6 bg-content1 shadow-sm border border-separator">
      <p className="text-danger text-center">加载失败</p>
    </Card>
  );
}
