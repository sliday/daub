import { forwardRef, type ComponentProps } from "react";
import { cn } from "../utils/cn";
import type { AspectRatio as AspectRatioType } from "../utils/types";

export interface AspectRatioProps extends ComponentProps<"div"> {
  ratio?: AspectRatioType;
}

export const AspectRatio = forwardRef<HTMLDivElement, AspectRatioProps>(
  ({ ratio = "16-9", className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("db-aspect", `db-aspect--${ratio}`, className)}
      {...props}
    />
  ),
);

AspectRatio.displayName = "AspectRatio";
