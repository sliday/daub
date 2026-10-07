import { forwardRef, type ComponentProps } from "react";
import { cn } from "../utils/cn";

export const ButtonGroup = forwardRef<HTMLDivElement, ComponentProps<"div">>(
  ({ className, children, ...props }, ref) => (
    <div ref={ref} className={cn("db-btn-group", className)} role="group" {...props} data-db-react="">
      {children}
    </div>
  ),
);

ButtonGroup.displayName = "ButtonGroup";
