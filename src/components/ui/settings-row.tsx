import clsx from "clsx";

interface SettingsRowProps {
  /** 锚点 id,供站内搜索跳转 */
  id?: string;
  /** 标题 */
  title: React.ReactNode;
  /** 描述 */
  description?: React.ReactNode;
  /** 右侧控件 */
  control: React.ReactNode;
  /** 自定义类名 */
  className?: string;
}

export function SettingsRow({
  id,
  title,
  description,
  control,
  className,
}: SettingsRowProps) {
  return (
    <div
      id={id}
      className={clsx(
        "flex flex-col sm:flex-row sm:items-center justify-between gap-4",
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="font-medium text-foreground">{title}</p>
        {description && (
          <p className="text-sm text-muted mt-0.5">{description}</p>
        )}
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}

/** 设置区域内统一的分隔线 */
export function SettingsDivider() {
  return <div className="h-px bg-separator w-full" role="separator" />;
}
