import { forwardRef, useState, useRef, useMemo, useContext, useEffect, useId, type ComponentProps } from "react";
import { createPortal } from "react-dom";
import { cn } from "../utils/cn";
import { useFocusTrap, useEscapeKey, useMergedRefs } from "../hooks/useOverlay";
import { PortalThemeContext, portalTextStyle } from "./ThemeProvider";

export interface CommandItem {
  label: string;
  shortcut?: string;
  onClick?: () => void;
  disabled?: boolean;
}

export interface CommandGroup {
  label: string;
  items: CommandItem[];
}

export interface CommandPaletteProps extends Omit<ComponentProps<"div">, "onClose"> {
  open: boolean;
  onClose: () => void;
  groups: CommandGroup[];
  placeholder?: string;
  className?: string;
}

export const CommandPalette = forwardRef<HTMLDivElement, CommandPaletteProps>(function CommandPalette({
  open,
  onClose,
  groups,
  placeholder = "Type a command...",
  className,
  ...props
}, forwardedRef) {
  const [search, setSearch] = useState("");
  const [active, setActive] = useState(-1);
  const [previousOpen, setPreviousOpen] = useState(open);
  if (open !== previousOpen) {
    setPreviousOpen(open);
    if (open) { setSearch(""); setActive(-1); }
  }
  const ref = useRef<HTMLDivElement>(null);
  const setRef = useMergedRefs(ref, forwardedRef);
  const theme = useContext(PortalThemeContext);
  const id = useId();

  useEscapeKey(onClose, open, ref);
  useFocusTrap(ref, open);

  const filteredGroups = useMemo(() => {
    if (!search) return groups;
    const q = search.toLowerCase();
    return groups
      .map((g) => ({
        ...g,
        items: g.items.filter((item) => item.label.toLowerCase().includes(q)),
      }))
      .filter((g) => g.items.length > 0);
  }, [groups, search]);

  const items = filteredGroups.flatMap((group) => group.items);
  const activeItem = items[active];
  useEffect(() => {
    if (open && active >= 0) ref.current?.querySelector(`[id="${id}-option-${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, id, open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div data-db-react="" data-theme={theme} style={portalTextStyle} className={cn("db-command", "db-command--open", className)} onClick={onClose}>
      <div className="db-command__overlay" />
      <div
        {...props}
        ref={setRef}
        className="db-command__panel"
        role="dialog"
        aria-modal="true"
        aria-label={props["aria-label"] ?? (props["aria-labelledby"] ? undefined : "Commands")}
        tabIndex={-1}
        onClick={(e) => { props.onClick?.(e); e.stopPropagation(); }}
        onKeyDown={(event) => {
          props.onKeyDown?.(event);
          if (event.defaultPrevented || event.target !== ref.current?.querySelector(".db-command__input")) return;
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            const enabled = items.map((item, index) => item.disabled ? -1 : index).filter((index) => index >= 0);
            if (!enabled.length) return;
            const current = enabled.indexOf(active);
            const next = current < 0 ? (event.key === "ArrowDown" ? 0 : enabled.length - 1) : (current + (event.key === "ArrowDown" ? 1 : -1) + enabled.length) % enabled.length;
            setActive(enabled[next]);
          } else if (event.key === "Enter") {
            event.preventDefault();
            const item = activeItem ?? items.find((item) => !item.disabled);
            if (item && !item.disabled) { item.onClick?.(); onClose(); }
          }
        }}
      >
        <div className="db-command__input-wrap">
        <input
          className="db-command__input"
          role="combobox"
          aria-label="Search commands"
          aria-expanded="true"
          aria-controls={`${id}-listbox`}
          aria-autocomplete="list"
          aria-activedescendant={activeItem && !activeItem.disabled ? `${id}-option-${active}` : undefined}
          placeholder={placeholder}
          value={search}
          onChange={(e) => { setSearch(e.target.value); setActive(-1); }}
          autoFocus
        />
        </div>
        <div id={`${id}-listbox`} className="db-command__list" role="listbox" aria-label="Commands">
          {filteredGroups.map((g, groupIndex) => (
            <div key={g.label} className="db-command__group" role="group" aria-labelledby={`${id}-group-${groupIndex}`}>
              <div id={`${id}-group-${groupIndex}`} className="db-command__group-label">{g.label}</div>
              {g.items.map((item) => {
                const index = items.indexOf(item);
                return (
                <button
                  key={item.label}
                  id={`${id}-option-${index}`}
                  type="button"
                  role="option"
                  aria-selected={index === active}
                  disabled={item.disabled}
                  tabIndex={-1}
                  className={cn("db-command__item", index === active && "db-command__item--active")}
                  onMouseEnter={() => { if (!item.disabled) setActive(index); }}
                  onClick={() => {
                    item.onClick?.();
                    onClose();
                  }}
                >
                  <span>{item.label}</span>
                  {item.shortcut && <kbd className="db-command__shortcut">{item.shortcut}</kbd>}
                </button>
                );
              })}
            </div>
          ))}
          {!items.length && <div className="db-command__empty" role="status">No commands found</div>}
        </div>
      </div>
    </div>,
    document.body,
  );
});

CommandPalette.displayName = "CommandPalette";
