import { forwardRef, type ComponentProps, type ReactNode } from "react";
import { cn } from "../utils/cn";

export interface EmptyStateProps extends ComponentProps<"div"> {
  title?: string;
  message?: string;
  icon?: ReactNode;
}

export const EmptyState = forwardRef<HTMLDivElement, EmptyStateProps>(
  ({ title, message, icon, className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("db-empty", className)}
      {...props}
    >
      {icon && <div className="db-empty__icon">{icon}</div>}
      {title && <h3>{title}</h3>}
      {message && <p>{message}</p>}
      {children}
    </div>
  ),
);

EmptyState.displayName = "EmptyState";
