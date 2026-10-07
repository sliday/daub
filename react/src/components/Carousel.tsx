import { forwardRef, type ComponentProps, type PointerEvent, useEffect, useRef, useState, Children } from "react";
import { cn } from "../utils/cn";
import { useControllable } from "../hooks/useControllable";

export interface CarouselProps extends Omit<ComponentProps<"div">, "onChange"> {
  current?: number;
  defaultCurrent?: number;
  onChange?: (index: number) => void;
  autoplay?: boolean;
  duration?: number;
  previousLabel?: string;
  nextLabel?: string;
  disabled?: boolean;
}

export const Carousel = forwardRef<HTMLDivElement, CarouselProps>(
  ({ current, defaultCurrent = 0, onChange, autoplay = false, duration = 5000, previousLabel = "Previous slide", nextLabel = "Next slide", disabled = false, className, children, onFocus, onBlur, onMouseEnter, onMouseLeave, onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onLostPointerCapture, onClickCapture, onKeyDownCapture, onDragStart, ...props }, ref) => {
    const slides = Children.toArray(children);
    const count = slides.length;
    const [idx, setIdx] = useControllable(current, defaultCurrent, onChange);
    const active = Math.max(0, Math.min(count - 1, Number.isFinite(idx) ? Math.floor(idx) : 0));
    const [focused, setFocused] = useState(false);
    const [hovered, setHovered] = useState(false);
    const trackRef = useRef<HTMLDivElement>(null);
    const swipe = useRef<{ id: number; x: number; y: number; track: HTMLDivElement; horizontal: boolean } | null>(null);
    const suppressClick = useRef(false);
    const clickTimer = useRef<number | undefined>(undefined);
    const disabledControl = disabled || props["aria-disabled"] === true || props["aria-disabled"] === "true" || /\bdb-[\w-]+--(?:disabled|loading)\b/.test(className ?? "");
    const isDisabled = (element: HTMLElement | null) => {
      if (disabledControl) return true;
      for (let node = element; node; node = node.parentElement) {
        if (node.matches(':disabled, [disabled], [aria-disabled="true"], [inert]') || /\bdb-[\w-]+--(?:disabled|loading)\b/.test(node.getAttribute("class") ?? "")) return true;
      }
      return false;
    };
    const clearClick = () => {
      suppressClick.current = false;
      window.clearTimeout(clickTimer.current);
    };
    const endSwipe = (event: PointerEvent<HTMLDivElement>, commit: boolean) => {
      const start = swipe.current;
      if (!start || start.id !== event.pointerId) return;
      swipe.current = null;
      if (commit && count > 1 && !isDisabled(start.track)) {
        const dx = event.clientX - start.x, dy = event.clientY - start.y;
        const threshold = Math.max(30, Math.min(80, event.currentTarget.clientWidth * 0.15));
        if (Math.abs(dx) >= threshold && Math.abs(dx) > Math.abs(dy) * 1.25) {
          setIdx((active + (dx < 0 ? 1 : -1) + count) % count);
          clearClick();
          suppressClick.current = true;
          clickTimer.current = window.setTimeout(() => { suppressClick.current = false; }, 350);
        }
      }
      if (start.track.hasPointerCapture(event.pointerId)) start.track.releasePointerCapture(event.pointerId);
    };

    useEffect(() => {
      const track = trackRef.current;
      if (track && getComputedStyle(track).touchAction === "auto") track.style.touchAction = "pan-y";
      return () => {
        window.clearTimeout(clickTimer.current);
        const start = swipe.current;
        swipe.current = null;
        if (start?.track.hasPointerCapture(start.id)) start.track.releasePointerCapture(start.id);
      };
    }, []);

    const prev = () => { if (count > 1 && !isDisabled(trackRef.current)) setIdx((active - 1 + count) % count); };
    const next = () => { if (count > 1 && !isDisabled(trackRef.current)) setIdx((active + 1) % count); };

    useEffect(() => {
      if (!autoplay || count <= 1 || focused || hovered || disabledControl || !Number.isFinite(duration) || duration <= 0) return;
      const id = setInterval(() => { if (!swipe.current && !isDisabled(trackRef.current)) setIdx((active + 1) % count); }, duration);
      return () => clearInterval(id);
    }, [autoplay, duration, count, active, focused, hovered, disabledControl, setIdx]);

    return (
      <div
        ref={ref}
        data-db-react=""
        role="region"
        aria-roledescription="carousel"
        aria-label={props["aria-labelledby"] ? undefined : "Carousel"}
        className={cn("db-carousel", className)}
        {...props}
        aria-disabled={disabled ? true : props["aria-disabled"]}
        onFocus={(event) => { onFocus?.(event); setFocused(true); }}
        onBlur={(event) => { onBlur?.(event); if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}
        onMouseEnter={(event) => { onMouseEnter?.(event); setHovered(true); }}
        onMouseLeave={(event) => { onMouseLeave?.(event); setHovered(false); }}
        onPointerDown={(event) => {
          onPointerDown?.(event);
          const track = trackRef.current;
          if (event.defaultPrevented || swipe.current || count <= 1 || !event.isPrimary || event.button !== 0 || (event.pointerType !== "touch" && event.pointerType !== "pen") || !track || !track.contains(event.target as Node) || isDisabled(event.target as HTMLElement)) return;
          if ((event.target as HTMLElement).closest('button, input, select, textarea, [contenteditable]:not([contenteditable="false"])')) return;
          clearClick();
          swipe.current = { id: event.pointerId, x: event.clientX, y: event.clientY, track, horizontal: false };
        }}
        onPointerMove={(event) => {
          onPointerMove?.(event);
          const start = swipe.current;
          if (!start || event.pointerId !== start.id) return;
          if (event.defaultPrevented || isDisabled(start.track)) { endSwipe(event, false); return; }
          const dx = event.clientX - start.x, dy = event.clientY - start.y;
          if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { endSwipe(event, false); return; }
          if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.25) {
            start.horizontal = true;
            if (!start.track.hasPointerCapture(event.pointerId)) start.track.setPointerCapture(event.pointerId);
            event.preventDefault();
          }
        }}
        onPointerUp={(event) => { onPointerUp?.(event); endSwipe(event, !event.defaultPrevented); }}
        onPointerCancel={(event) => { onPointerCancel?.(event); endSwipe(event, false); }}
        onLostPointerCapture={(event) => {
          onLostPointerCapture?.(event);
          if (event.target === swipe.current?.track) endSwipe(event, false);
        }}
        onClickCapture={(event) => {
          onClickCapture?.(event);
          if (suppressClick.current && trackRef.current?.contains(event.target as Node)) {
            clearClick();
            event.preventDefault();
            event.stopPropagation();
          }
        }}
        onKeyDownCapture={(event) => {
          onKeyDownCapture?.(event);
          if (!event.defaultPrevented && trackRef.current?.contains(event.target as Node)) clearClick();
        }}
        onDragStart={(event) => {
          onDragStart?.(event);
          if (!event.defaultPrevented && swipe.current?.horizontal && trackRef.current?.contains(event.target as Node)) event.preventDefault();
        }}
      >
        <div ref={trackRef} className="db-carousel__track" aria-live={autoplay && !focused && !hovered ? "off" : "polite"} style={{ transform: `translateX(-${active * 100}%)` }}>
          {slides.map((child, i) => (
            <div key={i} ref={(node) => { if (node) node.inert = i !== active; }} className="db-carousel__slide" role="group" aria-roledescription="slide" aria-label={`${i + 1} of ${count}`} aria-hidden={i !== active}>{child}</div>
          ))}
        </div>
        <button className="db-carousel__btn db-carousel__btn--prev db-carousel__prev" aria-label={previousLabel} disabled={disabledControl || count <= 1} onClick={prev} type="button">{"\u2039"}</button>
        <button className="db-carousel__btn db-carousel__btn--next db-carousel__next" aria-label={nextLabel} disabled={disabledControl || count <= 1} onClick={next} type="button">{"\u203A"}</button>
        <div className="db-carousel__dots">
          {slides.map((_, i) => (
            <button
              key={i}
              className={cn("db-carousel__dot", i === active && "db-carousel__dot--active")}
              onClick={() => { if (!isDisabled(trackRef.current)) setIdx(i); }}
              disabled={disabledControl}
              type="button"
              aria-label={`Slide ${i + 1}`}
              aria-current={i === active ? "true" : undefined}
            />
          ))}
        </div>
      </div>
    );
  },
);

Carousel.displayName = "Carousel";
