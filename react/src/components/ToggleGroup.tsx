import { forwardRef, type ComponentProps } from "react";
import { cn } from "../utils/cn";

export interface ToggleGroupProps extends Omit<ComponentProps<"div">, "onChange" | "defaultValue"> {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  multiple?: boolean;
}

export const ToggleGroup = forwardRef<HTMLDivElement, ToggleGroupProps>(
  ({ value, defaultValue, onChange, multiple, className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("db-toggle-group", className)}
      role="group"
      {...props}
    >
      {children}
    </div>
  ),
);

ToggleGroup.displayName = "ToggleGroup";
