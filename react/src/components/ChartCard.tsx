import { forwardRef, type ComponentProps } from "react";
import { cn } from "../utils/cn";

export interface ChartCardProps extends ComponentProps<"div"> {
  title?: string;
}

export const ChartCard = forwardRef<HTMLDivElement, ChartCardProps>(
  ({ title, className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("db-chart-card", className)}
      {...props}
    >
      {title && (
        <div className="db-chart-card__header">
          <h3>{title}</h3>
        </div>
      )}
      <div className="db-chart-card__body">{children}</div>
    </div>
  ),
);

ChartCard.displayName = "ChartCard";
