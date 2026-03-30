import { forwardRef, type ComponentProps } from "react";
import { cn } from "../utils/cn";
import type { SurfaceVariant } from "../utils/types";

export interface SurfaceProps extends ComponentProps<"div"> {
  variant?: SurfaceVariant;
}

export const Surface = forwardRef<HTMLDivElement, SurfaceProps>(
  ({ variant, className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "db-surface",
        variant && `db-surface--${variant}`,
        className,
      )}
      {...props}
    />
  ),
);

Surface.displayName = "Surface";
