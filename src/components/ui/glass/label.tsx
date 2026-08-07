import { cn } from "@/lib/cn";

export interface GlassLabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {}

export function GlassLabel({ className, children, ...rest }: GlassLabelProps) {
  return (
    <label className={cn("text-sm font-medium text-foreground", className)} {...rest}>
      {children}
    </label>
  );
}
