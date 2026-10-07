import { forwardRef, type ComponentProps, useContext, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { cn } from "../utils/cn";
import { useEscapeKey, useFocusTrap, useMergedRefs } from "../hooks/useOverlay";
import { PortalThemeContext, portalTextStyle } from "./ThemeProvider";

export interface AlertDialogProps extends Omit<ComponentProps<"div">, "onClose"> {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
  variant?: "danger" | "warning" | "info";
}

export const AlertDialog = forwardRef<HTMLDivElement, AlertDialogProps>(function AlertDialog({
  open,
  onClose,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  variant = "info",
  ...props
}, forwardedRef) {
  const ref = useRef<HTMLDivElement>(null);
  const setRef = useMergedRefs(ref, forwardedRef);
  const theme = useContext(PortalThemeContext);
  const titleId = useId();
  const descriptionId = useId();
  useEscapeKey(onClose, open, ref);
  useFocusTrap(ref, open);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div data-db-react="" data-theme={theme} style={portalTextStyle} className="db-alert-dialog db-alert-dialog--open" onClick={onClose}>
      <div className="db-alert-dialog__overlay" />
      <div
        {...props}
        ref={setRef}
        className={cn("db-alert-dialog__panel", props.className)}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={props["aria-labelledby"] ?? (props["aria-label"] ? undefined : titleId)}
        aria-describedby={[props["aria-describedby"], description ? descriptionId : undefined].filter(Boolean).join(" ") || undefined}
        tabIndex={-1}
        onClick={(e) => { props.onClick?.(e); e.stopPropagation(); }}
      >
        <h3 id={titleId} className="db-alert-dialog__title">{title}</h3>
        {description && <p id={descriptionId} className="db-alert-dialog__desc">{description}</p>}
        <div className="db-alert-dialog__actions">
          <button type="button" className="db-btn db-btn--ghost" onClick={onClose}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className="db-btn db-btn--primary"
            onClick={() => { onConfirm?.(); onClose(); }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
});
