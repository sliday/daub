import { forwardRef, type ComponentProps } from "react";
import { cn } from "../utils/cn";
import type { GapToken } from "../utils/types";

export interface GridProps extends ComponentProps<"div"> {
  columns?: 2 | 3 | 4 | 5 | 6;
  gap?: GapToken;
  align?: "center" | "end";
  container?: boolean | "wide" | "narrow";
}

export const Grid = forwardRef<HTMLDivElement, GridProps>(
  ({ columns, gap, align, container, className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "db-grid",
        columns && `db-grid--${columns}`,
        gap != null && `db-gap-${gap}`,
        align && `db-align-${align}`,
        container === true && "db-container",
        container === "wide" && "db-container db-container--wide",
        container === "narrow" && "db-container db-container--narrow",
        className,
      )}
      {...props}
    />
  ),
);

Grid.displayName = "Grid";
