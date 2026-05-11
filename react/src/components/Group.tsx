import { forwardRef, type ComponentProps } from "react";
import { cn } from "../utils/cn";

export interface GroupProps extends ComponentProps<"div"> {
  attached?: boolean;
  vertical?: boolean;
}

export const Group = forwardRef<HTMLDivElement, GroupProps>(
  ({ attached, vertical, className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "db-group",
        attached && "db-group--attached",
        vertical && "db-group--vertical",
        className,
      )}
      {...props}
    />
  ),
);

Group.displayName = "Group";
