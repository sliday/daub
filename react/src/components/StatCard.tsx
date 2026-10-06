import { forwardRef, type ComponentProps, type ReactNode } from "react";
import { cn } from "../utils/cn";

export interface StatCardProps extends ComponentProps<"div"> {
  label: string;
  value: string | number;
  trend?: "up" | "down";
  trendValue?: string;
  icon?: ReactNode;
  horizontal?: boolean;
}

export const StatCard = forwardRef<HTMLDivElement, StatCardProps>(
  (
    { label, value, trend, trendValue, icon, horizontal, className, ...props },
    ref,
  ) => (
    <div
      ref={ref}
      data-db-react=""
      className={cn(
        "db-stat",
        horizontal && "db-stat--horizontal",
        className,
      )}
      {...props}
    >
      {icon && <div className="db-stat__icon">{icon}</div>}
      <div className="db-stat__label">{label}</div>
      <div className="db-stat__value">{value}</div>
      {trend && (
        <div className={cn("db-stat__change", `db-stat__change--${trend}`)}>
          {trendValue}
        </div>
      )}
    </div>
  ),
);

StatCard.displayName = "StatCard";
