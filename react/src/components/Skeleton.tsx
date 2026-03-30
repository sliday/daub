import { forwardRef, type ComponentProps } from "react";
import { cn } from "../utils/cn";
import type { SkeletonVariant } from "../utils/types";

export interface SkeletonProps extends ComponentProps<"div"> {
  variant?: SkeletonVariant;
  lines?: number;
}

export const Skeleton = forwardRef<HTMLDivElement, SkeletonProps>(
  ({ variant, lines = 1, className, ...props }, ref) => {
    const classes = cn(
      "db-skeleton",
      variant && `db-skeleton--${variant}`,
      className,
    );

    if (lines > 1) {
      return (
        <div ref={ref} {...props}>
          {Array.from({ length: lines }, (_, i) => (
            <div key={i} className={classes} />
          ))}
        </div>
      );
    }

    return <div ref={ref} className={classes} {...props} />;
  },
);

Skeleton.displayName = "Skeleton";
