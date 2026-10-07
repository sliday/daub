import { forwardRef, type ComponentProps, type ReactNode } from "react";
import { cn } from "../utils/cn";

export interface BottomNavItem {
  icon?: ReactNode;
  label: string;
  href?: string;
  active?: boolean;
  badge?: string;
  onClick?: () => void;
}

export interface BottomNavProps extends Omit<ComponentProps<"nav">, "children"> {
  items: BottomNavItem[];
}

export const BottomNav = forwardRef<HTMLElement, BottomNavProps>(
  ({ items, className, ...props }, ref) => (
    <nav ref={ref} data-db-react="" {...props} className={cn("db-bottom-nav", className)}>
      {items.map((item, i) => {
        const Tag = item.href ? "a" : item.onClick ? "button" : "span";
        return (
        <Tag
          key={i}
          href={item.href}
          type={Tag === "button" ? "button" : undefined}
          onClick={item.onClick}
          className={cn(
            "db-bottom-nav__item",
            item.active && "db-bottom-nav__item--active",
          )}
          aria-current={item.active ? "page" : undefined}
        >
          {item.icon && (
            <span className="db-bottom-nav__icon" aria-hidden="true">
              {item.icon}
            </span>
          )}
          <span className="db-bottom-nav__label">{item.label}</span>
          {item.badge && (
            <span className="db-bottom-nav__badge">{item.badge}</span>
          )}
        </Tag>
        );
      })}
    </nav>
  ),
);

BottomNav.displayName = "BottomNav";
