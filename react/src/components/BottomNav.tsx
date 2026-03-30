import { forwardRef, type ComponentProps } from "react";
import { cn } from "../utils/cn";

export interface BottomNavItem {
  icon?: string;
  label: string;
  href?: string;
  active?: boolean;
  badge?: string;
}

export interface BottomNavProps extends Omit<ComponentProps<"nav">, "children"> {
  items: BottomNavItem[];
}

export const BottomNav = forwardRef<HTMLElement, BottomNavProps>(
  ({ items, className, ...props }, ref) => (
    <nav ref={ref} {...props} className={cn("db-bottom-nav", className)}>
      {items.map((item, i) => (
        <a
          key={i}
          href={item.href}
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
        </a>
      ))}
    </nav>
  ),
);

BottomNav.displayName = "BottomNav";
