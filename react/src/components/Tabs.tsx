import { forwardRef, useId, type ComponentProps, type ReactNode } from "react";
import { cn } from "../utils/cn";
import { useControllable } from "../hooks/useControllable";

export interface TabItem {
  label: string;
  content: ReactNode;
  disabled?: boolean;
}

export interface TabsProps extends Omit<ComponentProps<"div">, "onChange"> {
  tabs: TabItem[];
  activeTab?: number;
  defaultActiveTab?: number;
  onChange?: (index: number) => void;
  orientation?: "horizontal" | "vertical";
  tabListProps?: Omit<ComponentProps<"div">, "children">;
}

export const Tabs = forwardRef<HTMLDivElement, TabsProps>(
  ({ tabs, activeTab, defaultActiveTab = 0, onChange, orientation = "horizontal", tabListProps, className, ...props }, ref) => {
    const [current, setCurrent] = useControllable(activeTab, defaultActiveTab, onChange);
    const id = useId();
    const selected = tabs[current] && !tabs[current].disabled ? current : tabs.findIndex((tab) => !tab.disabled);

    return (
      <div ref={ref} className={cn("db-tabs", className)} {...props} data-db-react="">
        <div {...tabListProps} className={cn("db-tabs__list", tabListProps?.className)} role="tablist" aria-orientation={orientation} aria-label={tabListProps?.["aria-label"] ?? props["aria-label"]} onKeyDown={(event) => {
          tabListProps?.onKeyDown?.(event);
          if (event.defaultPrevented) return;
          const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')).filter((button) => !button.disabled);
          const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
          if (index < 0) return;
          const rtl = orientation === "horizontal" && getComputedStyle(event.currentTarget).direction === "rtl";
          const direction = rtl ? -1 : 1;
          let next: number;
          if (event.key === (orientation === "vertical" ? "ArrowDown" : "ArrowRight")) next = (index + direction + buttons.length) % buttons.length;
          else if (event.key === (orientation === "vertical" ? "ArrowUp" : "ArrowLeft")) next = (index - direction + buttons.length) % buttons.length;
          else if (event.key === "Home") next = 0;
          else if (event.key === "End") next = buttons.length - 1;
          else return;
          event.preventDefault();
          buttons[next]?.focus();
          setCurrent(Number(buttons[next].dataset.index));
        }}>
          {tabs.map((t, i) => (
            <button
              key={i}
              className={cn("db-tabs__tab", i === selected && "db-tabs__tab--active")}
              role="tab"
              id={`${id}-tab-${i}`}
              aria-controls={`${id}-panel-${i}`}
              data-index={i}
              disabled={t.disabled}
              aria-selected={i === selected}
              tabIndex={i === selected ? 0 : -1}
              onClick={() => setCurrent(i)}
              type="button"
            >
              {t.label}
            </button>
          ))}
        </div>
        {tabs.map((tab, i) => (
          <div key={i} className="db-tabs__panel" role="tabpanel" id={`${id}-panel-${i}`} aria-labelledby={`${id}-tab-${i}`} hidden={i !== selected} tabIndex={0}>
            {i === selected && tab.content}
          </div>
        ))}
      </div>
    );
  },
);

Tabs.displayName = "Tabs";
