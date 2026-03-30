import { forwardRef, type ComponentProps } from "react";
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
}

export const Slider = forwardRef<HTMLInputElement, SliderProps>(
  ({ value, defaultValue, onChange, min = 0, max = 100, step = 1, label, className, ...props }, ref) => {
    const [val, setVal] = useControllable(value, defaultValue ?? min, onChange);

    return (
      <div className={cn("db-slider", className)} {...props}>
        {label && (
          <label className="db-slider__label">
            {label}
            <span className="db-slider__value">{val}</span>
          </label>
        )}
        <input
          ref={ref}
          type="range"
          className="db-slider__input"
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
