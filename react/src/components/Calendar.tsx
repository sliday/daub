import { forwardRef, type ComponentProps, useState, useEffect, useId, useRef } from "react";
import { cn } from "../utils/cn";
import { useControllable } from "../hooks/useControllable";

export interface CalendarProps extends Omit<ComponentProps<"div">, "onChange"> {
  selected?: string;
  defaultSelected?: string;
  onChange?: (date: string) => void;
  month?: Date;
  onMonthChange?: (month: Date) => void;
  disabled?: boolean;
  min?: string;
  max?: string;
}

const DAY_NAMES = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getDays(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const startDay = first.getDay();
  const days: Date[] = [];
  for (let i = -startDay; i < 42 - startDay; i++) {
    const d = new Date(year, month, 1 + i);
    days.push(d);
    if (i >= 0 && d.getMonth() !== month && d.getDay() === 6) break;
  }
  return days;
}

export const Calendar = forwardRef<HTMLDivElement, CalendarProps>(
  ({ selected, defaultSelected = "", onChange, month: initialMonth, onMonthChange, disabled, min, max, className, onKeyDown, ...props }, ref) => {
    const [value, setValue] = useControllable(selected, defaultSelected, onChange);
    const parseDate = (text?: string) => {
      if (!text || !/^\d{4}-\d{2}-\d{2}$/.test(text)) return undefined;
      const date = new Date(`${text}T00:00`);
      return Number.isFinite(date.getTime()) && toDateString(date) === text ? date : undefined;
    };
    const [displayed, setDisplayed] = useState(() => initialMonth && Number.isFinite(initialMonth.getTime()) ? initialMonth : parseDate(value) ?? new Date());
    const [focused, setFocused] = useState(value);
    const rootRef = useRef<HTMLDivElement | null>(null);
    const pendingFocus = useRef(false);
    const titleId = useId();
    const monthTime = initialMonth?.getTime();
    useEffect(() => {
      if (monthTime === undefined || !Number.isFinite(monthTime)) return;
      const next = new Date(monthTime);
      setDisplayed(next);
      const selection = parseDate(value);
      setFocused(selection && selection.getFullYear() === next.getFullYear() && selection.getMonth() === next.getMonth()
        ? value : toDateString(new Date(next.getFullYear(), next.getMonth(), 1)));
    }, [monthTime]);
    useEffect(() => {
      if (!pendingFocus.current) return;
      rootRef.current?.querySelector<HTMLButtonElement>(`[data-date="${focused}"]`)?.focus();
      pendingFocus.current = false;
    }, [focused, displayed]);

    const year = displayed.getFullYear();
    const mo = displayed.getMonth();
    const days = getDays(year, mo);
    const todayStr = toDateString(new Date());
    const monthName = displayed.toLocaleString("default", { month: "long" });
    const minimum = parseDate(min) ? min : undefined;
    const maximum = parseDate(max) ? max : undefined;
    const unavailable = (date: string) => !!disabled || (!!minimum && date < minimum) || (!!maximum && date > maximum);
    const enabledDays = days.filter((date) => !unavailable(toDateString(date)));
    const tabDate = enabledDays.find((date) => toDateString(date) === focused)
      ?? enabledDays.find((date) => toDateString(date) === value)
      ?? enabledDays.find((date) => toDateString(date) === todayStr)
      ?? enabledDays.find((date) => date.getMonth() === mo)
      ?? enabledDays[0];
    const changeMonth = (next: Date) => {
      setDisplayed(next);
      setFocused(toDateString(next));
      onMonthChange?.(next);
    };
    const navigate = (date: Date) => {
      let next = date;
      if (minimum && toDateString(next) < minimum) next = parseDate(minimum)!;
      if (maximum && toDateString(next) > maximum) next = parseDate(maximum)!;
      pendingFocus.current = true;
      setFocused(toDateString(next));
      if (next.getFullYear() !== year || next.getMonth() !== mo) {
        const month = new Date(next.getFullYear(), next.getMonth(), 1);
        setDisplayed(month);
        onMonthChange?.(month);
      }
    };

    return (
      <div ref={(node) => {
        rootRef.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) ref.current = node;
      }} className={cn("db-calendar", className)} {...props} data-db-react="" onKeyDown={(event) => {
        onKeyDown?.(event);
        if (event.defaultPrevented || disabled) return;
        const dateString = (event.target as HTMLElement).dataset.date;
        const date = parseDate(dateString);
        if (!date) return;
        let next = new Date(date);
        const rtl = getComputedStyle(event.currentTarget).direction === "rtl";
        if (event.key === "ArrowRight") next.setDate(next.getDate() + (rtl ? -1 : 1));
        else if (event.key === "ArrowLeft") next.setDate(next.getDate() + (rtl ? 1 : -1));
        else if (event.key === "ArrowDown") next.setDate(next.getDate() + 7);
        else if (event.key === "ArrowUp") next.setDate(next.getDate() - 7);
        else if (event.key === "Home") next.setDate(next.getDate() - next.getDay());
        else if (event.key === "End") next.setDate(next.getDate() + 6 - next.getDay());
        else if (event.key === "PageUp" || event.key === "PageDown") {
          const amount = (event.key === "PageUp" ? -1 : 1) * (event.shiftKey ? 12 : 1);
          next = new Date(date.getFullYear(), date.getMonth() + amount, 1);
          next.setDate(Math.min(date.getDate(), new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()));
        } else return;
        event.preventDefault();
        navigate(next);
      }}>
        <div className="db-calendar__header">
          <button className="db-calendar__nav" aria-label="Previous month" disabled={disabled || (!!minimum && toDateString(new Date(year, mo, 0)) < minimum)} onClick={() => changeMonth(new Date(year, mo - 1, 1))} type="button">{"\u2039"}</button>
          <span id={titleId} className="db-calendar__title" aria-live="polite">{monthName} {year}</span>
          <button className="db-calendar__nav" aria-label="Next month" disabled={disabled || (!!maximum && toDateString(new Date(year, mo + 1, 1)) > maximum)} onClick={() => changeMonth(new Date(year, mo + 1, 1))} type="button">{"\u203A"}</button>
        </div>
        <div className="db-calendar__grid" role="grid" aria-labelledby={titleId}>
          <div role="row" style={{ display: "contents" }}>
          {DAY_NAMES.map((d) => (
            <span key={d} className="db-calendar__day-label" role="columnheader">{d}</span>
          ))}
          </div>
          {Array.from({ length: days.length / 7 }, (_, week) => <div key={week} role="row" style={{ display: "contents" }}>
          {days.slice(week * 7, week * 7 + 7).map((d) => {
            const ds = toDateString(d);
            const inMonth = d.getMonth() === mo;
            return (
              <button
                key={ds}
                role="gridcell"
                data-date={ds}
                aria-label={d.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                aria-selected={ds === value}
                aria-current={ds === todayStr ? "date" : undefined}
                disabled={unavailable(ds)}
                tabIndex={tabDate && ds === toDateString(tabDate) ? 0 : -1}
                className={cn(
                  "db-calendar__day",
                  ds === value && "db-calendar__day--selected",
                  ds === todayStr && "db-calendar__day--today",
                  !inMonth && "db-calendar__day--outside",
                  unavailable(ds) && "db-calendar__day--disabled",
                )}
                onFocus={() => setFocused(ds)}
                onClick={() => { setFocused(ds); setValue(ds); }}
                type="button"
              >
                {d.getDate()}
              </button>
            );
          })}</div>)}
        </div>
      </div>
    );
  },
);

Calendar.displayName = "Calendar";
