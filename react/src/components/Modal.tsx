import { type ReactNode, useRef } from "react";
import { createPortal } from "react-dom";
import { cn } from "../utils/cn";
import { useEscapeKey, useFocusTrap } from "../hooks/useOverlay";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  footer?: ReactNode;
  className?: string;
  children?: ReactNode;
}

export function Modal({ open, onClose, title, footer, className, children }: ModalProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEscapeKey(onClose, open);
  useFocusTrap(ref, open);

  if (!open) return null;

  return createPortal(
    <div className="db-modal-overlay db-modal-overlay--active" onClick={onClose}>
      <div
        ref={ref}
        className={cn("db-modal db-modal--active", className)}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="db-modal__header">
            <h3>{title}</h3>
            <button className="db-btn db-btn--ghost db-btn--icon" onClick={onClose}>
              &times;
            </button>
          </div>
        )}
        <div className="db-modal__body">{children}</div>
        {footer && <div className="db-modal__footer">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}
