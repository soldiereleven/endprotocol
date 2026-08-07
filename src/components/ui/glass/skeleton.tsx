import { cn } from "@/lib/cn";

export interface GlassSkeletonProps extends React.HTMLAttributes<HTMLDivElement> {}

export function GlassSkeleton({ className, ...rest }: GlassSkeletonProps) {
  const hasBg = className?.includes("bg-") ?? false;
  return (
    <div
      aria-hidden
      className={cn(
        "animate-pulse rounded-lg",
        !hasBg && "bg-default-100",
        className,
      )}
      {...rest}
    />
  );
}
