import { forwardRef, type ReactNode, useCallback, useId, useRef, useState } from "react";
import { cn } from "../utils/cn";
import { renderOverlayTrigger, useEscapeKey, useMergedRefs } from "../hooks/useOverlay";

export type TooltipPosition = "top" | "bottom" | "left" | "right";

export interface TooltipProps {
  content: ReactNode;
  position?: TooltipPosition;
  children: ReactNode;
  className?: string;
}

export const Tooltip = forwardRef<HTMLDivElement, TooltipProps>(function Tooltip({
  content,
  position = "top",
  children,
  className,
}, forwardedRef) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const setRef = useMergedRefs(ref, forwardedRef);
  const id = useId();
  const close = useCallback(() => setVisible(false), []);
  useEscapeKey(close, visible, ref);

  return (
    <div ref={setRef} data-db-react="" className={cn("db-tooltip", visible && "db-tooltip--open", className)}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => { if (!ref.current?.contains(document.activeElement)) close(); }}>
      {renderOverlayTrigger(children, {
        className: "db-tooltip__trigger", "aria-describedby": visible ? id : undefined,
        onFocus: () => setVisible(true), onBlur: close,
      })}
      {visible && (
        <div
          className={cn("db-tooltip__content", `db-tooltip__content--${position}`)}
          role="tooltip"
          id={id}
        >
          {content}
        </div>
      )}
    </div>
  );
});

Tooltip.displayName = "Tooltip";
