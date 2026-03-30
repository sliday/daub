import { forwardRef, type ComponentProps, type ReactNode } from "react";
import { cn } from "../utils/cn";
import { useControllable } from "../hooks/useControllable";

export interface AccordionItem {
  trigger: string;
  content: ReactNode;
}

export interface AccordionProps extends Omit<ComponentProps<"div">, "onChange"> {
  items: AccordionItem[];
  multi?: boolean;
  openItems?: number[];
  defaultOpenItems?: number[];
  onChange?: (indices: number[]) => void;
}

export const Accordion = forwardRef<HTMLDivElement, AccordionProps>(
  ({ items, multi = false, openItems, defaultOpenItems = [], onChange, className, ...props }, ref) => {
    const [open, setOpen] = useControllable(openItems, defaultOpenItems, onChange);

    const toggle = (index: number) => {
      if (open.includes(index)) {
        setOpen(open.filter((i) => i !== index));
      } else {
        setOpen(multi ? [...open, index] : [index]);
      }
    };

    return (
      <div ref={ref} className={cn("db-accordion", className)} {...props}>
        {items.map((item, i) => {
          const isOpen = open.includes(i);
          return (
            <div key={i} className={cn("db-accordion__item", isOpen && "db-accordion__item--open")}>
              <button
                className="db-accordion__trigger"
                aria-expanded={isOpen}
                onClick={() => toggle(i)}
                type="button"
              >
                {item.trigger}
                <span className="db-accordion__icon">{"\u25B8"}</span>
              </button>
              {isOpen && <div className="db-accordion__content">{item.content}</div>}
            </div>
          );
        })}
      </div>
    );
  },
);

Accordion.displayName = "Accordion";
