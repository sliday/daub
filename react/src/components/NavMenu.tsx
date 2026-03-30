import { forwardRef, type ComponentProps } from "react";
import { cn } from "../utils/cn";

export interface NavMenuItem {
  label: string;
  href?: string;
  active?: boolean;
}

export interface NavMenuProps extends Omit<ComponentProps<"nav">, "children"> {
  items: NavMenuItem[];
}

export const NavMenu = forwardRef<HTMLElement, NavMenuProps>(
  ({ items, className, ...props }, ref) => (
    <nav ref={ref} {...props} className={cn("db-nav-menu", className)}>
      {items.map((item, i) => (
        <a
          key={i}
          href={item.href}
          className={cn(
            "db-nav-menu__item",
            item.active && "db-nav-menu__item--active",
          )}
          aria-current={item.active ? "page" : undefined}
        >
          {item.label}
        </a>
      ))}
    </nav>
  ),
);

NavMenu.displayName = "NavMenu";
