import { forwardRef, type ComponentProps, useState, useEffect, useRef, useCallback } from "react";
import { cn } from "../utils/cn";
import { useControllable } from "../hooks/useControllable";

export interface SelectOption {
  label: string;
  value: string;
}

export interface CustomSelectProps extends Omit<ComponentProps<"div">, "onChange"> {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  searchable?: boolean;
}

export const CustomSelect = forwardRef<HTMLDivElement, CustomSelectProps>(
  ({ value, defaultValue = "", onChange, options, placeholder = "Select...", searchable = false, className, ...props }, ref) => {
    const [selected, setSelected] = useControllable(value, defaultValue, onChange);
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState("");
    const containerRef = useRef<HTMLDivElement | null>(null);

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

    const filtered = search
      ? options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))
      : options;

    const selectedLabel = options.find((o) => o.value === selected)?.label;

    return (
      <div ref={setRefs} className={cn("db-custom-select", isOpen && "db-custom-select--open", className)} {...props}>
        <button
          className="db-custom-select__trigger"
          onClick={() => setIsOpen(!isOpen)}
          type="button"
        >
          {selectedLabel || placeholder}
        </button>
        {isOpen && (
          <div className="db-custom-select__dropdown">
            {searchable && (
              <input
                className="db-input db-input--sm"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            )}
            {filtered.map((opt) => (
              <div
                key={opt.value}
                className={cn("db-custom-select__option", opt.value === selected && "db-custom-select__option--active")}
                onClick={() => {
                  setSelected(opt.value);
                  setIsOpen(false);
                  setSearch("");
                }}
              >
                {opt.label}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  },
);

CustomSelect.displayName = "CustomSelect";
