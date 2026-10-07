import { forwardRef, type ComponentProps, type ReactNode } from "react";
import { cn } from "../utils/cn";

export interface ListItem {
  title: string;
  secondary?: string;
  icon?: ReactNode;
}

export interface ListProps extends ComponentProps<"div"> {
  items?: ListItem[];
}

export const List = forwardRef<HTMLDivElement, ListProps>(
  ({ items, className, children, ...props }, ref) => (
    <div ref={ref} data-db-react="" role="list" className={cn("db-list", className)} {...props}>
      {items?.map((item, i) => (
        <div key={i} className="db-list__item" role="listitem">
          {item.icon && <span aria-hidden="true">{item.icon}</span>}
          <div className="db-list__content">
          <span className="db-list__title">{item.title}</span>
          {item.secondary && (
            <span className="db-list__secondary">{item.secondary}</span>
          )}
          </div>
        </div>
      ))}
      {children}
    </div>
  ),
);

List.displayName = "List";
