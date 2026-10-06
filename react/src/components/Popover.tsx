import { forwardRef, type ReactNode, useId, useRef, useCallback } from "react";
import { cn } from "../utils/cn";
import { useControllable } from "../hooks/useControllable";
import { renderOverlayTrigger, triggerId, useMergedRefs, useOutsideClick, useEscapeKey } from "../hooks/useOverlay";

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
    const setRefs = useMergedRefs(internalRef, forwardedRef);
    const id = useId();
    const labelId = triggerId(trigger, `${id}-trigger`);

    const [isOpen, setIsOpen] = useControllable(open, defaultOpen, onChange);

    const close = useCallback(() => {
      setIsOpen(false);
      internalRef.current?.querySelector<HTMLElement>(".db-popover__trigger")?.focus();
    }, [setIsOpen]);
    const dismiss = useCallback(() => setIsOpen(false), [setIsOpen]);
    const toggle = useCallback(() => setIsOpen(!isOpen), [setIsOpen, isOpen]);

    useOutsideClick(internalRef, dismiss, isOpen);
    useEscapeKey(close, isOpen, internalRef);

    return (
      <div ref={setRefs} data-db-react="" className={cn("db-popover", isOpen && "db-popover--open", className)}>
        {renderOverlayTrigger(trigger, {
          id: labelId, className: "db-popover__trigger", "aria-haspopup": "dialog", "aria-expanded": isOpen, "aria-controls": `${id}-content`, onClick: toggle,
        })}
        {isOpen && (
          <div
            id={`${id}-content`}
            role="dialog"
            aria-labelledby={labelId}
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
