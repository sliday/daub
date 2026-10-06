import { forwardRef, type ComponentProps } from "react";
import { cn } from "../utils/cn";

export interface MarkerProps extends ComponentProps<"div"> {
  variant?: "default" | "border" | "separator";
  busy?: boolean;
}

export const Marker = forwardRef<HTMLDivElement, MarkerProps>(
  ({ variant = "default", busy = false, className, ...props }, ref) => (
    <div role={busy ? "status" : undefined} aria-busy={busy || undefined} {...props}
      ref={ref} data-db-react="" className={cn("db-marker", variant !== "default" && `db-marker--${variant}`, className)} />
  ),
);
Marker.displayName = "Marker";

export const MarkerIcon = forwardRef<HTMLSpanElement, ComponentProps<"span">>(
  ({ className, ...props }, ref) => <span {...props} ref={ref} data-db-react="" aria-hidden="true" className={cn("db-marker__icon", className)} />,
);
MarkerIcon.displayName = "MarkerIcon";

export const MarkerContent = forwardRef<HTMLDivElement, ComponentProps<"div">>(
  ({ className, ...props }, ref) => <div {...props} ref={ref} data-db-react="" className={cn("db-marker__content", className)} />,
);
MarkerContent.displayName = "MarkerContent";
