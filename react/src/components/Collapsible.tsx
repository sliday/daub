import { forwardRef, useId, type ComponentProps, type ReactNode } from "react";
import { cn } from "../utils/cn";
import { useControllable } from "../hooks/useControllable";

export interface CollapsibleProps extends Omit<ComponentProps<"div">, "onChange"> {
  open?: boolean;
  defaultOpen?: boolean;
  onChange?: (open: boolean) => void;
  trigger: ReactNode;
}

export const Collapsible = forwardRef<HTMLDivElement, CollapsibleProps>(
  ({ open, defaultOpen = false, onChange, trigger, className, children, ...props }, ref) => {
    const [isOpen, setIsOpen] = useControllable(open, defaultOpen, onChange);
    const id = useId();

    return (
      <div ref={ref} data-db-react="" className={cn("db-collapsible", isOpen && "db-collapsible--open", className)} {...props}>
        <button
          id={`${id}-trigger`}
          className="db-collapsible__trigger"
          aria-expanded={isOpen}
          aria-controls={`${id}-content`}
          onClick={() => setIsOpen(!isOpen)}
          type="button"
        >
          {trigger}
        </button>
        <div id={`${id}-content`} className="db-collapsible__content" role="region" aria-labelledby={`${id}-trigger`} hidden={!isOpen}>{children}</div>
      </div>
    );
  },
);

Collapsible.displayName = "Collapsible";
