import { forwardRef, type ComponentProps, type ReactNode } from "react";
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
    { title, description, media, footer, clip, interactive, className, children, ...props },
    ref,
  ) => (
    <div
      ref={ref}
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
          {title && <h3>{title}</h3>}
          {description && <p>{description}</p>}
        </div>
      )}
      {children && <div className="db-card__body">{children}</div>}
      {footer && <div className="db-card__footer">{footer}</div>}
    </div>
  ),
);

Card.displayName = "Card";
