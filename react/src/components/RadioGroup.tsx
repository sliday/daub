import { forwardRef, type ComponentProps } from "react";
import { cn } from "../utils/cn";
import { useControllable } from "../hooks/useControllable";
import { Radio } from "./Radio";

export interface RadioGroupProps extends Omit<ComponentProps<"div">, "onChange" | "defaultValue"> {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  name?: string;
  options?: { label: string; value: string }[];
}

export const RadioGroup = forwardRef<HTMLDivElement, RadioGroupProps>(
  ({ value, defaultValue, onChange, name, options = [], className, ...props }, ref) => {
    const [selected, setSelected] = useControllable(value, defaultValue ?? "", onChange);

    return (
      <div ref={ref} className={cn("db-radio-group", className)} role="radiogroup" {...props}>
        {options.map((opt) => (
          <Radio
            key={opt.value}
            name={name}
            value={opt.value}
            label={opt.label}
            checked={selected === opt.value}
            onChange={() => setSelected(opt.value)}
          />
        ))}
      </div>
    );
  },
);

RadioGroup.displayName = "RadioGroup";
