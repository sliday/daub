import { forwardRef, type ComponentProps } from "react";
import { cn } from "../utils/cn";

export interface LabelProps extends ComponentProps<"label"> {
  required?: boolean;
  optional?: boolean;
}

export const Label = forwardRef<HTMLLabelElement, LabelProps>(
  ({ required, optional, className, children, ...props }, ref) => (
    <label ref={ref} className={cn("db-label", className)} {...props}>
      {children}
      {required && " *"}
      {optional && " (optional)"}
    </label>
  ),
);

Label.displayName = "Label";
