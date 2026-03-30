import { forwardRef, type ComponentProps } from "react";
import { cn } from "../utils/cn";

export interface KbdProps extends ComponentProps<"kbd"> {
  keys?: string[];
}

export const Kbd = forwardRef<HTMLElement, KbdProps>(
  ({ keys, className, children, ...props }, ref) => {
    if (keys && keys.length > 0) {
      return (
        <span ref={ref as React.Ref<HTMLSpanElement>} className={className}>
          {keys.map((key, i) => (
            <span key={i}>
              {i > 0 && " + "}
              <kbd className="db-kbd">{key}</kbd>
            </span>
          ))}
        </span>
      );
    }

    return (
      <kbd ref={ref} className={cn("db-kbd", className)} {...props}>
        {children}
      </kbd>
    );
  },
);

Kbd.displayName = "Kbd";
