import { forwardRef, type ReactNode, useId, useState, useRef, useCallback } from "react";
import { cn } from "../utils/cn";
import { renderOverlayTrigger, triggerId, useMenuNavigation, useMergedRefs, useOutsideClick, useEscapeKey } from "../hooks/useOverlay";

export interface DropdownMenuItem {
  label: string;
  onClick?: () => void;
  icon?: ReactNode;
  divider?: boolean;
  disabled?: boolean;
}

export interface DropdownMenuProps {
  trigger: ReactNode;
  items: DropdownMenuItem[];
  align?: "left" | "right";
  className?: string;
}

export const DropdownMenu = forwardRef<HTMLDivElement, DropdownMenuProps>(function DropdownMenu({
  trigger,
  items,
  align = "left",
  className,
}, forwardedRef) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const setRef = useMergedRefs(ref, forwardedRef);
  const menuRef = useRef<HTMLDivElement>(null);
  const id = useId();
  const labelId = triggerId(trigger, `${id}-trigger`);
  const [last, setLast] = useState(false);

  const close = useCallback(() => {
    setOpen(false);
    ref.current?.querySelector<HTMLElement>(".db-dropdown__trigger")?.focus();
  }, []);
  const dismiss = useCallback(() => setOpen(false), []);
  const handleMenuKey = useMenuNavigation(menuRef, open, close, last);

  useOutsideClick(ref, dismiss, open);
  useEscapeKey(close, open, ref);

  return (
    <div ref={setRef} data-db-react="" className={cn("db-dropdown", open && "db-dropdown--open", className)}>
      {renderOverlayTrigger(trigger, {
        id: labelId, className: "db-dropdown__trigger", "aria-haspopup": "menu", "aria-expanded": open, "aria-controls": `${id}-menu`,
        onClick: () => { setLast(false); setOpen(!open); },
        onKeyDown: (event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault(); setLast(event.key === "ArrowUp"); setOpen(true);
          }
        },
      })}
      {open && (
        <div ref={menuRef} id={`${id}-menu`} role="menu" aria-labelledby={labelId} className={cn("db-dropdown__menu", `db-dropdown__menu--${align}`)} onKeyDown={handleMenuKey}>
          {items.map((item, i) =>
            item.divider ? (
              <hr key={i} role="separator" className="db-dropdown__separator" />
            ) : (
              <button
                key={i}
                type="button"
                role="menuitem"
                tabIndex={-1}
                className={cn(
                  "db-dropdown__item",
                  item.disabled && "db-dropdown__item--disabled",
                )}
                onClick={() => {
                  item.onClick?.();
                  close();
                }}
                disabled={item.disabled}
              >
                {item.icon && (
                  <span className="db-dropdown__icon" aria-hidden="true">{item.icon}</span>
                )}
                {item.label}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
});

DropdownMenu.displayName = "DropdownMenu";
