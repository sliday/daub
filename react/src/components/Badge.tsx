import { forwardRef, type ComponentProps } from "react";
import { cn } from "../utils/cn";
import type { BadgeVariant } from "../utils/types";

export interface BadgeProps extends ComponentProps<"span"> {
  variant?: BadgeVariant;
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ variant, className, ...props }, ref) => (
    <span
      ref={ref}
      className={cn("db-badge", variant && `db-badge--${variant}`, className)}
      {...props}
    />
  ),
);

Badge.displayName = "Badge";
