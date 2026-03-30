import { forwardRef, type ComponentProps } from "react";
import { cn } from "../utils/cn";

export interface ProseProps extends ComponentProps<"article"> {
  size?: "sm" | "lg" | "xl" | "2xl";
}

export const Prose = forwardRef<HTMLElement, ProseProps>(
  ({ size, className, children, ...props }, ref) => (
    <article
      ref={ref}
      className={cn("db-prose", size && `db-prose--${size}`, className)}
      {...props}
    >
      {children}
    </article>
  ),
);

Prose.displayName = "Prose";
