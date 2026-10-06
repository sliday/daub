import { forwardRef, type ComponentProps } from "react";
import { cn } from "../utils/cn";

export interface PaginationProps extends Omit<ComponentProps<"nav">, "children" | "onChange"> {
  current: number;
  total: number;
  perPage?: number;
  onChange?: (page: number) => void;
  disabled?: boolean;
}

function getPages(current: number, totalPages: number): (number | "ellipsis")[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const pages: (number | "ellipsis")[] = [1];
  if (current > 3) pages.push("ellipsis");
  const start = Math.max(2, current - 1);
  const end = Math.min(totalPages - 1, current + 1);
  for (let i = start; i <= end; i++) pages.push(i);
  if (current < totalPages - 2) pages.push("ellipsis");
  pages.push(totalPages);
  return pages;
}

export const Pagination = forwardRef<HTMLElement, PaginationProps>(
  ({ current, total, perPage = 10, onChange, disabled, className, ...props }, ref) => {
    const pageSize = Number.isFinite(perPage) && perPage > 0 ? perPage : 10;
    const totalPages = Math.max(1, Math.ceil((Number.isFinite(total) ? Math.max(0, total) : 0) / pageSize));
    const selected = Math.min(totalPages, Math.max(1, Number.isFinite(current) ? Math.trunc(current) : 1));
    const pages = getPages(selected, totalPages);

    return (
      <nav
        ref={ref}
        aria-label="Pagination"
        {...props}
        data-db-react=""
        className={cn("db-pagination", className)}
      >
        <button
          type="button"
          className="db-pagination__btn db-pagination__prev"
          disabled={disabled || selected <= 1}
          onClick={() => onChange?.(selected - 1)}
          aria-label="Previous page"
        >
          Prev
        </button>
        {pages.map((page, i) =>
          page === "ellipsis" ? (
            <span key={`e${i}`} className="db-pagination__ellipsis">
              &hellip;
            </span>
          ) : (
            <button
              type="button"
              disabled={disabled}
              key={page}
              className={cn(
                "db-pagination__btn",
                "db-pagination__page",
                page === selected && "db-pagination__page--active",
              )}
              aria-current={page === selected ? "page" : undefined}
              aria-label={`Page ${page}`}
              onClick={() => onChange?.(page)}
            >
              {page}
            </button>
          ),
        )}
        <button
          type="button"
          className="db-pagination__btn db-pagination__next"
          disabled={disabled || selected >= totalPages}
          onClick={() => onChange?.(selected + 1)}
          aria-label="Next page"
        >
          Next
        </button>
      </nav>
    );
  },
);

Pagination.displayName = "Pagination";
