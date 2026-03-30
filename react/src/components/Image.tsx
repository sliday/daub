import { forwardRef, type ComponentProps } from "react";
import { cn } from "../utils/cn";

export type ImageProps = ComponentProps<"img">;

export const Image = forwardRef<HTMLImageElement, ImageProps>(
  ({ className, ...props }, ref) => (
    <img
      ref={ref}
      className={cn("db-img", className)}
      {...props}
    />
  ),
);

Image.displayName = "Image";
