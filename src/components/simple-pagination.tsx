import { Button } from "@heroui/react";
import clsx from "clsx";

interface PaginationProps {
  total: number;
  page: number;
  onChange: (page: number) => void;
  siblingsCount?: number;
  showControls?: boolean;
}

export const SimplePagination: React.FC<PaginationProps> = ({
  total,
  page,
  onChange,
  siblingsCount = 1,
  showControls = true,
}) => {
  // Always render at least a single-page control so UI remains visible
  if (total < 1) return null;

  const getPageNumbers = () => {
    const leftSiblingIndex = Math.max(page - siblingsCount, 1);
    const rightSiblingIndex = Math.min(page + siblingsCount, total);

    const shouldShowLeftDots = leftSiblingIndex > 2;
    const shouldShowRightDots = rightSiblingIndex < total - 1;

    if (!shouldShowLeftDots && shouldShowRightDots) {
      const leftItemCount = 3 + 2 * siblingsCount;
      const leftRange = Array.from({ length: leftItemCount }, (_, i) => i + 1);
      return [...leftRange, "...", total];
    }

    if (shouldShowLeftDots && !shouldShowRightDots) {
      const rightItemCount = 3 + 2 * siblingsCount;
      const rightRange = Array.from(
        { length: rightItemCount },
        (_, i) => total - rightItemCount + i + 1,
      );
      return [1, "...", ...rightRange];
    }

    if (shouldShowLeftDots && shouldShowRightDots) {
      const middleRange = Array.from(
        { length: rightSiblingIndex - leftSiblingIndex + 1 },
        (_, i) => leftSiblingIndex + i,
      );
      return [1, "...", ...middleRange, "...", total];
    }

    return Array.from({ length: total }, (_, i) => i + 1);
  };

  const pageNumbers = getPageNumbers();

  return (
    <div className="flex items-center justify-center gap-2">
      {/* Previous button */}
      {showControls && (
        <Button
          size="sm"
          variant="outline"
          isDisabled={page === 1}
          onPress={() => onChange(Math.max(1, page - 1))}
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </Button>
      )}

      {/* Page numbers */}
      <div className="flex items-center gap-1">
        {pageNumbers.map((pageNum, index) => {
          if (pageNum === "...") {
            return (
              <span key={`dots-${index}`} className="px-2 py-1 text-muted">
                ...
              </span>
            );
          }

          const pageNumber = pageNum as number;
          return (
            <Button
              key={pageNumber}
              size="sm"
              variant={page === pageNumber ? "primary" : "outline"}
              onPress={() => onChange(pageNumber)}
              className={clsx(
                "min-w-[2.5rem]",
                page === pageNumber && "font-semibold",
              )}
            >
              {pageNumber}
            </Button>
          );
        })}
      </div>

      {/* Next button */}
      {showControls && (
        <Button
          size="sm"
          variant="outline"
          isDisabled={page === total}
          onPress={() => onChange(Math.min(total, page + 1))}
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </Button>
      )}
    </div>
  );
};
