import { cn } from "@/lib/utils";

export interface GlassLabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {}

function Label({ className, children, ...rest }: GlassLabelProps) {
  return (
    <label className={cn("text-sm font-medium text-foreground", className)} {...rest}>
      {children}
    </label>
  );
}

const GlassLabel = Label;

export { Label, GlassLabel };
