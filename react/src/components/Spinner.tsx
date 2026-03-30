import { forwardRef, type ComponentProps } from "react";
import { cn } from "../utils/cn";

export interface SpinnerProps extends ComponentProps<"span"> {
  size?: "sm" | "lg" | "xl";
}

export const Spinner = forwardRef<HTMLSpanElement, SpinnerProps>(
  ({ size, className, ...props }, ref) => (
    <span
      ref={ref}
      role="status"
      aria-label="Loading"
      className={cn("db-spinner", size && `db-spinner--${size}`, className)}
      {...props}
    />
  ),
);

Spinner.displayName = "Spinner";
