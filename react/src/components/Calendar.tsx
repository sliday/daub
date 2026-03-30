import { forwardRef, type ComponentProps, useState } from "react";
import { cn } from "../utils/cn";
import { useControllable } from "../hooks/useControllable";

export interface CalendarProps extends Omit<ComponentProps<"div">, "onChange"> {
  selected?: string;
  defaultSelected?: string;
  onChange?: (date: string) => void;
  month?: Date;
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
  ({ selected, defaultSelected = "", onChange, month: initialMonth, className, ...props }, ref) => {
    const [value, setValue] = useControllable(selected, defaultSelected, onChange);
    const [displayed, setDisplayed] = useState(() => initialMonth ?? (value ? new Date(value + "T00:00") : new Date()));

    const year = displayed.getFullYear();
    const mo = displayed.getMonth();
    const days = getDays(year, mo);
    const todayStr = toDateString(new Date());
    const monthName = displayed.toLocaleString("default", { month: "long" });

    const prevMonth = () => setDisplayed(new Date(year, mo - 1, 1));
    const nextMonth = () => setDisplayed(new Date(year, mo + 1, 1));

    return (
      <div ref={ref} className={cn("db-calendar", className)} {...props}>
        <div className="db-calendar__header">
          <button className="db-calendar__nav" onClick={prevMonth} type="button">{"\u2039"}</button>
          <span className="db-calendar__title">{monthName} {year}</span>
          <button className="db-calendar__nav" onClick={nextMonth} type="button">{"\u203A"}</button>
        </div>
        <div className="db-calendar__grid">
          {DAY_NAMES.map((d) => (
            <span key={d} className="db-calendar__day-name">{d}</span>
          ))}
          {days.map((d, i) => {
            const ds = toDateString(d);
            const inMonth = d.getMonth() === mo;
            return (
              <button
                key={i}
                className={cn(
                  "db-calendar__day",
                  ds === value && "db-calendar__day--selected",
                  ds === todayStr && "db-calendar__day--today",
                  !inMonth && "db-calendar__day--outside",
                )}
                onClick={() => setValue(ds)}
                type="button"
              >
                {d.getDate()}
              </button>
            );
          })}
        </div>
      </div>
    );
  },
);

Calendar.displayName = "Calendar";
