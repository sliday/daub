import { forwardRef, type ComponentProps } from "react";
import { cn } from "../utils/cn";
import { useControllable } from "../hooks/useControllable";

export interface ToggleProps extends Omit<ComponentProps<"button">, "onChange"> {
  pressed?: boolean;
  defaultPressed?: boolean;
  onChange?: (pressed: boolean) => void;
  size?: "sm";
}

export const Toggle = forwardRef<HTMLButtonElement, ToggleProps>(
  ({ pressed, defaultPressed, onChange, size, className, children, ...props }, ref) => {
    const [on, setOn] = useControllable(pressed, defaultPressed ?? false, onChange);

    return (
      <button
        ref={ref}
        type="button"
        className={cn(
          "db-toggle",
          on && "db-toggle--active",
          size && `db-toggle--${size}`,
          className,
        )}
        aria-pressed={on}
        onClick={() => setOn(!on)}
        {...props}
      >
        {children}
      </button>
    );
  },
);

Toggle.displayName = "Toggle";
