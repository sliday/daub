import { forwardRef, type ComponentProps, type ReactNode, useContext, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { cn } from "../utils/cn";
import { useEscapeKey, useFocusTrap, useMergedRefs } from "../hooks/useOverlay";
import { PortalThemeContext, portalTextStyle } from "./ThemeProvider";

export interface ModalProps extends Omit<ComponentProps<"div">, "onClose"> {
  open: boolean;
  onClose: () => void;
  title?: string;
  footer?: ReactNode;
  className?: string;
  children?: ReactNode;
}

export const Modal = forwardRef<HTMLDivElement, ModalProps>(function Modal({ open, onClose, title, footer, className, children, ...props }, forwardedRef) {
  const ref = useRef<HTMLDivElement>(null);
  const setRef = useMergedRefs(ref, forwardedRef);
  const theme = useContext(PortalThemeContext);
  const titleId = useId();
  const labelledBy = props["aria-labelledby"] ?? (!props["aria-label"] && title ? titleId : undefined);
  useEscapeKey(onClose, open, ref);
  useFocusTrap(ref, open);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div data-db-react="" data-theme={theme} style={portalTextStyle} className="db-modal-overlay db-modal--open" onClick={onClose}>
      <div
        {...props}
        ref={setRef}
        className={cn("db-modal", className)}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-label={props["aria-label"] ?? (labelledBy ? undefined : "Dialog")}
        tabIndex={-1}
        onClick={(e) => { props.onClick?.(e); e.stopPropagation(); }}
      >
        {title && (
          <div className="db-modal__header">
            <h3 id={titleId} className="db-modal__title">{title}</h3>
            <button type="button" className="db-modal__close" aria-label="Close" onClick={onClose}>
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
});
