import { forwardRef, type ComponentProps } from "react";
import { cn } from "../utils/cn";

export interface ProgressProps extends ComponentProps<"div"> {
  value?: number;
  indeterminate?: boolean;
}

export const Progress = forwardRef<HTMLDivElement, ProgressProps>(
  ({ value = 0, indeterminate, className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "db-progress",
        indeterminate && "db-progress--indeterminate",
        className,
      )}
      {...props}
    >
      <div
        className="db-progress__bar"
        style={indeterminate ? undefined : { width: `${value}%` }}
      />
    </div>
  ),
);

Progress.displayName = "Progress";
