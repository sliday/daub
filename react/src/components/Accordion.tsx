import { forwardRef, useId, type ComponentProps, type ReactNode, type KeyboardEvent } from "react";
import { cn } from "../utils/cn";
import { useControllable } from "../hooks/useControllable";

export interface AccordionItem {
  trigger: string;
  content: ReactNode;
  disabled?: boolean;
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
    const id = useId();

    const toggle = (index: number) => {
      if (open.includes(index)) {
        setOpen(open.filter((i) => i !== index));
      } else {
        setOpen(multi ? [...open, index] : [index]);
      }
    };

    const navigate = (event: KeyboardEvent<HTMLButtonElement>) => {
      const owner = event.currentTarget.closest(".db-accordion");
      const triggers = Array.from(owner?.querySelectorAll<HTMLButtonElement>(".db-accordion__trigger") ?? [])
        .filter(trigger => trigger.closest(".db-accordion") === owner && !trigger.disabled);
      const index = triggers.indexOf(event.currentTarget);
      const next = { ArrowDown: (index + 1) % triggers.length, ArrowUp: (index + triggers.length - 1) % triggers.length, Home: 0, End: triggers.length - 1 }[event.key];
      if (next !== undefined && triggers[next]) { event.preventDefault(); triggers[next].focus(); }
    };

    return (
      <div ref={ref} data-db-react="" className={cn("db-accordion", className)} {...props}>
        {items.map((item, i) => {
          const isOpen = open.includes(i);
          return (
            <div key={i} className={cn("db-accordion__item", isOpen && "db-accordion__item--open")}>
              <button
                id={`${id}-trigger-${i}`}
                className="db-accordion__trigger"
                aria-expanded={isOpen}
                aria-controls={`${id}-panel-${i}`}
                disabled={item.disabled}
                onClick={() => toggle(i)}
                onKeyDown={navigate}
                type="button"
              >
                {item.trigger}
                <span className="db-accordion__icon" aria-hidden="true">{"\u25B8"}</span>
              </button>
              <div id={`${id}-panel-${i}`} className="db-accordion__content" role="region" aria-labelledby={`${id}-trigger-${i}`} hidden={!isOpen}>{item.content}</div>
            </div>
          );
        })}
      </div>
    );
  },
);

Accordion.displayName = "Accordion";
