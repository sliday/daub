import { type ReactNode, useState, useRef, useCallback } from "react";
import { cn } from "../utils/cn";
import { useOutsideClick, useEscapeKey } from "../hooks/useOverlay";

export interface DropdownMenuItem {
  label: string;
  onClick?: () => void;
  icon?: string;
  divider?: boolean;
  disabled?: boolean;
}

export interface DropdownMenuProps {
  trigger: ReactNode;
  items: DropdownMenuItem[];
  align?: "left" | "right";
  className?: string;
}

export function DropdownMenu({
  trigger,
  items,
  align = "left",
  className,
}: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);
  const toggle = useCallback(() => setOpen((prev) => !prev), []);

  useOutsideClick(ref, close, open);
  useEscapeKey(close, open);

  return (
    <div ref={ref} className={cn("db-dropdown", className)}>
      <div className="db-dropdown__trigger" onClick={toggle}>
        {trigger}
      </div>
      {open && (
        <div className={cn("db-dropdown__menu", `db-dropdown__menu--${align}`)}>
          {items.map((item, i) =>
            item.divider ? (
              <hr key={i} className="db-dropdown__divider" />
            ) : (
              <button
                key={i}
                className={cn(
                  "db-dropdown__item",
                  item.disabled && "db-dropdown__item--disabled",
                )}
                onClick={() => {
                  item.onClick?.();
                  setOpen(false);
                }}
                disabled={item.disabled}
              >
                {item.icon && (
                  <span className="db-dropdown__icon">{item.icon}</span>
                )}
                {item.label}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}

DropdownMenu.displayName = "DropdownMenu";
