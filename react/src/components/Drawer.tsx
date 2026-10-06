import { forwardRef, type ComponentProps, type ReactNode, useContext, useRef } from "react";
import { createPortal } from "react-dom";
import { useEscapeKey, useFocusTrap, useMergedRefs } from "../hooks/useOverlay";
import { PortalThemeContext, portalTextStyle } from "./ThemeProvider";
import { cn } from "../utils/cn";

export interface DrawerProps extends Omit<ComponentProps<"div">, "onClose"> {
  open: boolean;
  onClose: () => void;
  children?: ReactNode;
}

export const Drawer = forwardRef<HTMLDivElement, DrawerProps>(function Drawer({ open, onClose, children, ...props }, forwardedRef) {
  const ref = useRef<HTMLDivElement>(null);
  const setRef = useMergedRefs(ref, forwardedRef);
  const theme = useContext(PortalThemeContext);
  useEscapeKey(onClose, open, ref);
  useFocusTrap(ref, open);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div data-db-react="" data-theme={theme} style={portalTextStyle} className="db-drawer db-drawer--open" onClick={onClose}>
      <div className="db-drawer__overlay" />
      <div
        {...props}
        ref={setRef}
        className={cn("db-drawer__panel", props.className)}
        role="dialog"
        aria-modal="true"
        aria-label={props["aria-label"] ?? (props["aria-labelledby"] ? undefined : "Drawer")}
        tabIndex={-1}
        onClick={(e) => { props.onClick?.(e); e.stopPropagation(); }}
      >
        <div className="db-drawer__handle" />
        <div className="db-drawer__body">{children}</div>
      </div>
    </div>,
    document.body
  );
});
