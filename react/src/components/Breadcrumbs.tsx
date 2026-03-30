import { forwardRef, type ComponentProps } from "react";
import { cn } from "../utils/cn";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface BreadcrumbsProps extends Omit<ComponentProps<"nav">, "children"> {
  items: BreadcrumbItem[];
}

export const Breadcrumbs = forwardRef<HTMLElement, BreadcrumbsProps>(
  ({ items, className, ...props }, ref) => (
    <nav
      ref={ref}
      aria-label="Breadcrumb"
      {...props}
      className={cn("db-breadcrumbs", className)}
    >
      <ol>
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          return (
            <li key={i}>
              {isLast ? (
                <span aria-current="page">{item.label}</span>
              ) : (
                <a href={item.href}>{item.label}</a>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  ),
);

Breadcrumbs.displayName = "Breadcrumbs";
