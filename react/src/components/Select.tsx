import { forwardRef, type ComponentProps } from "react";
import { cn } from "../utils/cn";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends Omit<ComponentProps<"select">, "children"> {
  label?: string;
  options?: SelectOption[];
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, options, className, ...props }, ref) => (
    <div className={cn("db-select", className)}>
      {label && <label className="db-label">{label}</label>}
      <select ref={ref} className="db-select__native" {...props}>
        {options?.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  ),
);

Select.displayName = "Select";
