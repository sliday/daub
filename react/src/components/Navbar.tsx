import { forwardRef, useId, useRef, type ComponentProps, type ReactNode } from "react";
import { cn } from "../utils/cn";
import { useControllable } from "../hooks/useControllable";

export interface NavbarProps extends ComponentProps<"nav"> {
  brand?: ReactNode;
  brandHref?: string;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  disabled?: boolean;
}

export const Navbar = forwardRef<HTMLElement, NavbarProps>(
  ({ brand, brandHref, children, className, open, defaultOpen, onOpenChange, disabled, onKeyDown, ...props }, ref) => {
    const [isOpen, setOpen] = useControllable(open, defaultOpen ?? false, onOpenChange);
    const id = useId();
    const toggleRef = useRef<HTMLButtonElement | null>(null);
    return (
    <nav ref={ref} {...props} className={cn("db-navbar", isOpen && "db-navbar--open", className)} data-db-react="" onKeyDown={(event) => {
      onKeyDown?.(event);
      if (!event.defaultPrevented && event.key === "Escape" && isOpen) {
        event.preventDefault();
        setOpen(false);
        toggleRef.current?.focus();
      }
    }}>
      {brand && (
        brandHref ? <a className="db-navbar__brand" href={brandHref}>{brand}</a> : <span className="db-navbar__brand">{brand}</span>
      )}
      <button ref={toggleRef} className="db-navbar__toggle" type="button" aria-label="Toggle navigation" aria-expanded={isOpen} aria-controls={`${id}-nav`} disabled={disabled} onClick={() => setOpen(!isOpen)}>
        <span aria-hidden="true">{"\u2630"}</span>
      </button>
      <div id={`${id}-nav`} className="db-navbar__nav">{children}</div>
    </nav>
    );
  },
);

Navbar.displayName = "Navbar";
