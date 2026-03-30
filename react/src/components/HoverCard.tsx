import { forwardRef, type ComponentProps, type ReactNode } from "react";
import { cn } from "../utils/cn";

export interface HoverCardProps extends Omit<ComponentProps<"div">, "content"> {
  trigger: ReactNode;
  content: ReactNode;
}

export const HoverCard = forwardRef<HTMLDivElement, HoverCardProps>(
  ({ trigger, content, className, children, ...props }, ref) => (
    <div ref={ref} {...props} className={cn("db-hover-card", className)}>
      <div className="db-hover-card__trigger">{trigger}</div>
      <div className="db-hover-card__content">{content}</div>
    </div>
  ),
);

HoverCard.displayName = "HoverCard";
