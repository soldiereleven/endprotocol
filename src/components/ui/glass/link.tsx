import { cn } from "@/lib/cn";

export interface GlassLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {}

export function GlassLink({ className, children, ...rest }: GlassLinkProps) {
  return (
    <a
      className={cn(
        "inline-flex items-center text-foreground transition-colors duration-200 hover:text-primary",
        className,
      )}
      {...rest}
    >
      {children}
    </a>
  );
}
