import { forwardRef, type ReactNode, useId, useState, useRef, useCallback, useEffect } from "react";
import { cn } from "../utils/cn";
import { useMenuNavigation, useMergedRefs, useOutsideClick, useEscapeKey } from "../hooks/useOverlay";

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

export const ContextMenu = forwardRef<HTMLDivElement, ContextMenuProps>(function ContextMenu({ items, children, className }, forwardedRef) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const menuRef = useRef<HTMLDivElement>(null);
  const ref = useRef<HTMLDivElement>(null);
  const setRef = useMergedRefs(ref, forwardedRef);
  const invoker = useRef<HTMLElement | null>(null);
  const id = useId();

  const close = useCallback(() => { setOpen(false); invoker.current?.focus(); }, []);
  const dismiss = useCallback(() => setOpen(false), []);
  const handleMenuKey = useMenuNavigation(menuRef, open, close);

  const handleRightClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      invoker.current = e.target instanceof HTMLElement ? e.target.closest<HTMLElement>('button, a, input, [tabindex]') ?? ref.current : ref.current;
      setPos({ x: e.clientX, y: e.clientY });
      setOpen(true);
    },
    [],
  );

  useOutsideClick(menuRef, dismiss, open);
  useEscapeKey(close, open, menuRef);
  useEffect(() => {
    if (!open || !menuRef.current) return;
    const box = menuRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(pos.x, window.innerWidth - box.width));
    const y = Math.max(0, Math.min(pos.y, window.innerHeight - box.height));
    if (x !== pos.x || y !== pos.y) setPos({ x, y });
  }, [open, pos]);

  return (
    <div ref={setRef} data-db-react="" className={className} tabIndex={0} aria-haspopup="menu" aria-controls={`${id}-menu`} onContextMenu={handleRightClick} onKeyDown={(event) => {
      if (event.defaultPrevented || menuRef.current?.contains(event.target as Node)) return;
      if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
        event.preventDefault();
        invoker.current = document.activeElement as HTMLElement;
        const box = invoker.current.getBoundingClientRect();
        setPos({ x: box.left, y: box.bottom }); setOpen(true);
      }
    }}>
      {children}
      {open && (
        <div
          ref={menuRef}
          id={`${id}-menu`}
          role="menu"
          aria-label="Context menu"
          className="db-context-menu db-context-menu--open"
          onKeyDown={handleMenuKey}
          onClick={(event) => event.stopPropagation()}
          style={{ position: "fixed", top: pos.y, left: pos.x }}
        >
          {items.map((item, i) =>
            item.divider ? (
              <hr key={i} role="separator" className="db-context-menu__separator" />
            ) : (
              <button
                key={i}
                type="button"
                role="menuitem"
                tabIndex={-1}
                className={cn(
                  "db-context-menu__item",
                  item.disabled && "db-context-menu__item--disabled",
                )}
                onClick={() => {
                  item.onClick?.();
                  close();
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
});

ContextMenu.displayName = "ContextMenu";
