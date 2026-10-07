import { forwardRef, useCallback, useRef, type ComponentProps } from "react";
import { cn } from "../utils/cn";
import { useResettableControl } from "../hooks/useFormReset";

export interface CheckboxProps extends Omit<ComponentProps<"input">, "type" | "checked" | "defaultChecked" | "onChange"> {
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => void;
  label?: string;
  indeterminate?: boolean;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ checked, defaultChecked, onChange, label, indeterminate, className, ...props }, ref) => {
    const inputRef = useRef<HTMLInputElement | null>(null);
    const [on, setOn] = useResettableControl(checked, defaultChecked ?? false, onChange, inputRef);
    const setRef = useCallback((node: HTMLInputElement | null) => {
      inputRef.current = node;
      if (node) node.indeterminate = !!indeterminate;
      if (typeof ref === "function") {
        const cleanup: unknown = ref(node);
        if (typeof cleanup === "function") return () => { inputRef.current = null; cleanup(); };
      }
      else if (ref) ref.current = node;
    }, [ref, indeterminate, on]);

    return (
      <label className={cn("db-checkbox", className)} data-db-react="">
        <input
          ref={setRef}
          type="checkbox"
          className="db-checkbox__input"
          aria-checked={indeterminate ? "mixed" : undefined}
          checked={on}
          onChange={(event) => {
            if (event.defaultPrevented || event.nativeEvent.defaultPrevented) return;
            setOn(event.target.checked);
            event.target.indeterminate = !!indeterminate;
          }}
          {...props}
        />
        <span className="db-checkbox__box" aria-hidden="true">
          <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
        </span>
        {label && <span>{label}</span>}
      </label>
    );
  },
);

Checkbox.displayName = "Checkbox";
