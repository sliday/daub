import { forwardRef, type ComponentProps } from "react";
import { cn } from "../utils/cn";

export interface ToolbarProps extends ComponentProps<"div"> {
  vertical?: boolean;
}

export const Toolbar = forwardRef<HTMLDivElement, ToolbarProps>(
  ({ vertical, className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("db-toolbar", vertical && "db-toolbar--vertical", className)}
      role="toolbar"
      {...props}
    />
  ),
);

Toolbar.displayName = "Toolbar";
