import { forwardRef, type ComponentProps } from "react";
import { cn } from "../utils/cn";

export interface PaginationProps extends Omit<ComponentProps<"nav">, "children" | "onChange"> {
  current: number;
  total: number;
  perPage?: number;
  onChange?: (page: number) => void;
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
  ({ current, total, perPage = 10, onChange, className, ...props }, ref) => {
    const totalPages = Math.max(1, Math.ceil(total / perPage));
    const pages = getPages(current, totalPages);

    return (
      <nav
        ref={ref}
        aria-label="Pagination"
        {...props}
        className={cn("db-pagination", className)}
      >
        <button
          className="db-pagination__prev"
          disabled={current <= 1}
          onClick={() => onChange?.(current - 1)}
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
              key={page}
              className={cn(
                "db-pagination__page",
                page === current && "db-pagination__page--active",
              )}
              aria-current={page === current ? "page" : undefined}
              onClick={() => onChange?.(page)}
            >
              {page}
            </button>
          ),
        )}
        <button
          className="db-pagination__next"
          disabled={current >= totalPages}
          onClick={() => onChange?.(current + 1)}
          aria-label="Next page"
        >
          Next
        </button>
      </nav>
    );
  },
);

Pagination.displayName = "Pagination";
