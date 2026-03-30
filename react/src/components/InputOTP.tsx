import { forwardRef, useRef, useCallback, type ComponentProps, type KeyboardEvent } from "react";
import { cn } from "../utils/cn";
import { useControllable } from "../hooks/useControllable";

export interface InputOTPProps extends Omit<ComponentProps<"div">, "onChange" | "defaultValue"> {
  length?: number;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  separator?: number;
}

export const InputOTP = forwardRef<HTMLDivElement, InputOTPProps>(
  ({ length = 6, value, defaultValue, onChange, separator, className, ...props }, ref) => {
    const [val, setVal] = useControllable(value, defaultValue ?? "", onChange);
    const slotsRef = useRef<(HTMLInputElement | null)[]>([]);

    const focusSlot = useCallback((i: number) => {
      slotsRef.current[i]?.focus();
    }, []);

    const handleInput = useCallback(
      (i: number, char: string) => {
        const chars = val.split("");
        while (chars.length < length) chars.push("");
        chars[i] = char;
        const next = chars.join("");
        setVal(next);
        if (char && i < length - 1) focusSlot(i + 1);
      },
      [val, length, setVal, focusSlot],
    );

    const handleKeyDown = useCallback(
      (i: number, e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Backspace") {
          e.preventDefault();
          const chars = val.split("");
          while (chars.length < length) chars.push("");
          if (chars[i]) {
            chars[i] = "";
            setVal(chars.join(""));
          } else if (i > 0) {
            chars[i - 1] = "";
            setVal(chars.join(""));
            focusSlot(i - 1);
          }
        } else if (e.key === "ArrowLeft" && i > 0) {
          focusSlot(i - 1);
        } else if (e.key === "ArrowRight" && i < length - 1) {
          focusSlot(i + 1);
        }
      },
      [val, length, setVal, focusSlot],
    );

    const slots = Array.from({ length }, (_, i) => {
      const slot = (
        <input
          key={i}
          ref={(el) => { slotsRef.current[i] = el; }}
          className="db-otp__slot"
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={val[i] ?? ""}
          onChange={(e) => handleInput(i, e.target.value.slice(-1))}
          onKeyDown={(e) => handleKeyDown(i, e)}
        />
      );

      if (separator !== undefined && i === separator - 1 && i < length - 1) {
        return (
          <span key={`s${i}`} className="db-otp__group">
            {slot}
            <span className="db-otp__separator" aria-hidden="true">-</span>
          </span>
        );
      }

      return slot;
    });

    return (
      <div ref={ref} className={cn("db-otp", className)} {...props}>
        {slots}
      </div>
    );
  },
);

InputOTP.displayName = "InputOTP";
