import { forwardRef, useEffect, useState, type ComponentProps } from "react";
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
  ({ value, defaultValue, onChange, step = 1, min, max, disabled, readOnly, className, "aria-label": ariaLabel, onBlur, ...props }, ref) => {
    const [val, setVal] = useControllable(value, defaultValue ?? min ?? 0, onChange);
    const [draft, setDraft] = useState<string | null>(null);
    useEffect(() => { setDraft(null); }, [value]);
    const clamp = (next: number) => Math.min(max ?? next, Math.max(min ?? next, next));
    const update = (next: number) => { setDraft(null); setVal(clamp(next)); };

    return (
      <div className={cn("db-number-field", className)} role="group" data-db-react="">
        <button
          type="button"
          className="db-btn db-btn--secondary db-number-field__btn"
          disabled={disabled || readOnly || (min !== undefined && val <= min)}
          onClick={() => update(val - step)}
          aria-label="Decrease"
        >
          -
        </button>
        <input
          ref={ref}
          type="number"
          className="db-input"
          value={draft ?? val}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          readOnly={readOnly}
          aria-label={ariaLabel ?? "Value"}
          onChange={(event) => {
            const text = event.target.value;
            const next = Number(text);
            if (!text || !Number.isFinite(next) || next !== clamp(next)) setDraft(text);
            else { setDraft(null); setVal(next); }
          }}
          onBlur={(event) => {
            if (draft !== null) {
              if (draft && Number.isFinite(Number(draft))) update(Number(draft));
              else setDraft(null);
            }
            onBlur?.(event);
          }}
          {...props}
        />
        <button
          type="button"
          className="db-btn db-btn--secondary db-number-field__btn"
          disabled={disabled || readOnly || (max !== undefined && val >= max)}
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
