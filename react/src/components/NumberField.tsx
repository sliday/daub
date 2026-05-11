import { forwardRef, type ComponentProps } from "react";
import { cn } from "../utils/cn";
import { useControllable } from "../hooks/useControllable";

export interface NumberFieldProps extends Omit<ComponentProps<"input">, "type" | "value" | "defaultValue" | "onChange"> {
  value?: number;
  defaultValue?: number;
  onChange?: (value: number) => void;
  step?: number;
  min?: number;
  max?: number;
}

export const NumberField = forwardRef<HTMLInputElement, NumberFieldProps>(
  ({ value, defaultValue, onChange, step = 1, min, max, className, "aria-label": ariaLabel, ...props }, ref) => {
    const [val, setVal] = useControllable(value, defaultValue ?? min ?? 0, onChange);
    const clamp = (next: number) => Math.min(max ?? next, Math.max(min ?? next, next));
    const update = (next: number) => setVal(clamp(next));

    return (
      <div className={cn("db-number-field", className)} role="group">
        <button
          type="button"
          className="db-btn db-btn--secondary db-number-field__btn"
          onClick={() => update(val - step)}
          aria-label="Decrease"
        >
          -
        </button>
        <input
          ref={ref}
          type="number"
          className="db-input"
          value={val}
          min={min}
          max={max}
          step={step}
          aria-label={ariaLabel ?? "Value"}
          onChange={(event) => update(Number(event.target.value))}
          {...props}
        />
        <button
          type="button"
          className="db-btn db-btn--secondary db-number-field__btn"
          onClick={() => update(val + step)}
          aria-label="Increase"
        >
          +
        </button>
      </div>
    );
  },
);

NumberField.displayName = "NumberField";
