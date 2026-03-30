import { useRef } from "react";
import { createPortal } from "react-dom";
import { cn } from "../utils/cn";
import { useEscapeKey, useFocusTrap } from "../hooks/useOverlay";

export interface AlertDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
  variant?: "danger" | "warning" | "info";
}

export function AlertDialog({
  open,
  onClose,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  variant = "info",
}: AlertDialogProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEscapeKey(onClose, open);
  useFocusTrap(ref, open);

  if (!open) return null;

  return createPortal(
    <div className="db-modal-overlay db-modal-overlay--active" onClick={onClose}>
      <div
        ref={ref}
        className="db-alert-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <h3>{title}</h3>
        {description && <p>{description}</p>}
        <div className="db-modal__footer">
          <button className="db-btn db-btn--ghost" onClick={onClose}>
            {cancelLabel}
          </button>
          <button
            className={cn(
              "db-btn",
              variant === "danger" ? "db-btn--danger" : "db-btn--primary"
            )}
            onClick={() => { onConfirm?.(); onClose(); }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
