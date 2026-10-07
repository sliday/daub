import { forwardRef, type ComponentProps, type ReactNode } from "react";
import { cn } from "../utils/cn";

export interface ButtonProps extends ComponentProps<"button"> {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "lg" | "icon";
  loading?: boolean;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant, size, loading, icon, className, disabled, children, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      aria-busy={loading || undefined}
      className={cn(
        "db-btn",
        variant && `db-btn--${variant}`,
        size && `db-btn--${size}`,
        loading && "db-btn--loading",
        className,
      )}
      disabled={disabled || loading}
      {...props}
      data-db-react=""
    >
      {icon && <span aria-hidden="true" style={{ display: "inline-flex", width: "1em", height: "1em", flexShrink: 0 }}>{typeof icon === "string" ? <i data-lucide={icon} aria-hidden="true" style={{ width: "1em", height: "1em" }} /> : icon}</span>}
      {children}
    </button>
  ),
);

Button.displayName = "Button";
