import { forwardRef, type ReactNode, useRef, useCallback } from "react";
import { cn } from "../utils/cn";
import { useControllable } from "../hooks/useControllable";
import { useOutsideClick, useEscapeKey } from "../hooks/useOverlay";

export type PopoverPosition = "top" | "bottom" | "left" | "right";

export interface PopoverProps {
  trigger: ReactNode;
  content: ReactNode;
  position?: PopoverPosition;
  open?: boolean;
  defaultOpen?: boolean;
  onChange?: (open: boolean) => void;
  className?: string;
}

export const Popover = forwardRef<HTMLDivElement, PopoverProps>(
  (
    {
      trigger,
      content,
      position = "bottom",
      open,
      defaultOpen = false,
      onChange,
      className,
    },
    forwardedRef,
  ) => {
    const internalRef = useRef<HTMLDivElement>(null);
    const ref = (forwardedRef as React.RefObject<HTMLDivElement>) || internalRef;

    const [isOpen, setIsOpen] = useControllable(open, defaultOpen, onChange);

    const close = useCallback(() => setIsOpen(false), [setIsOpen]);
    const toggle = useCallback(() => setIsOpen(!isOpen), [setIsOpen, isOpen]);

    useOutsideClick(ref, close, isOpen);
    useEscapeKey(close, isOpen);

    return (
      <div ref={ref} className={cn("db-popover", className)}>
        <div className="db-popover__trigger" onClick={toggle}>
          {trigger}
        </div>
        {isOpen && (
          <div
            className={cn(
              "db-popover__content",
              `db-popover__content--${position}`,
            )}
          >
            {content}
          </div>
        )}
      </div>
    );
  },
);

Popover.displayName = "Popover";
