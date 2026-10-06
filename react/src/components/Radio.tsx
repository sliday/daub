import { forwardRef, type ComponentProps } from "react";
import { cn } from "../utils/cn";

export interface RadioProps extends Omit<ComponentProps<"input">, "type" | "checked" | "defaultChecked" | "onChange"> {
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => void;
  label?: string;
}

export const Radio = forwardRef<HTMLInputElement, RadioProps>(
  ({ checked, defaultChecked, onChange, label, name, value, className, ...props }, ref) => {
    return (
      <label data-db-react="" className={cn("db-radio", className)}>
        <input
          ref={ref}
          className="db-radio__input"
          type="radio"
          name={name}
          value={value}
          checked={checked}
          defaultChecked={defaultChecked}
          onChange={(event) => onChange?.(event.target.checked)}
          {...props}
        />
        <span className="db-radio__circle" />
        {label && <span>{label}</span>}
      </label>
    );
  },
);

Radio.displayName = "Radio";
