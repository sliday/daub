import { forwardRef, useCallback, useRef, useState, type ComponentProps, type KeyboardEvent } from "react";
import { cn } from "../utils/cn";
import { useFormReset } from "../hooks/useFormReset";

export interface InputOTPProps extends Omit<ComponentProps<"div">, "onChange" | "defaultValue"> {
  length?: number;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  separator?: number;
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  name?: string;
}

export const InputOTP = forwardRef<HTMLDivElement, InputOTPProps>(
  ({ length = 6, value, defaultValue = "", onChange, separator, disabled, readOnly, required, name, className, onKeyDown, onPaste, ...props }, ref) => {
    const count = Number.isFinite(length) ? Math.max(1, Math.trunc(length)) : 6;
    const digits = (text: string) => text.replace(/[^0-9]/g, "").slice(0, count);
    const [internal, setInternal] = useState(() => digits(defaultValue).split(""));
    const pending = useRef<{ value: string; slots: string[] } | null>(null);
    const slotsRef = useRef<(HTMLInputElement | null)[]>([]);
    const rootRef = useRef<HTMLDivElement | null>(null);
    const setRef = useCallback((node: HTMLDivElement | null) => {
      rootRef.current = node;
      if (typeof ref === "function") {
        const cleanup: unknown = ref(node);
        if (typeof cleanup === "function") return () => { rootRef.current = null; cleanup(); };
      }
      else if (ref) ref.current = node;
    }, [ref]);
    useFormReset(rootRef, () => {
      pending.current = null;
      setInternal(digits(defaultValue).split(""));
    }, value === undefined);
    const source = value === undefined ? internal : pending.current?.value === value ? pending.current.slots : digits(value).split("");
    const values = Array.from({ length: count }, (_, i) => source[i] ?? "");
    const blocked = disabled || readOnly || props["aria-disabled"] === true || props["aria-disabled"] === "true";
    const focusSlot = (index: number) => { slotsRef.current[index]?.focus(); slotsRef.current[index]?.select(); };
    const update = (next: string[]) => {
      if (blocked) return;
      const nextValue = next.join("");
      pending.current = { value: nextValue, slots: next };
      if (value === undefined) setInternal(next);
      onChange?.(nextValue);
    };
    const handleInput = (index: number, text: string) => {
      if (blocked) return;
      const incoming = digits(text);
      if (text && !incoming) return;
      const next = [...values];
      if (!incoming) next[index] = "";
      else incoming.split("").slice(0, count - index).forEach((char, offset) => { next[index + offset] = char; });
      update(next);
      if (incoming) focusSlot(Math.min(count - 1, index + incoming.length));
    };
    const handleKeyDown = (index: number, event: KeyboardEvent<HTMLElement>) => {
      if (event.defaultPrevented) return;
      if (event.key === "ArrowLeft" || event.key === "ArrowRight" || event.key === "Home" || event.key === "End") {
        event.preventDefault();
        const next = event.key === "Home" ? 0 : event.key === "End" ? count - 1 : index + (event.key === "ArrowLeft" ? -1 : 1);
        focusSlot(Math.max(0, Math.min(count - 1, next)));
      } else if (!blocked && (event.key === "Backspace" || event.key === "Delete")) {
        event.preventDefault();
        const next = [...values];
        const target = event.key === "Backspace" && !next[index] && index > 0 ? index - 1 : index;
        next[target] = "";
        update(next);
        focusSlot(target);
      }
    };

    const slots = values.map((char, i) => {
      const slot = (
        <input
          key={i}
          ref={(el) => { slotsRef.current[i] = el; }}
          className="db-otp__input db-otp__slot"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={count}
          disabled={disabled}
          readOnly={readOnly}
          required={required}
          aria-label={`Digit ${i + 1} of ${count}`}
          aria-invalid={props["aria-invalid"]}
          aria-describedby={props["aria-describedby"]}
          value={char}
          onFocus={(event) => event.target.select()}
          onChange={(e) => handleInput(i, e.target.value)}
        />
      );

      if (separator !== undefined && i === separator - 1 && i < count - 1) {
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
      <div ref={setRef} className={cn("db-otp", className)} role="group" aria-label="Verification code" {...props} data-db-react=""
        onKeyDown={(event) => {
          onKeyDown?.(event);
          const index = slotsRef.current.indexOf(event.target as HTMLInputElement);
          if (!event.defaultPrevented && index >= 0) handleKeyDown(index, event);
        }}
        onPaste={(event) => {
          onPaste?.(event);
          const index = slotsRef.current.indexOf(event.target as HTMLInputElement);
          if (event.defaultPrevented || index < 0) return;
          event.preventDefault();
          handleInput(index, event.clipboardData.getData("text"));
        }}>
        {name && <input type="hidden" name={name} value={values.join("")} disabled={disabled} />}
        {slots}
      </div>
    );
  },
);

InputOTP.displayName = "InputOTP";
