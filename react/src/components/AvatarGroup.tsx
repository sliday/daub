import { forwardRef, type ComponentProps } from "react";
import { cn } from "../utils/cn";

export interface AvatarGroupProps extends ComponentProps<"div"> {
  max?: number;
}

export const AvatarGroup = forwardRef<HTMLDivElement, AvatarGroupProps>(
  ({ max: _max, className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("db-avatar-group", className)}
      {...props}
    />
  ),
);

AvatarGroup.displayName = "AvatarGroup";
