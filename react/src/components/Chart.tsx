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
  ({ bars, secondary, className, ...props }, ref) => {
    const boundedBars = bars.map(bar => ({ ...bar, value: Math.min(100, Math.max(0, Number.isNaN(bar.value) ? 0 : bar.value)) }));
    const description = boundedBars.map((bar, i) => `${bar.label ?? `Bar ${i + 1}`}: ${bar.value}`).join("; ") || "No data";
    return (
    <>
    <div
      ref={ref}
      data-db-react=""
      role="img"
      aria-label={props["aria-labelledby"] ? undefined : description}
      {...props}
      className={cn(
        "db-chart",
        className,
      )}
    >
      {boundedBars.map((bar, i) => (
        <div
          key={i}
          className={cn("db-chart__bar", secondary && "db-chart__bar--secondary")}
          aria-hidden="true"
          style={{ height: `${bar.value}%` }}
        />
      ))}
    </div>
    {boundedBars.some(bar => bar.label) && (
      <div data-db-react="" className="db-chart__labels" aria-hidden="true">
        {boundedBars.map((bar, i) => <span key={i}>{bar.label}</span>)}
      </div>
    )}
    </>
    );
  },
);

Chart.displayName = "Chart";
