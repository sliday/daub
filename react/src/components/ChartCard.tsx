import { Children, forwardRef, useId, type ComponentProps, type ReactNode } from "react";
import { cn } from "../utils/cn";

export interface ChartCardProps extends ComponentProps<"div"> {
  title?: string;
  emptyState?: ReactNode;
}

export const ChartCard = forwardRef<HTMLDivElement, ChartCardProps>(
  ({ title, emptyState = "No data", className, children, ...props }, ref) => {
    const titleId = useId();
    return (
    <div
      ref={ref}
      data-db-react=""
      role="group"
      aria-labelledby={title && !props["aria-label"] ? titleId : undefined}
      className={cn("db-chart-card", className)}
      {...props}
    >
      {title && (
        <div className="db-chart-card__header">
          <h3 id={titleId} className="db-chart-card__title">{title}</h3>
        </div>
      )}
      <div className="db-chart-card__body">{Children.toArray(children).length ? children : emptyState}</div>
    </div>
    );
  },
);

ChartCard.displayName = "ChartCard";
