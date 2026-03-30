import { forwardRef, type ComponentProps, type ReactNode } from "react";
import { cn } from "../utils/cn";

export interface NavbarProps extends ComponentProps<"nav"> {
  brand?: ReactNode;
  brandHref?: string;
}

export const Navbar = forwardRef<HTMLElement, NavbarProps>(
  ({ brand, brandHref, children, className, ...props }, ref) => (
    <nav ref={ref} {...props} className={cn("db-navbar", className)}>
      {brand && (
        <a className="db-navbar__brand" href={brandHref}>
          {brand}
        </a>
      )}
      <div className="db-navbar__nav">{children}</div>
    </nav>
  ),
);

Navbar.displayName = "Navbar";
