import { type ReactNode, useState } from "react";
import { cn } from "../utils/cn";

export type TooltipPosition = "top" | "bottom" | "left" | "right";

export interface TooltipProps {
  content: ReactNode;
  position?: TooltipPosition;
  children: ReactNode;
  className?: string;
}

export function Tooltip({
  content,
  position = "top",
  children,
  className,
}: TooltipProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className={cn("db-tooltip", className)}>
      <div
        className="db-tooltip__trigger"
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onFocus={() => setVisible(true)}
        onBlur={() => setVisible(false)}
      >
        {children}
      </div>
      {visible && (
        <div
          className={cn("db-tooltip__content", `db-tooltip__content--${position}`)}
          role="tooltip"
        >
          {content}
        </div>
      )}
    </div>
  );
}

Tooltip.displayName = "Tooltip";
