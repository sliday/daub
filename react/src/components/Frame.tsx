import { forwardRef, type ComponentProps, type ReactNode } from "react";
import { cn } from "../utils/cn";

export interface FrameProps extends ComponentProps<"div"> {
  header?: ReactNode;
  footer?: ReactNode;
  flush?: boolean;
}

export const Frame = forwardRef<HTMLDivElement, FrameProps>(
  ({ header, footer, flush, className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("db-frame", flush && "db-frame--flush", className)}
      {...props}
    >
      {header && <div className="db-frame__header">{header}</div>}
      <div className="db-frame__body">{children}</div>
      {footer && <div className="db-frame__footer">{footer}</div>}
    </div>
  ),
);

Frame.displayName = "Frame";
