import { forwardRef, useId, type ComponentProps, type ReactNode } from "react";
import { cn } from "../utils/cn";

export interface FieldsetProps extends ComponentProps<"fieldset"> {
  legend?: ReactNode;
  helper?: ReactNode;
}

export const Fieldset = forwardRef<HTMLFieldSetElement, FieldsetProps>(
  ({ legend, helper, className, children, ...props }, ref) => {
    const helperId = useId();
    return (
      <fieldset ref={ref} className={cn("db-fieldset", className)} {...props} aria-describedby={[props["aria-describedby"], helper ? helperId : undefined].filter(Boolean).join(" ") || undefined}>
        {legend && <legend className="db-fieldset__legend">{legend}</legend>}
        <div className="db-fieldset__content">{children}</div>
        {helper && <span id={helperId} className="db-fieldset__helper">{helper}</span>}
      </fieldset>
    );
  },
);

Fieldset.displayName = "Fieldset";
