import { forwardRef, type ComponentProps, useState, useEffect, useRef, useCallback, useId } from "react";
import { cn } from "../utils/cn";
import { useControllable } from "../hooks/useControllable";
import { Calendar } from "./Calendar";

export interface DatePickerProps extends Omit<ComponentProps<"div">, "onChange"> {
  value?: string;
  defaultValue?: string;
  onChange?: (date: string) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  name?: string;
  min?: string;
  max?: string;
  inputProps?: Omit<ComponentProps<"input">, "value" | "defaultValue" | "onChange">;
}

export const DatePicker = forwardRef<HTMLDivElement, DatePickerProps>(
  ({ value, defaultValue = "", onChange, label, placeholder = "Select date", disabled, name, min, max, inputProps, className, onKeyDown, onBlur, ...props }, ref) => {
    const [val, setVal] = useControllable(value, defaultValue, onChange);
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const inputRef = useRef<HTMLInputElement | null>(null);
    const id = useId();
    const inputId = inputProps?.id ?? `${id}-input`;
    const blocked = disabled || inputProps?.disabled;
    const close = () => { setIsOpen(false); inputRef.current?.focus(); };
    useEffect(() => {
      if (blocked) { setIsOpen(false); return; }
      if (isOpen) containerRef.current?.querySelector<HTMLButtonElement>('.db-calendar__day[tabindex="0"]')?.focus();
    }, [isOpen, blocked]);

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
        }
      };
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }, [isOpen]);

    return (
      <div ref={setRefs} className={cn("db-date-picker", isOpen && !blocked && "db-date-picker--open", className)} {...props}
        data-db-react=""
        onKeyDown={(event) => {
          onKeyDown?.(event);
          if (event.defaultPrevented || blocked) return;
          if (event.key === "Escape" && isOpen) { event.preventDefault(); event.stopPropagation(); close(); }
          else if (event.target === inputRef.current && ["ArrowDown", "Enter", " "].includes(event.key)) {
            event.preventDefault();
            setIsOpen(true);
          }
        }}
        onBlur={(event) => {
          onBlur?.(event);
          if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) setIsOpen(false);
        }}>
        {label && <label className="db-label" htmlFor={inputId}>{label}</label>}
        <input
          {...inputProps}
          ref={inputRef}
          id={inputId}
          name={name ?? inputProps?.name}
          className={cn("db-input db-date-picker__trigger", inputProps?.className)}
          role="combobox"
          aria-label={inputProps?.["aria-label"] ?? props["aria-label"] ?? (label ? undefined : placeholder)}
          aria-labelledby={inputProps?.["aria-labelledby"] ?? props["aria-labelledby"]}
          aria-describedby={inputProps?.["aria-describedby"] ?? props["aria-describedby"]}
          aria-haspopup="dialog"
          aria-controls={isOpen && !blocked ? `${id}-dialog` : undefined}
          aria-expanded={isOpen && !blocked}
          disabled={blocked}
          value={val}
          placeholder={placeholder}
          readOnly
          onClick={(event) => { inputProps?.onClick?.(event); if (!event.defaultPrevented && !blocked) setIsOpen(!isOpen); }}
          onKeyDown={(event) => inputProps?.onKeyDown?.(event)}
        />
        {isOpen && !blocked && (
          <div id={`${id}-dialog`} className="db-date-picker__dropdown" role="dialog" aria-label={label ?? props["aria-label"] ?? "Choose date"}>
            <Calendar
              selected={val}
              min={min}
              max={max}
              onChange={(date) => {
                setVal(date);
                close();
              }}
            />
          </div>
        )}
      </div>
    );
  },
);

DatePicker.displayName = "DatePicker";
