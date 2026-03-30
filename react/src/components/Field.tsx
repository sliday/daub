import { forwardRef, type ComponentProps, type ReactNode } from "react";
import { cn } from "../utils/cn";

export interface FieldProps extends ComponentProps<"div"> {
  label?: string;
  helper?: string;
  error?: boolean | string;
}

export const Field = forwardRef<HTMLDivElement, FieldProps>(
  ({ label, helper, error, className, children, ...props }, ref) => {
    const helperText = typeof error === "string" ? error : helper;

    return (
      <div
        ref={ref}
        className={cn("db-field", error && "db-field--error", className)}
        {...props}
      >
        {label && <label className="db-label">{label}</label>}
        {children}
        {helperText && <span className="db-field__helper">{helperText}</span>}
      </div>
    );
  },
);

Field.displayName = "Field";
