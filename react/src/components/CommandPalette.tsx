import { useState, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { cn } from "../utils/cn";
import { useFocusTrap, useEscapeKey } from "../hooks/useOverlay";

export interface CommandItem {
  label: string;
  shortcut?: string;
  onClick?: () => void;
}

export interface CommandGroup {
  label: string;
  items: CommandItem[];
}

export interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  groups: CommandGroup[];
  placeholder?: string;
  className?: string;
}

export function CommandPalette({
  open,
  onClose,
  groups,
  placeholder = "Type a command...",
  className,
}: CommandPaletteProps) {
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEscapeKey(onClose, open);
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

  if (!open) return null;

  return createPortal(
    <div className="db-modal-overlay db-modal-overlay--active" onClick={onClose}>
      <div
        ref={ref}
        className={cn("db-command", "db-command--active", className)}
        onClick={(e) => e.stopPropagation()}
      >
        <input
          className="db-command__input"
          placeholder={placeholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />
        <div className="db-command__list">
          {filteredGroups.map((g) => (
            <div key={g.label} className="db-command__group">
              <div className="db-command__group-label">{g.label}</div>
              {g.items.map((item) => (
                <button
                  key={item.label}
                  className="db-command__item"
                  onClick={() => {
                    item.onClick?.();
                    onClose();
                  }}
                >
                  <span>{item.label}</span>
                  {item.shortcut && <kbd className="db-kbd">{item.shortcut}</kbd>}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}

CommandPalette.displayName = "CommandPalette";
