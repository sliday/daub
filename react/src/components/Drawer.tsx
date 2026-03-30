import { type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useEscapeKey } from "../hooks/useOverlay";

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  children?: ReactNode;
}

export function Drawer({ open, onClose, children }: DrawerProps) {
  useEscapeKey(onClose, open);

  if (!open) return null;

  return createPortal(
    <div className="db-drawer-overlay" onClick={onClose}>
      <div
        className="db-drawer db-drawer--active"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="db-drawer__handle" />
        <div className="db-drawer__body">{children}</div>
      </div>
    </div>,
    document.body
  );
}
