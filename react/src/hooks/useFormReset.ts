import { useEffect, useRef, type RefObject } from "react";
import { useControllable } from "./useControllable";

export function useFormReset(ref: RefObject<HTMLElement | null>, reset: () => void, enabled = true) {
  const resetRef = useRef(reset);
  const enabledRef = useRef(enabled);
  resetRef.current = reset;
  enabledRef.current = enabled;

  useEffect(() => {
    const node = ref.current;
    if (!node || !enabled) return;
    const form = (node as HTMLInputElement).form ?? node.closest("form");
    if (!form) return;
    const handleReset = (event: Event) => {
      // Wait for cancellation and the browser's native reset before updating React.
      queueMicrotask(() => {
        if (!event.defaultPrevented && enabledRef.current && ref.current === node) resetRef.current();
      });
    };
    form.addEventListener("reset", handleReset);
    return () => form.removeEventListener("reset", handleReset);
  });
}

export function useResettableControl<T>(controlled: T | undefined, defaultValue: T, onChange: ((value: T) => void) | undefined, ref: RefObject<HTMLElement | null>) {
  const resetting = useRef(false);
  const state = useControllable(controlled, defaultValue, (value) => {
    if (!resetting.current) onChange?.(value);
  });
  useFormReset(ref, () => {
    resetting.current = true;
    try { state[1](defaultValue); }
    finally { resetting.current = false; }
  }, controlled === undefined);
  return state;
}
