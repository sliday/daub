import { forwardRef, type ComponentProps } from "react";
import { cn } from "../utils/cn";
import type { ContainerSize } from "../utils/types";

export interface ContainerProps extends ComponentProps<"div"> {
  size?: ContainerSize;
}

export const Container = forwardRef<HTMLDivElement, ContainerProps>(
  ({ size, className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "db-container",
        size === "wide" && "db-container--wide",
        size === "narrow" && "db-container--narrow",
        className,
      )}
      {...props}
    />
  ),
);

Container.displayName = "Container";
