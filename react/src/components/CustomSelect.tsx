import { forwardRef, type ComponentProps, useId, useState, useEffect, useRef, useCallback } from "react";
import { cn } from "../utils/cn";
import { useControllable } from "../hooks/useControllable";

export interface SelectOption {
  label: string;
  value: string;
  disabled?: boolean;
}

export interface CustomSelectProps extends Omit<ComponentProps<"div">, "onChange"> {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  searchable?: boolean;
  disabled?: boolean;
}

export const CustomSelect = forwardRef<HTMLDivElement, CustomSelectProps>(
  ({ value, defaultValue = "", onChange, options, placeholder = "Select...", searchable = false, disabled = false, className, onKeyDown, ...props }, ref) => {
    const [selected, setSelected] = useControllable(value, defaultValue, onChange);
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState("");
    const containerRef = useRef<HTMLDivElement | null>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const searchRef = useRef<HTMLInputElement>(null);
    const id = useId();
    const [activeIndex, setActiveIndex] = useState(-1);

    const setRefs = useCallback(
      (node: HTMLDivElement | null) => {
        containerRef.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
      },
      [ref],
    );

    useEffect(() => {
      if (!isOpen) return;
      const handleClick = (e: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
          setIsOpen(false);
          setSearch("");
        }
      };
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }, [isOpen]);

    useEffect(() => {
      if (isOpen && searchable) searchRef.current?.focus();
    }, [isOpen, searchable]);

    const filtered = search
      ? options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))
      : options;

    const selectedLabel = options.find((o) => o.value === selected)?.label;
    const activeOption = filtered[activeIndex];
    const activeId = activeOption && !activeOption.disabled ? `${id}-option-${options.indexOf(activeOption)}` : undefined;
    const isDisabled = disabled || props["aria-disabled"] === true || props["aria-disabled"] === "true";
    useEffect(() => {
      if (isDisabled) { setIsOpen(false); setSearch(""); }
    }, [isDisabled]);
    useEffect(() => {
      if (isOpen && activeId) document.getElementById(activeId)?.scrollIntoView({ block: "nearest" });
    }, [activeId, isOpen]);

    const close = (restoreFocus = false) => {
      setIsOpen(false);
      setSearch("");
      if (restoreFocus) triggerRef.current?.focus();
    };
    const choose = (option: SelectOption) => {
      if (isDisabled || option.disabled) return;
      setSelected(option.value);
      close(true);
    };
    const move = (direction: number) => {
      const enabled = filtered.map((option, index) => option.disabled ? -1 : index).filter((index) => index >= 0);
      if (!enabled.length) { setActiveIndex(-1); return; }
      const index = enabled.indexOf(isOpen ? activeIndex : filtered.findIndex((option) => option.value === selected));
      const nextIndex = index < 0 ? (direction > 0 ? 0 : enabled.length - 1) : (index + direction + enabled.length) % enabled.length;
      setActiveIndex(enabled[nextIndex]);
    };

    return (
      <div ref={setRefs} data-db-react="" className={cn("db-custom-select", isOpen && "db-custom-select--open", className)} {...props} onKeyDown={(event) => {
        onKeyDown?.(event);
        if (event.defaultPrevented || isDisabled) return;
        if (event.key === "Escape" && isOpen) {
          event.preventDefault();
          event.stopPropagation();
          close(true);
        } else if (event.key === "Tab") {
          close();
        } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          move(event.key === "ArrowDown" ? 1 : -1);
          setIsOpen(true);
        } else if (isOpen && (event.key === "Home" || event.key === "End") && event.target === triggerRef.current) {
          event.preventDefault();
          const indices = filtered.map((option, index) => option.disabled ? -1 : index).filter((index) => index >= 0);
          setActiveIndex(event.key === "Home" ? indices[0] ?? -1 : indices[indices.length - 1] ?? -1);
        } else if (isOpen && (event.key === "Enter" || (event.key === " " && event.target === triggerRef.current))) {
          event.preventDefault();
          if (activeOption) choose(activeOption);
        }
      }}>
        <button
          ref={triggerRef}
          className="db-custom-select__trigger"
          role="combobox"
          aria-label={props["aria-label"]}
          aria-labelledby={props["aria-labelledby"]}
          aria-describedby={props["aria-describedby"]}
          aria-haspopup="listbox"
          aria-controls={`${id}-listbox`}
          aria-expanded={isOpen}
          aria-activedescendant={isOpen && !searchable ? activeId : undefined}
          disabled={isDisabled}
          onClick={() => {
            if (isOpen) close();
            else {
              setActiveIndex(filtered.findIndex((option) => option.value === selected && !option.disabled));
              setIsOpen(true);
            }
          }}
          type="button"
        >
          <span className={selectedLabel ? "db-custom-select__value" : "db-custom-select__placeholder"}>{selectedLabel || placeholder}</span>
        </button>
        {isOpen && (
          <div className="db-custom-select__dropdown">
            {searchable && (
              <div className="db-custom-select__search">
                <input
                  ref={searchRef}
                  className="db-input db-input--sm"
                  aria-label="Search options"
                  aria-controls={`${id}-listbox`}
                  aria-activedescendant={activeId}
                  placeholder="Search..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setActiveIndex(-1);
                  }}
                />
              </div>
            )}
            <div id={`${id}-listbox`} role="listbox" aria-label={props["aria-label"] ?? "Options"}>
              {filtered.map((opt) => (
                <div
                  key={opt.value}
                  id={`${id}-option-${options.indexOf(opt)}`}
                  role="option"
                  aria-selected={opt.value === selected}
                  aria-disabled={opt.disabled || undefined}
                  style={opt === activeOption && !opt.disabled ? { boxShadow: "var(--db-focus-ring)" } : undefined}
                  className={cn("db-custom-select__option", opt.value === selected && "db-custom-select__option--selected", opt.disabled && "db-custom-select__option--disabled")}
                  onClick={() => choose(opt)}
                  onMouseEnter={() => { if (!opt.disabled) setActiveIndex(filtered.indexOf(opt)); }}
                >
                  {opt.label}
                </div>
              ))}
              {!filtered.length && <div role="status" className="db-custom-select__option">No options found</div>}
            </div>
          </div>
        )}
      </div>
    );
  },
);

CustomSelect.displayName = "CustomSelect";
