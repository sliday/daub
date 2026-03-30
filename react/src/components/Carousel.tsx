import { forwardRef, type ComponentProps, useEffect, Children } from "react";
import { cn } from "../utils/cn";
import { useControllable } from "../hooks/useControllable";

export interface CarouselProps extends Omit<ComponentProps<"div">, "onChange"> {
  current?: number;
  defaultCurrent?: number;
  onChange?: (index: number) => void;
  autoplay?: boolean;
  duration?: number;
}

export const Carousel = forwardRef<HTMLDivElement, CarouselProps>(
  ({ current, defaultCurrent = 0, onChange, autoplay = false, duration = 5000, className, children, ...props }, ref) => {
    const slides = Children.toArray(children);
    const count = slides.length;
    const [idx, setIdx] = useControllable(current, defaultCurrent, onChange);

    const prev = () => setIdx((idx - 1 + count) % count);
    const next = () => setIdx((idx + 1) % count);

    useEffect(() => {
      if (!autoplay || count <= 1) return;
      const id = setInterval(() => setIdx((idx + 1) % count), duration);
      return () => clearInterval(id);
    }, [autoplay, duration, count, idx, setIdx]);

    return (
      <div ref={ref} className={cn("db-carousel", className)} {...props}>
        <div className="db-carousel__track" style={{ transform: `translateX(-${idx * 100}%)` }}>
          {slides.map((child, i) => (
            <div key={i} className="db-carousel__slide">{child}</div>
          ))}
        </div>
        <button className="db-carousel__prev" onClick={prev} type="button">{"\u2039"}</button>
        <button className="db-carousel__next" onClick={next} type="button">{"\u203A"}</button>
        <div className="db-carousel__dots">
          {slides.map((_, i) => (
            <button
              key={i}
              className={cn("db-carousel__dot", i === idx && "db-carousel__dot--active")}
              onClick={() => setIdx(i)}
              type="button"
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>
      </div>
    );
  },
);

Carousel.displayName = "Carousel";
