import { forwardRef, type ComponentProps, type CSSProperties } from "react";
import { cn } from "../utils/cn";

export interface MeterProps extends Omit<ComponentProps<"div">, "children"> {
  value?: number;
  min?: number;
  max?: number;
  status?: "success" | "warning" | "error";
}

export const Meter = forwardRef<HTMLDivElement, MeterProps>(
  ({ value = 0, min = 0, max = 100, status = "success", className, style, ...props }, ref) => {
    const range = max - min || 1;
    const pct = Math.min(100, Math.max(0, ((value - min) / range) * 100));

    return (
      <div
        ref={ref}
        className={cn(
          "db-meter",
          status !== "success" && `db-meter--${status}`,
          className,
        )}
        role="meter"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        style={{ "--db-meter": `${pct}%`, ...style } as CSSProperties}
        {...props}
      >
        <div className="db-meter__bar" />
      </div>
    );
  },
);

Meter.displayName = "Meter";
