import { forwardRef, type ComponentProps } from "react";
import { cn } from "../utils/cn";

export interface ListItem {
  title: string;
  secondary?: string;
  icon?: string;
}

export interface ListProps extends ComponentProps<"div"> {
  items?: ListItem[];
}

export const List = forwardRef<HTMLDivElement, ListProps>(
  ({ items, className, children, ...props }, ref) => (
    <div ref={ref} className={cn("db-list", className)} {...props}>
      {items?.map((item, i) => (
        <div key={i} className="db-list__item">
          <span className="db-list__title">{item.title}</span>
          {item.secondary && (
            <span className="db-list__secondary">{item.secondary}</span>
          )}
        </div>
      ))}
      {children}
    </div>
  ),
);

List.displayName = "List";
