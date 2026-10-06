import { Children, cloneElement, forwardRef, isValidElement, useId, type ComponentProps, type ReactNode } from "react";
import { cn } from "../utils/cn";
import { Input } from "./Input";
import { Textarea } from "./Textarea";
import { NumberField } from "./NumberField";
import { Checkbox } from "./Checkbox";
import { Select } from "./Select";

export interface FieldProps extends ComponentProps<"div"> {
  label?: string;
  helper?: string;
  error?: boolean | string;
  htmlFor?: string;
}

export const Field = forwardRef<HTMLDivElement, FieldProps>(
  ({ label, helper, error, htmlFor, className, children, ...props }, ref) => {
    const helperText = typeof error === "string" ? error : helper;
    const id = useId();
    let controlId = htmlFor ?? `${id}-control`;
    let associated = false;
    const associate = (nodes: ReactNode): ReactNode => Children.map(nodes, (child) => {
      if (!isValidElement<ComponentProps<"input"> & { children?: ReactNode }>(child)) return child;
      const labelable = child.type === Input || child.type === Textarea || child.type === NumberField
        || child.type === Checkbox || child.type === Select || child.type === "input" || child.type === "textarea" || child.type === "select";
      if (labelable && !associated && (!htmlFor || !child.props.id || child.props.id === htmlFor)) {
        associated = true;
        controlId = child.props.id ?? controlId;
        return cloneElement(child, {
          id: controlId,
          "aria-labelledby": child.props["aria-labelledby"] ?? (label && !child.props["aria-label"] ? `${id}-label` : undefined),
          "aria-invalid": child.props["aria-invalid"] ?? (error ? true : undefined),
          "aria-describedby": [child.props["aria-describedby"], helperText && `${id}-helper`].filter(Boolean).join(" ") || undefined,
        });
      }
      return child.props.children ? cloneElement(child, { children: associate(child.props.children) }) : child;
    });
    const controls = associate(children);

    return (
      <div
        ref={ref}
        className={cn("db-field", error && "db-field--error", className)}
        {...props}
        data-db-react=""
      >
        {label && <label id={`${id}-label`} className="db-label" htmlFor={controlId}>{label}</label>}
        {controls}
        {helperText && <span id={`${id}-helper`} className="db-field__helper">{helperText}</span>}
      </div>
    );
  },
);

Field.displayName = "Field";
