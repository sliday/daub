import { forwardRef, useId, type ComponentProps } from "react";
import { cn } from "../utils/cn";
import { useControllable } from "../hooks/useControllable";

export interface SliderProps extends Omit<ComponentProps<"div">, "onChange" | "defaultValue"> {
  value?: number;
  defaultValue?: number;
  onChange?: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  disabled?: boolean;
  name?: string;
  form?: string;
  inputProps?: Omit<ComponentProps<"input">, "type" | "value" | "defaultValue" | "onChange" | "min" | "max" | "step">;
}

export const Slider = forwardRef<HTMLInputElement, SliderProps>(
  ({ value, defaultValue, onChange, min = 0, max = 100, step = 1, label, disabled, name, form, inputProps, className, ...props }, ref) => {
    const [val, setVal] = useControllable(value, defaultValue ?? min, onChange);
    const generatedId = useId();
    const inputId = inputProps?.id ?? generatedId;

    return (
      <div className={cn("db-slider", className)} {...props} data-db-react="">
        {label && (
          <label className="db-slider__label" htmlFor={inputId}>
            {label}
            <span className="db-slider__value" aria-hidden="true">{val}</span>
          </label>
        )}
        <input
          {...inputProps}
          ref={ref}
          id={inputId}
          type="range"
          name={name ?? inputProps?.name}
          form={form ?? inputProps?.form}
          disabled={disabled || inputProps?.disabled}
          aria-label={inputProps?.["aria-label"] ?? props["aria-label"]}
          aria-labelledby={inputProps?.["aria-labelledby"] ?? props["aria-labelledby"]}
          aria-describedby={inputProps?.["aria-describedby"] ?? props["aria-describedby"]}
          className={cn("db-slider__input", inputProps?.className)}
          min={min}
          max={max}
          step={step}
          value={val}
          onChange={(e) => setVal(+e.target.value)}
        />
      </div>
    );
  },
);

Slider.displayName = "Slider";
