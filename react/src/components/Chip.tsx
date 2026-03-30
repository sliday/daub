import { forwardRef, type ComponentProps } from "react";
import { cn } from "../utils/cn";

export interface ChipProps extends ComponentProps<"span"> {
  color?: "red" | "green" | "blue" | "purple" | "amber" | "pink";
  active?: boolean;
  closable?: boolean;
  onClose?: () => void;
}

export const Chip = forwardRef<HTMLSpanElement, ChipProps>(
  ({ color, active, closable, onClose, className, children, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(
        "db-chip",
        color && `db-chip--${color}`,
        active && "db-chip--active",
        className,
      )}
      {...props}
    >
      {children}
      {closable && (
        <button className="db-chip__close" onClick={onClose} type="button">
          &times;
        </button>
      )}
    </span>
  ),
);

Chip.displayName = "Chip";
