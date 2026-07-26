import { Card } from "@heroui/react";
import clsx from "clsx";

interface SectionCardProps {
  id?: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  /** 是否显示内部 padding,默认 true */
  padded?: boolean;
  /** 移除内边距(用于内部自定义布局) */
  flush?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function SectionCard({
  id,
  title,
  description,
  actions,
  padded = true,
  flush = false,
  className,
  children,
}: SectionCardProps) {
  return (
    <Card
      id={id}
      className={clsx(
        "bg-content1 border border-separator/80 overflow-hidden transition-all duration-200 hover:shadow-md",
        className,
      )}
    >
      {(title || actions) && (
        <div
          className={clsx(
            "flex items-center justify-between",
            padded && "px-6 pt-6 pb-2",
            flush && "px-0 pt-0",
          )}
        >
          <div>
            {title && (
              <h2 className="text-lg font-semibold">{title}</h2>
            )}
            {description && (
              <p className="text-sm text-muted mt-0.5">{description}</p>
            )}
          </div>
          {actions && (
            <div className="flex items-center gap-2">{actions}</div>
          )}
        </div>
      )}
      <div
        className={clsx(
          padded && !flush && "p-6",
          flush && "p-0",
          !padded && !flush && "p-0",
          title && padded && "pt-2",
        )}
      >
        {children}
      </div>
    </Card>
  );
}
