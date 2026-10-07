import { cloneElement, forwardRef, useCallback, useRef, type ComponentProps } from "react";
import { cn } from "../utils/cn";
import { useResettableControl } from "../hooks/useFormReset";
import { mapControlChildren } from "../utils/mapControlChildren";
import { Toggle, type ToggleProps } from "./Toggle";

export interface ToggleGroupProps extends Omit<ComponentProps<"div">, "onChange" | "defaultValue"> {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  multiple?: boolean;
  values?: string[];
  defaultValues?: string[];
  onValuesChange?: (values: string[]) => void;
  disabled?: boolean;
}

export const ToggleGroup = forwardRef<HTMLDivElement, ToggleGroupProps>(
  ({ value, defaultValue, onChange, multiple, values, defaultValues, onValuesChange, disabled, className, children, ...props }, ref) => {
    const rootRef = useRef<HTMLDivElement | null>(null);
    const [selected, setSelected] = useResettableControl(value, defaultValue ?? "", onChange, rootRef);
    const [selectedValues, setSelectedValues] = useResettableControl(values, defaultValues ?? (defaultValue ? defaultValue.split(",") : []), onValuesChange, rootRef);
    const setRef = useCallback((node: HTMLDivElement | null) => {
      rootRef.current = node;
      if (typeof ref === "function") {
        const cleanup: unknown = ref(node);
        if (typeof cleanup === "function") return () => { rootRef.current = null; cleanup(); };
      }
      else if (ref) ref.current = node;
    }, [ref]);
    const arrayMode = values !== undefined || defaultValues !== undefined;
    const active = multiple ? (arrayMode ? selectedValues : selected.split(",").filter(Boolean)) : [selected];
    return (
    <div
      ref={setRef}
      className={cn("db-toggle-group", className)}
      role="group"
      aria-disabled={disabled || undefined}
      {...props}
      data-db-react=""
    >
      {mapControlChildren<ToggleProps>(children, Toggle, (child) => {
        if (child.props.value === undefined) return child;
        const key = String(child.props.value);
        return cloneElement(child, {
          pressed: active.includes(key),
          disabled: disabled || child.props.disabled,
          onChange: (pressed) => {
            if (disabled || child.props.disabled) return;
            child.props.onChange?.(pressed);
            if (multiple) {
              const next = pressed ? [...active, key] : active.filter((entry) => entry !== key);
              if (arrayMode) setSelectedValues(next);
              else onValuesChange?.(next);
              if (!arrayMode || onChange) setSelected(next.join(","));
            } else setSelected(pressed ? key : "");
          },
        });
      }, ToggleGroup)}
    </div>
    );
  },
);

ToggleGroup.displayName = "ToggleGroup";
