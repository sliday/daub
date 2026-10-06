import { Children, forwardRef, type ComponentProps } from "react";
import { cn } from "../utils/cn";

export interface AvatarGroupProps extends ComponentProps<"div"> {
  max?: number;
}

export const AvatarGroup = forwardRef<HTMLDivElement, AvatarGroupProps>(
  ({ max, className, children, ...props }, ref) => {
    const avatars = Children.toArray(children);
    const limit = max === undefined || !Number.isFinite(max) ? avatars.length : Math.max(0, Math.floor(max));
    const remaining = Math.max(0, avatars.length - limit);
    return (
    <div
      ref={ref}
      data-db-react=""
      className={cn("db-avatar-group", className)}
      {...props}
    >
      {avatars.slice(0, limit)}
      {remaining > 0 && <span className="db-avatar-group__overflow" aria-label={`${remaining} more avatars`}>+{remaining}</span>}
    </div>
    );
  },
);

AvatarGroup.displayName = "AvatarGroup";
