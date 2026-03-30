import { forwardRef, type ComponentProps, type ReactNode } from "react";
import { cn } from "../utils/cn";
import { useControllable } from "../hooks/useControllable";

export interface TabItem {
  label: string;
  content: ReactNode;
}

export interface TabsProps extends Omit<ComponentProps<"div">, "onChange"> {
  tabs: TabItem[];
  activeTab?: number;
  defaultActiveTab?: number;
  onChange?: (index: number) => void;
}

export const Tabs = forwardRef<HTMLDivElement, TabsProps>(
  ({ tabs, activeTab, defaultActiveTab = 0, onChange, className, ...props }, ref) => {
    const [current, setCurrent] = useControllable(activeTab, defaultActiveTab, onChange);

    return (
      <div ref={ref} className={cn("db-tabs", className)} {...props}>
        <div className="db-tabs__list" role="tablist">
          {tabs.map((t, i) => (
            <button
              key={i}
              className={cn("db-tabs__tab", i === current && "db-tabs__tab--active")}
              role="tab"
              aria-selected={i === current}
              onClick={() => setCurrent(i)}
              type="button"
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="db-tabs__panel" role="tabpanel">
          {tabs[current]?.content}
        </div>
      </div>
    );
  },
);

Tabs.displayName = "Tabs";
