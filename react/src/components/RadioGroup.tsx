import { forwardRef, useId, type ComponentProps } from "react";
import { cn } from "../utils/cn";
import { useControllable } from "../hooks/useControllable";
import { Radio } from "./Radio";

export interface RadioGroupProps extends Omit<ComponentProps<"div">, "onChange" | "defaultValue"> {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  name?: string;
  options?: { label: string; value: string; disabled?: boolean }[];
  disabled?: boolean;
  required?: boolean;
}

export const RadioGroup = forwardRef<HTMLDivElement, RadioGroupProps>(
  ({ value, defaultValue, onChange, name, options = [], disabled, required, className, ...props }, ref) => {
    const [selected, setSelected] = useControllable(value, defaultValue ?? "", onChange);
    const generatedName = useId();

    return (
      <div ref={ref} className={cn("db-radio-group", className)} role="radiogroup" aria-disabled={disabled || undefined} {...props} data-db-react="">
        {options.map((opt) => (
          <Radio
            key={opt.value}
            name={name ?? generatedName}
            value={opt.value}
            label={opt.label}
            checked={selected === opt.value}
            disabled={disabled || opt.disabled}
            required={required}
            onChange={() => setSelected(opt.value)}
          />
        ))}
      </div>
    );
  },
);

RadioGroup.displayName = "RadioGroup";
