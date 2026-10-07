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
    const lower = Number.isFinite(min) ? min : 0;
    const upper = Math.max(lower, Number.isFinite(max) ? max : 100);
    const bounded = Math.min(upper, Math.max(lower, Number.isNaN(value) ? lower : value));
    const pct = upper === lower ? 0 : ((bounded - lower) / (upper - lower)) * 100;

    return (
      <div
        ref={ref}
        data-db-react=""
        className={cn(
          "db-meter",
          status !== "success" && `db-meter--${status}`,
          className,
        )}
        role="meter"
        aria-valuemin={lower}
        aria-valuemax={upper}
        aria-valuenow={bounded}
        style={{ "--db-meter": `${pct}%`, ...style } as CSSProperties}
        {...props}
      >
        <div className="db-meter__bar" />
      </div>
    );
  },
);

Meter.displayName = "Meter";
