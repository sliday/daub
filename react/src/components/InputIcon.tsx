import { forwardRef, type ComponentProps, type ReactNode } from "react";
import { cn } from "../utils/cn";

export interface InputIconProps extends ComponentProps<"div"> {
  icon?: ReactNode;
  right?: boolean;
}

export const InputIcon = forwardRef<HTMLDivElement, InputIconProps>(
  ({ icon, right, className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("db-input-icon", right && "db-input-icon--right", className)}
      {...props}
    >
      {icon && <span>{icon}</span>}
      {children}
    </div>
  ),
);

InputIcon.displayName = "InputIcon";
