import { forwardRef, type ComponentProps } from "react";
import { cn } from "../utils/cn";
import { useControllable } from "../hooks/useControllable";

export interface SwitchProps extends Omit<ComponentProps<"div">, "onChange" | "role"> {
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => void;
  label?: string;
}

export const Switch = forwardRef<HTMLDivElement, SwitchProps>(
  ({ checked, defaultChecked, onChange, label, className, ...props }, ref) => {
    const [on, setOn] = useControllable(checked, defaultChecked ?? false, onChange);

    const toggle = () => setOn(!on);

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") {
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
        tabIndex={0}
        onClick={toggle}
        onKeyDown={handleKeyDown}
        {...props}
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
