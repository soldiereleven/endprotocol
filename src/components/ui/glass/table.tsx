import { cn } from "@/lib/cn";

export interface GlassTableProps {
  className?: string;
  children?: React.ReactNode;
}

function GlassTable({ className, children }: GlassTableProps) {
  return <div className={cn("w-full overflow-x-auto", className)}>{children}</div>;
}

function ScrollContainer({ className, children }: GlassTableProps) {
  return <div className={cn("overflow-x-auto", className)}>{children}</div>;
}

function TableContent({
  "aria-label": ariaLabel,
  className,
  children,
}: {
  "aria-label"?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <table aria-label={ariaLabel} className={cn("w-full border-collapse text-sm", className)}>
      {children}
    </table>
  );
}

function TableHeader({ className, children }: GlassTableProps) {
  return (
    <thead className={cn("bg-default-50/70 text-left", className)}>
      <tr>{children}</tr>
    </thead>
  );
}

function TableColumn({ isRowHeader, className, children }: { isRowHeader?: boolean; className?: string; children?: React.ReactNode }) {
  return (
    <th
      scope={isRowHeader ? "row" : "col"}
      className={cn("px-4 py-2.5 text-xs font-semibold text-muted", className)}
    >
      {children}
    </th>
  );
}

function TableBody({ className, children }: GlassTableProps) {
  return <tbody className={cn("divide-y divide-separator/60", className)}>{children}</tbody>;
}

function TableRow({ className, children }: GlassTableProps) {
  return <tr className={cn("transition-colors hover:bg-default-50/50", className)}>{children}</tr>;
}

function TableCell({ className, children }: GlassTableProps) {
  return <td className={cn("px-4 py-2.5 text-foreground/90", className)}>{children}</td>;
}

GlassTable.ScrollContainer = ScrollContainer;
GlassTable.Content = TableContent;
GlassTable.Header = TableHeader;
GlassTable.Column = TableColumn;
GlassTable.Body = TableBody;
GlassTable.Row = TableRow;
GlassTable.Cell = TableCell;

export { GlassTable };
