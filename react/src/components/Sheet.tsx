import { forwardRef, type ComponentProps, type ReactNode, useContext, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { cn } from "../utils/cn";
import { useEscapeKey, useFocusTrap, useMergedRefs } from "../hooks/useOverlay";
import { PortalThemeContext, portalTextStyle } from "./ThemeProvider";

export interface SheetProps extends Omit<ComponentProps<"div">, "onClose"> {
  open: boolean;
  onClose: () => void;
  side?: "right" | "left" | "top" | "bottom";
  title?: string;
  children?: ReactNode;
}

export const Sheet = forwardRef<HTMLDivElement, SheetProps>(function Sheet({ open, onClose, side = "right", title, children, ...props }, forwardedRef) {
  const ref = useRef<HTMLDivElement>(null);
  const setRef = useMergedRefs(ref, forwardedRef);
  const theme = useContext(PortalThemeContext);
  const titleId = useId();
  const labelledBy = props["aria-labelledby"] ?? (!props["aria-label"] && title ? titleId : undefined);
  useEscapeKey(onClose, open, ref);
  useFocusTrap(ref, open);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div data-db-react="" data-theme={theme} style={portalTextStyle} className={cn("db-sheet", `db-sheet--${side}`, "db-sheet--open")} onClick={onClose}>
      <div className="db-sheet__overlay" />
      <div
        {...props}
        ref={setRef}
        className={cn("db-sheet__panel", props.className)}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-label={props["aria-label"] ?? (labelledBy ? undefined : "Sheet")}
        tabIndex={-1}
        onClick={(e) => { props.onClick?.(e); e.stopPropagation(); }}
      >
        <div className="db-sheet__header">
          {title && <h3 id={titleId} className="db-sheet__title">{title}</h3>}
          <button type="button" className="db-sheet__close" aria-label="Close" onClick={onClose}>
            &times;
          </button>
        </div>
        <div className="db-sheet__body">{children}</div>
      </div>
    </div>,
    document.body
  );
});
