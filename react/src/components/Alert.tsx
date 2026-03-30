import { forwardRef, type ComponentProps } from "react";
import { cn } from "../utils/cn";
import type { AlertVariant } from "../utils/types";

export interface AlertProps extends ComponentProps<"div"> {
  variant?: AlertVariant;
  title?: string;
}

export const Alert = forwardRef<HTMLDivElement, AlertProps>(
  ({ variant, title, className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("db-alert", variant && `db-alert--${variant}`, className)}
      {...props}
    >
      <div className="db-alert__content">
        {title && <div className="db-alert__title">{title}</div>}
        {children}
      </div>
    </div>
  ),
);

Alert.displayName = "Alert";
