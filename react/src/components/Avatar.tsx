import { forwardRef, useState, type ComponentProps, type ReactNode } from "react";
import { cn } from "../utils/cn";

export interface AvatarProps extends ComponentProps<"div"> {
  src?: string;
  alt?: string;
  initials?: string;
  size?: "sm" | "md" | "lg";
  fallback?: ReactNode;
}

export const Avatar = forwardRef<HTMLDivElement, AvatarProps>(
  ({ src, alt, initials, size, fallback, className, ...props }, ref) => {
    const [image, setImage] = useState({ src, failed: false });
    if (image.src !== src) setImage({ src, failed: false });
    const showImage = !!src && !image.failed;
    return (
    <div
      ref={ref}
      data-db-react=""
      role={!showImage && alt ? "img" : undefined}
      aria-label={!showImage && alt ? alt : undefined}
      className={cn("db-avatar", size && `db-avatar--${size}`, className)}
      {...props}
    >
      {showImage ? (
        <img src={src} alt={alt ?? ""} onError={() => setImage({ src, failed: true })} />
      ) : fallback ?? (initials ? <span>{initials}</span> : null)}
    </div>
    );
  },
);

Avatar.displayName = "Avatar";
