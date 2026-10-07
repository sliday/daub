import { forwardRef, useCallback, useId, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { cn } from "../utils/cn";
import { renderOverlayTrigger, useEscapeKey, useMergedRefs } from "../hooks/useOverlay";

export interface PreviewCardProps extends Omit<ComponentProps<"div">, "title"> {
  trigger: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  media?: ReactNode;
}

export const PreviewCard = forwardRef<HTMLDivElement, PreviewCardProps>(
  ({ trigger, title, description, media, className, children, onMouseEnter, onMouseLeave, onFocus, onBlur, ...props }, forwardedRef) => {
    const ref = useRef<HTMLDivElement>(null);
    const setRef = useMergedRefs(ref, forwardedRef);
    const id = useId();
    const [open, setOpen] = useState(false);
    const close = useCallback(() => setOpen(false), []);
    useEscapeKey(close, open, ref);
    return (
      <div ref={setRef} data-db-react="" className={cn("db-preview-card", className)} {...props}
        onMouseEnter={(event) => { onMouseEnter?.(event); if (!event.defaultPrevented) setOpen(true); }}
        onMouseLeave={(event) => { onMouseLeave?.(event); if (!event.defaultPrevented && !ref.current?.contains(document.activeElement)) close(); }}
        onFocus={(event) => { onFocus?.(event); if (!event.defaultPrevented) setOpen(true); }}
        onBlur={(event) => { onBlur?.(event); if (!event.defaultPrevented && !event.currentTarget.contains(event.relatedTarget as Node | null)) close(); }}>
        {renderOverlayTrigger(trigger, { className: "db-preview-card__trigger", "aria-describedby": open ? id : undefined })}
        {open && <div id={id} className="db-preview-card__content">
          {media && <div className="db-preview-card__media">{media}</div>}
          {title && <div className="db-preview-card__title">{title}</div>}
          {description && <div className="db-preview-card__desc">{description}</div>}
          {children}
        </div>}
      </div>
    );
  },
);

PreviewCard.displayName = "PreviewCard";
