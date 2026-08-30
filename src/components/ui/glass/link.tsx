import { cn } from "@/lib/cn";

export interface GlassLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {}

export function GlassLink({ className, children, ...rest }: GlassLinkProps) {
  return (
    <a
      className={cn(
        "inline-flex items-center text-foreground transition-all duration-200",
        "hover:text-primary hover:-translate-y-0.5",
        "active:translate-y-0",
        className,
      )}
      {...rest}
    >
      {children}
    </a>
  );
}
