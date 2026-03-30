import { forwardRef, type ComponentProps } from "react";
import { cn } from "../utils/cn";
import { useControllable } from "../hooks/useControllable";

export interface RadioProps extends Omit<ComponentProps<"input">, "type" | "checked" | "defaultChecked" | "onChange"> {
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => void;
  label?: string;
}

export const Radio = forwardRef<HTMLInputElement, RadioProps>(
  ({ checked, defaultChecked, onChange, label, name, value, className, ...props }, ref) => {
    const [on, setOn] = useControllable(checked, defaultChecked ?? false, onChange);

    return (
      <label className={cn("db-radio", className)}>
        <input
          ref={ref}
          type="radio"
          name={name}
          value={value}
          checked={on}
          onChange={() => setOn(true)}
          {...props}
        />
        <span className="db-radio__circle" />
        {label && <span>{label}</span>}
      </label>
    );
  },
);

Radio.displayName = "Radio";
