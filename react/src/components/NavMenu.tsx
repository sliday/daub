import { forwardRef, type ComponentProps } from "react";
import { cn } from "../utils/cn";

export interface NavMenuItem {
  label: string;
  href?: string;
  active?: boolean;
  onClick?: () => void;
}

export interface NavMenuProps extends Omit<ComponentProps<"nav">, "children"> {
  items: NavMenuItem[];
}

export const NavMenu = forwardRef<HTMLElement, NavMenuProps>(
  ({ items, className, ...props }, ref) => (
    <nav ref={ref} data-db-react="" {...props} className={cn("db-nav-menu", className)}>
      {items.map((item, i) => {
        const Tag = item.href ? "a" : item.onClick ? "button" : "span";
        return (
        <Tag
          key={i}
          href={item.href}
          type={Tag === "button" ? "button" : undefined}
          onClick={item.onClick}
          className={cn(
            "db-nav-menu__item",
            item.active && "db-nav-menu__item--active",
          )}
          aria-current={item.active ? "page" : undefined}
        >
          {item.label}
        </Tag>
        );
      })}
    </nav>
  ),
);

NavMenu.displayName = "NavMenu";
