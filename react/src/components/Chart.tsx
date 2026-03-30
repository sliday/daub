import { forwardRef, type ComponentProps } from "react";
import { cn } from "../utils/cn";

export interface ChartBar {
  value: number;
  label?: string;
}

export interface ChartProps extends Omit<ComponentProps<"div">, "children"> {
  bars: ChartBar[];
  secondary?: boolean;
}

export const Chart = forwardRef<HTMLDivElement, ChartProps>(
  ({ bars, secondary, className, ...props }, ref) => (
    <div
      ref={ref}
      {...props}
      className={cn(
        "db-chart",
        secondary && "db-chart--secondary",
        className,
      )}
    >
      {bars.map((bar, i) => (
        <div
          key={i}
          className="db-chart__bar"
          style={{ height: `${bar.value}%` }}
        >
          {bar.label && <span className="db-chart__label">{bar.label}</span>}
        </div>
      ))}
    </div>
  ),
);

Chart.displayName = "Chart";
