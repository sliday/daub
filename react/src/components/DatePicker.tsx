import { forwardRef, type ComponentProps, useState, useEffect, useRef, useCallback } from "react";
import { cn } from "../utils/cn";
import { useControllable } from "../hooks/useControllable";
import { Calendar } from "./Calendar";

export interface DatePickerProps extends Omit<ComponentProps<"div">, "onChange"> {
  value?: string;
  defaultValue?: string;
  onChange?: (date: string) => void;
  label?: string;
  placeholder?: string;
}

export const DatePicker = forwardRef<HTMLDivElement, DatePickerProps>(
  ({ value, defaultValue = "", onChange, label, placeholder = "Select date", className, ...props }, ref) => {
    const [val, setVal] = useControllable(value, defaultValue, onChange);
    const [isOpen, setIsOpen] = useState(false);
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
        }
      };
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }, [isOpen]);

    return (
      <div ref={setRefs} className={cn("db-date-picker", className)} {...props}>
        {label && <label className="db-label">{label}</label>}
        <input
          className="db-input"
          value={val}
          placeholder={placeholder}
          readOnly
          onClick={() => setIsOpen(!isOpen)}
        />
        {isOpen && (
          <div className="db-date-picker__dropdown">
            <Calendar
              selected={val}
              onChange={(date) => {
                setVal(date);
                setIsOpen(false);
              }}
            />
          </div>
        )}
      </div>
    );
  },
);

DatePicker.displayName = "DatePicker";
