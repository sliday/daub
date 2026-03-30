import { forwardRef, type ComponentProps } from "react";
import { cn } from "../utils/cn";

export interface AvatarProps extends ComponentProps<"div"> {
  src?: string;
  alt?: string;
  initials?: string;
  size?: "sm" | "md" | "lg";
}

export const Avatar = forwardRef<HTMLDivElement, AvatarProps>(
  ({ src, alt, initials, size, className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("db-avatar", size && `db-avatar--${size}`, className)}
      {...props}
    >
      {src ? (
        <img src={src} alt={alt ?? ""} />
      ) : initials ? (
        <span>{initials}</span>
      ) : null}
    </div>
  ),
);

Avatar.displayName = "Avatar";
