import { forwardRef, type ComponentProps } from "react";
import { cn } from "../utils/cn";
import { useControllable } from "../hooks/useControllable";

export interface CheckboxProps extends Omit<ComponentProps<"input">, "type" | "checked" | "defaultChecked" | "onChange"> {
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => void;
  label?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ checked, defaultChecked, onChange, label, className, ...props }, ref) => {
    const [on, setOn] = useControllable(checked, defaultChecked ?? false, onChange);

    return (
      <label className={cn("db-checkbox", className)}>
        <input
          ref={ref}
          type="checkbox"
          checked={on}
          onChange={() => setOn(!on)}
          {...props}
        />
        <span className="db-checkbox__box" />
        {label && <span>{label}</span>}
      </label>
    );
  },
);

Checkbox.displayName = "Checkbox";
