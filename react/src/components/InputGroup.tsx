import { forwardRef, type ComponentProps, type ReactNode } from "react";
import { cn } from "../utils/cn";

export interface InputGroupProps extends ComponentProps<"div"> {
  addonBefore?: ReactNode;
  addonAfter?: ReactNode;
}

export const InputGroup = forwardRef<HTMLDivElement, InputGroupProps>(
  ({ addonBefore, addonAfter, className, children, ...props }, ref) => (
    <div ref={ref} className={cn("db-input-group", className)} {...props}>
      {addonBefore && <span className="db-input-group__addon">{addonBefore}</span>}
      {children}
      {addonAfter && <span className="db-input-group__addon">{addonAfter}</span>}
    </div>
  ),
);

InputGroup.displayName = "InputGroup";
