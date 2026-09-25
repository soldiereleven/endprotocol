import { cn } from "@/lib/utils";

export interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  isPressable?: boolean;
  onPress?: () => void;
  shadow?: "none" | "sm" | "md" | "lg";
}

function GlassCard({
  isPressable = false,
  onPress,
  shadow = "none",
  className,
  children,
  ...rest
}: GlassCardProps) {
  if (isPressable) {
    return (
      <button
        type="button"
        onClick={onPress}
        className={cn(
          "glass-surface rounded-xl border border-separator overflow-hidden text-left w-full",
          "transition-all duration-200 cursor-pointer",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
          "hover:scale-[1.02] hover:-translate-y-0.5 active:scale-[0.98] active:translate-y-0",
          "hover:shadow-lg",
          shadow === "sm" && "shadow-sm",
          shadow === "md" && "shadow-md",
          shadow === "lg" && "shadow-lg",
          className,
        )}
        {...(rest as React.HTMLAttributes<HTMLButtonElement>)}
      >
        {children}
      </button>
    );
  }
  return (
    <div
      className={cn(
        "glass-surface rounded-xl border border-separator overflow-hidden",
        "transition-all duration-200",
        "hover:scale-[1.02] hover:-translate-y-0.5",
        "hover:shadow-lg",
        shadow === "sm" && "shadow-sm",
        shadow === "md" && "shadow-md",
        shadow === "lg" && "shadow-lg",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  shadow?: "none" | "sm" | "md" | "lg";
}

function Card({ shadow = "none", className, children, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        "glass-surface rounded-xl border border-separator",
        shadow === "sm" && "shadow-sm",
        shadow === "md" && "shadow-md",
        shadow === "lg" && "shadow-lg",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

function CardHeader({
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex flex-col space-y-1.5 p-6", className)} {...rest}>
      {children}
    </div>
  );
}

function CardTitle({
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn(
        "text-lg font-semibold leading-none tracking-tight",
        className,
      )}
      {...rest}
    >
      {children}
    </h3>
  );
}

function CardDescription({
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("text-sm text-muted", className)} {...rest}>
      {children}
    </p>
  );
}

function CardContent({
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("p-6 pt-0", className)} {...rest}>
      {children}
    </div>
  );
}

function CardFooter({
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex items-center p-6 pt-0", className)} {...rest}>
      {children}
    </div>
  );
}

export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  GlassCard,
};
