import { forwardRef, useCallback, useId, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { cn } from "../utils/cn";
import { renderOverlayTrigger, useEscapeKey, useMergedRefs } from "../hooks/useOverlay";

export interface HoverCardProps extends Omit<ComponentProps<"div">, "content"> {
  trigger: ReactNode;
  content: ReactNode;
}

export const HoverCard = forwardRef<HTMLDivElement, HoverCardProps>(
  ({ trigger, content, className, children, onMouseEnter, onMouseLeave, onFocus, onBlur, ...props }, forwardedRef) => {
    const ref = useRef<HTMLDivElement>(null);
    const setRef = useMergedRefs(ref, forwardedRef);
    const id = useId();
    const [open, setOpen] = useState(false);
    const close = useCallback(() => setOpen(false), []);
    useEscapeKey(close, open, ref);
    return (
      <div ref={setRef} data-db-react="" {...props} className={cn("db-hover-card", open && "db-hover-card--open", className)}
        onMouseEnter={(event) => { onMouseEnter?.(event); if (!event.defaultPrevented) setOpen(true); }}
        onMouseLeave={(event) => { onMouseLeave?.(event); if (!event.defaultPrevented && !ref.current?.contains(document.activeElement)) close(); }}
        onFocus={(event) => { onFocus?.(event); if (!event.defaultPrevented) setOpen(true); }}
        onBlur={(event) => { onBlur?.(event); if (!event.defaultPrevented && !event.currentTarget.contains(event.relatedTarget as Node | null)) close(); }}>
        {renderOverlayTrigger(trigger, { className: "db-hover-card__trigger", "aria-describedby": open ? id : undefined })}
        {open && <div id={id} className="db-hover-card__content">{content}{children}</div>}
      </div>
    );
  },
);

HoverCard.displayName = "HoverCard";
