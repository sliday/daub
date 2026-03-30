import { forwardRef, type ComponentProps, type ReactNode } from "react";
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

    return (
      <div ref={ref} className={cn("db-collapsible", isOpen && "db-collapsible--open", className)} {...props}>
        <button
          className="db-collapsible__trigger"
          aria-expanded={isOpen}
          onClick={() => setIsOpen(!isOpen)}
          type="button"
        >
          {trigger}
        </button>
        {isOpen && <div className="db-collapsible__content">{children}</div>}
      </div>
    );
  },
);

Collapsible.displayName = "Collapsible";
