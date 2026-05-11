import { forwardRef, type ComponentProps, type ReactNode } from "react";
import { cn } from "../utils/cn";

export interface PreviewCardProps extends Omit<ComponentProps<"div">, "title"> {
  trigger: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  media?: ReactNode;
}

export const PreviewCard = forwardRef<HTMLDivElement, PreviewCardProps>(
  ({ trigger, title, description, media, className, children, ...props }, ref) => (
    <div ref={ref} className={cn("db-preview-card", className)} {...props}>
      <span className="db-preview-card__trigger">{trigger}</span>
      <div className="db-preview-card__content">
        {media && <div className="db-preview-card__media">{media}</div>}
        {title && <div className="db-preview-card__title">{title}</div>}
        {description && <div className="db-preview-card__desc">{description}</div>}
        {children}
      </div>
    </div>
  ),
);

PreviewCard.displayName = "PreviewCard";
