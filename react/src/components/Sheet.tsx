import { type ReactNode, useRef } from "react";
import { createPortal } from "react-dom";
import { cn } from "../utils/cn";
import { useEscapeKey } from "../hooks/useOverlay";

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  side?: "right" | "left" | "top" | "bottom";
  title?: string;
  children?: ReactNode;
}

export function Sheet({ open, onClose, side = "right", title, children }: SheetProps) {
  useEscapeKey(onClose, open);

  if (!open) return null;

  return createPortal(
    <div className="db-sheet-overlay" onClick={onClose}>
      <div
        className={cn("db-sheet", `db-sheet--${side}`, "db-sheet--active")}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="db-sheet__header">
          {title && <h3>{title}</h3>}
          <button className="db-btn db-btn--ghost db-btn--icon" onClick={onClose}>
            &times;
          </button>
        </div>
        <div className="db-sheet__body">{children}</div>
      </div>
    </div>,
    document.body
  );
}
