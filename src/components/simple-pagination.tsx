import { cn } from "@/lib/cn";

interface SimplePaginationProps {
  total: number;
  page: number;
  onChange: (page: number) => void;
  siblingsCount?: number;
  showControls?: boolean;
}

/**
 * 统一的分页组件（液态玻璃风格）
 */
export const SimplePagination: React.FC<SimplePaginationProps> = ({
  total,
  page,
  onChange,
  //siblingsCount = 1,
  showControls = true,
}) => {
  if (total < 1) return null;

  const pages: Array<number | "ellipsis-start" | "ellipsis-end"> = [];
  const last = total;
  const first = 1;

  const range = (start: number, end: number) => {
    for (let i = start; i <= end; i++) pages.push(i);
  };

  if (total <= 7) {
    range(1, total);
  } else {
    if (page <= 3) {
      range(1, 4);
      pages.push("ellipsis-start");
      pages.push(last);
    } else if (page >= total - 2) {
      pages.push(first);
      pages.push("ellipsis-end");
      range(total - 3, total);
    } else {
      pages.push(first);
      pages.push("ellipsis-start");
      range(page - 1, page + 1);
      pages.push("ellipsis-end");
      pages.push(last);
    }
  }

  const itemClass = (active: boolean) =>
    cn(
      "glass-surface flex h-8 min-w-8 items-center justify-center rounded-xl border px-2 text-xs transition-all duration-200",
      "cursor-pointer select-none hover:border-primary/50 hover:text-primary",
      active
        ? "border-primary bg-primary/15 text-primary font-semibold"
        : "border-separator/70 text-foreground",
    );

  return (
    <nav className="inline-flex items-center gap-1.5" aria-label="Pagination">
      {showControls && (
        <button
          type="button"
          className={cn(itemClass(false), "px-2.5", page === 1 && "pointer-events-none opacity-40")}
          onClick={() => onChange(Math.max(1, page - 1))}
          aria-label="Previous page"
          disabled={page === 1}
        >
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7.5 2.5 4 6l3.5 3.5" />
          </svg>
        </button>
      )}
      {pages.map((p, idx) => {
        if (p === "ellipsis-start" || p === "ellipsis-end") {
          return (
            <span key={`${p}-${idx}`} className="flex h-8 w-6 items-center justify-center text-muted">
              …
            </span>
          );
        }
        return (
          <button
            key={p}
            type="button"
            className={itemClass(p === page)}
            onClick={() => onChange(p)}
            aria-current={p === page ? "page" : undefined}
          >
            {p}
          </button>
        );
      })}
      <div className="mx-1 flex items-center gap-1">
        <input
          type="number"
          min={1}
          max={last}
          placeholder="…"
          aria-label="Jump to page"
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            const v = parseInt(e.currentTarget.value, 10);
            if (!Number.isNaN(v) && v >= 1 && v <= last) {
              onChange(v);
            }
            e.currentTarget.value = "";
          }}
          className="glass-field h-8 w-14 rounded-xl border border-separator/70 px-1.5 text-center text-xs text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      </div>
      {showControls && (
        <button
          type="button"
          className={cn(itemClass(false), "px-2.5", page === last && "pointer-events-none opacity-40")}
          onClick={() => onChange(Math.min(last, page + 1))}
          aria-label="Next page"
          disabled={page === last}
        >
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4.5 2.5 8 6l-3.5 3.5" />
          </svg>
        </button>
      )}
    </nav>
  );
};
