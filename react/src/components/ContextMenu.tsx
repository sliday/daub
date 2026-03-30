import { type ReactNode, useState, useRef, useCallback } from "react";
import { cn } from "../utils/cn";
import { useOutsideClick, useEscapeKey } from "../hooks/useOverlay";

export interface ContextMenuItem {
  label: string;
  onClick?: () => void;
  divider?: boolean;
  disabled?: boolean;
}

export interface ContextMenuProps {
  items: ContextMenuItem[];
  children: ReactNode;
  className?: string;
}

export function ContextMenu({ items, children, className }: ContextMenuProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const menuRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  const handleRightClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setPos({ x: e.clientX, y: e.clientY });
      setOpen(true);
    },
    [],
  );

  useOutsideClick(menuRef, close, open);
  useEscapeKey(close, open);

  return (
    <div className={cn("db-context-menu", className)} onContextMenu={handleRightClick}>
      {children}
      {open && (
        <div
          ref={menuRef}
          className="db-context-menu__menu"
          style={{ position: "fixed", top: pos.y, left: pos.x }}
        >
          {items.map((item, i) =>
            item.divider ? (
              <hr key={i} className="db-context-menu__divider" />
            ) : (
              <button
                key={i}
                className={cn(
                  "db-context-menu__item",
                  item.disabled && "db-context-menu__item--disabled",
                )}
                onClick={() => {
                  item.onClick?.();
                  setOpen(false);
                }}
                disabled={item.disabled}
              >
                {item.label}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}

ContextMenu.displayName = "ContextMenu";
