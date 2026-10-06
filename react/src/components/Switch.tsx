import { forwardRef, type ComponentProps } from "react";
import { cn } from "../utils/cn";
import { useControllable } from "../hooks/useControllable";

export interface SwitchProps extends Omit<ComponentProps<"div">, "onChange" | "role"> {
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
}

export const Switch = forwardRef<HTMLDivElement, SwitchProps>(
  ({ checked, defaultChecked, onChange, label, disabled, className, onClick, onKeyDown, tabIndex, "aria-disabled": ariaDisabled, ...props }, ref) => {
    const [on, setOn] = useControllable(checked, defaultChecked ?? false, onChange);
    const isDisabled = disabled || ariaDisabled === true || ariaDisabled === "true";

    const toggle = () => setOn(!on);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
      onKeyDown?.(e);
      if (!isDisabled && !e.defaultPrevented && (e.key === " " || e.key === "Enter")) {
        e.preventDefault();
        toggle();
      }
    };

    return (
      <div
        ref={ref}
        className={cn("db-switch", on && "db-switch--on", className)}
        role="switch"
        aria-checked={on}
        aria-disabled={isDisabled || ariaDisabled}
        tabIndex={isDisabled ? -1 : tabIndex ?? 0}
        onClick={(e) => {
          onClick?.(e);
          if (!isDisabled && !e.defaultPrevented) toggle();
        }}
        onKeyDown={handleKeyDown}
        {...props}
        data-db-react=""
      >
        <span className="db-switch__track">
          <span className="db-switch__thumb" />
        </span>
        {label && <span>{label}</span>}
      </div>
    );
  },
);

Switch.displayName = "Switch";
