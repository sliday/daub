import { forwardRef, useRef, type ComponentProps, type ReactNode } from "react";
import { cn } from "../utils/cn";

export interface CardProps extends ComponentProps<"div"> {
  title?: string;
  description?: string;
  media?: ReactNode;
  footer?: ReactNode;
  clip?: boolean;
  interactive?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    { title, description, media, footer, clip, interactive, className, children, onKeyDown, onKeyUp, onClick, onBlur, role, tabIndex, ...props },
    ref,
  ) => {
    const spacePending = useRef(false);
    return (
    <div
      ref={ref}
      data-db-react=""
      role={role ?? (interactive ? "button" : undefined)}
      tabIndex={tabIndex ?? (interactive ? (props["aria-disabled"] === true || props["aria-disabled"] === "true" ? -1 : 0) : undefined)}
      onClick={(event) => {
        if (interactive && (props["aria-disabled"] === true || props["aria-disabled"] === "true")) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
      onKeyDown={(event) => {
        if (event.key === " ") spacePending.current = false;
        onKeyDown?.(event);
        if (!interactive || event.defaultPrevented || event.target !== event.currentTarget || props["aria-disabled"] === true || props["aria-disabled"] === "true") return;
        if (event.key === "Enter") {
          event.preventDefault();
          if (!event.repeat) event.currentTarget.click();
        } else if (event.key === " " && (!role || role === "button")) {
          event.preventDefault();
          spacePending.current = true;
        }
      }}
      onKeyUp={(event) => {
        onKeyUp?.(event);
        if (event.key !== " ") return;
        const activate = spacePending.current;
        spacePending.current = false;
        if (activate && interactive && !event.defaultPrevented && event.target === event.currentTarget && (!role || role === "button") && props["aria-disabled"] !== true && props["aria-disabled"] !== "true") event.currentTarget.click();
      }}
      onBlur={(event) => { spacePending.current = false; onBlur?.(event); }}
      className={cn(
        "db-card",
        clip && "db-card--clip",
        interactive && "db-card--interactive",
        className,
      )}
      {...props}
    >
      {media}
      {(title || description) && (
        <div className="db-card__header">
          {title && <h3 className="db-card__title">{title}</h3>}
          {description && <p className="db-card__desc">{description}</p>}
        </div>
      )}
      {children && <div className="db-card__body">{children}</div>}
      {footer && <div className="db-card__footer">{footer}</div>}
    </div>
    );
  },
);

Card.displayName = "Card";
