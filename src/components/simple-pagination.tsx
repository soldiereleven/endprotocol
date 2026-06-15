import { Pagination } from "@heroui/react";

interface SimplePaginationProps {
  total: number;
  page: number;
  onChange: (page: number) => void;
  siblingsCount?: number;
  showControls?: boolean;
}

/**
 * 统一的分页组件
 * 基于 HeroUI v3 Pagination compound API 构建
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

  return (
    <Pagination size="sm">
      <Pagination.Content>
        {showControls && (
          <Pagination.Item>
            <Pagination.Previous
              isDisabled={page === 1}
              onPress={() => onChange(Math.max(1, page - 1))}
            >
              <Pagination.PreviousIcon />
            </Pagination.Previous>
          </Pagination.Item>
        )}
        {pages.map((p, idx) => {
          if (p === "ellipsis-start" || p === "ellipsis-end") {
            return (
              <Pagination.Item key={`${p}-${idx}`}>
                <Pagination.Ellipsis />
              </Pagination.Item>
            );
          }
          return (
            <Pagination.Item key={p}>
              <Pagination.Link
                isActive={p === page}
                onPress={() => onChange(p)}
              >
                {p}
              </Pagination.Link>
            </Pagination.Item>
          );
        })}
        {showControls && (
          <Pagination.Item>
            <Pagination.Next
              isDisabled={page === last}
              onPress={() => onChange(Math.min(last, page + 1))}
            >
              <Pagination.NextIcon />
            </Pagination.Next>
          </Pagination.Item>
        )}
      </Pagination.Content>
    </Pagination>
  );
};
