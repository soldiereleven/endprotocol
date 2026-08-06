import clsx from "clsx";

interface PageHeaderProps {
  /** 主标题 */
  title: React.ReactNode;
  /** 副标题 / 提示 */
  description?: React.ReactNode;
  /** 右上角操作按钮组 */
  actions?: React.ReactNode;
  /** 标题锚点 id,供站内搜索跳转 */
  id?: string;
  /** 自定义类名 */
  className?: string;
}

export function PageHeader({
  title,
  description,
  actions,
  id,
  className,
}: PageHeaderProps) {
  return (
    <header
      id={id}
      className={clsx(
        "flex flex-col sm:flex-row sm:items-center justify-between gap-4",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="text-2xl lg:text-3xl font-bold text-foreground tracking-tight">
          {title}
        </h1>
        {description && (
          <p className="text-foreground/70 mt-1 text-sm leading-relaxed">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 shrink-0">{actions}</div>
      )}
    </header>
  );
}
