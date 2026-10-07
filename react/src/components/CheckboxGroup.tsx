import { cloneElement, forwardRef, useCallback, useId, useRef, type ComponentProps, type ReactNode } from "react";
import { cn } from "../utils/cn";
import { useResettableControl } from "../hooks/useFormReset";
import { mapControlChildren } from "../utils/mapControlChildren";
import { Checkbox, type CheckboxProps } from "./Checkbox";

export interface CheckboxGroupProps extends Omit<ComponentProps<"div">, "defaultValue"> {
  label?: ReactNode;
  helper?: ReactNode;
  inline?: boolean;
  value?: string[];
  defaultValue?: string[];
  onValueChange?: (values: string[]) => void;
  disabled?: boolean;
}

export const CheckboxGroup = forwardRef<HTMLDivElement, CheckboxGroupProps>(
  ({ label, helper, inline, value, defaultValue, onValueChange, disabled, className, children, ...props }, ref) => {
    const id = useId();
    const rootRef = useRef<HTMLDivElement | null>(null);
    const [selected, setSelected] = useResettableControl(value, defaultValue ?? [], onValueChange, rootRef);
    const setRef = useCallback((node: HTMLDivElement | null) => {
      rootRef.current = node;
      if (typeof ref === "function") {
        const cleanup: unknown = ref(node);
        if (typeof cleanup === "function") return () => { rootRef.current = null; cleanup(); };
      }
      else if (ref) ref.current = node;
    }, [ref]);
    const coordinated = value !== undefined || defaultValue !== undefined || onValueChange !== undefined;
    return (
    <div
      ref={setRef}
      className={cn("db-checkbox-group", inline && "db-checkbox-group--inline", className)}
      role="group"
      aria-labelledby={label ? `${id}-label` : undefined}
      aria-disabled={disabled || undefined}
      {...props}
      data-db-react=""
      aria-describedby={[props["aria-describedby"], helper && `${id}-helper`].filter(Boolean).join(" ") || undefined}
    >
      {label && <span id={`${id}-label`} className="db-checkbox-group__label">{label}</span>}
      {mapControlChildren<CheckboxProps>(children, Checkbox, (child) => {
        const key = child.props.value === undefined ? undefined : String(child.props.value);
        return cloneElement(child, {
          disabled: disabled || child.props.disabled,
          ...(coordinated && key !== undefined ? {
            checked: selected.includes(key),
            onChange: (checked: boolean) => {
              if (disabled || child.props.disabled) return;
              child.props.onChange?.(checked);
              setSelected(checked ? [...selected, key] : selected.filter((entry) => entry !== key));
            },
          } : {}),
        });
      }, CheckboxGroup)}
      {helper && <span id={`${id}-helper`} className="db-checkbox-group__helper">{helper}</span>}
    </div>
    );
  },
);

CheckboxGroup.displayName = "CheckboxGroup";
