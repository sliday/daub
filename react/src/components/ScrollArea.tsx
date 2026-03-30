import { forwardRef, type ComponentProps } from "react";
import { cn } from "../utils/cn";

export interface ScrollAreaProps extends ComponentProps<"div"> {
  horizontal?: boolean;
}

export const ScrollArea = forwardRef<HTMLDivElement, ScrollAreaProps>(
  ({ horizontal, className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "db-scroll-area",
        horizontal && "db-scroll-area--horizontal",
        className,
      )}
      {...props}
    />
  ),
);

ScrollArea.displayName = "ScrollArea";
