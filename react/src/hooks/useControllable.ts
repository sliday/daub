import { useState, useCallback, useRef } from "react";

export function useControllable<T>(
  controlled: T | undefined,
  defaultValue: T,
  onChange?: (value: T) => void
): [T, (next: T) => void] {
  const isControlled = controlled !== undefined;
  const [internal, setInternal] = useState(defaultValue);
  const value = isControlled ? controlled : internal;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const setValue = useCallback(
    (next: T) => {
      if (!isControlled) setInternal(next);
      onChangeRef.current?.(next);
    },
    [isControlled]
  );

  return [value, setValue];
}
