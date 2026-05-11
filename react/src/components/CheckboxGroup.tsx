import { forwardRef, type ComponentProps, type ReactNode } from "react";
import { cn } from "../utils/cn";

export interface CheckboxGroupProps extends ComponentProps<"div"> {
  label?: ReactNode;
  helper?: ReactNode;
  inline?: boolean;
}

export const CheckboxGroup = forwardRef<HTMLDivElement, CheckboxGroupProps>(
  ({ label, helper, inline, className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("db-checkbox-group", inline && "db-checkbox-group--inline", className)}
      role="group"
      {...props}
    >
      {label && <span className="db-checkbox-group__label">{label}</span>}
      {children}
      {helper && <span className="db-checkbox-group__helper">{helper}</span>}
    </div>
  ),
);

CheckboxGroup.displayName = "CheckboxGroup";
