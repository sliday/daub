import { forwardRef, type ComponentProps } from "react";
import { cn } from "../utils/cn";

export interface ButtonProps extends ComponentProps<"button"> {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "lg" | "icon";
  loading?: boolean;
  icon?: string;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant, size, loading, icon, className, disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "db-btn",
        variant && `db-btn--${variant}`,
        size && `db-btn--${size}`,
        loading && "db-btn--loading",
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {children}
    </button>
  ),
);

Button.displayName = "Button";
