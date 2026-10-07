import { forwardRef, type ComponentProps } from "react";
import { cn } from "../utils/cn";

export interface ProgressProps extends ComponentProps<"div"> {
  value?: number;
  indeterminate?: boolean;
}

export const Progress = forwardRef<HTMLDivElement, ProgressProps>(
  ({ value = 0, indeterminate, className, ...props }, ref) => {
    const bounded = Math.min(100, Math.max(0, Number.isNaN(value) ? 0 : value));
    return (
    <div
      ref={ref}
      data-db-react=""
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={indeterminate ? undefined : bounded}
      className={cn(
        "db-progress",
        indeterminate && "db-progress--indeterminate",
        className,
      )}
      {...props}
    >
      <div
        className="db-progress__bar"
        style={indeterminate ? undefined : { width: `${bounded}%` }}
      />
    </div>
    );
  },
);

Progress.displayName = "Progress";
