import { forwardRef, useEffect, useRef, useState, type ComponentProps } from "react";
import { cn } from "../utils/cn";

export interface ToolbarProps extends ComponentProps<"div"> {
  vertical?: boolean;
}

export const Toolbar = forwardRef<HTMLDivElement, ToolbarProps>(
  ({ vertical, className, onKeyDown, onFocus, children, ...props }, ref) => {
    const toolbarRef = useRef<HTMLDivElement | null>(null);
    const [active, setActive] = useState<HTMLElement | null>(null);
    const controls = () => Array.from(toolbarRef.current?.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, [tabindex]') ?? [])
      .filter((node) => !node.closest('[hidden], [inert], [aria-disabled="true"]') && !node.matches(':disabled') && node.getClientRects().length > 0);
    useEffect(() => {
      const nodes = controls();
      const current = active && nodes.includes(active) ? active : nodes[0];
      nodes.forEach((node) => { node.tabIndex = node === current ? 0 : -1; });
    });
    return (
    <div
      ref={(node) => {
        toolbarRef.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) ref.current = node;
      }}
      className={cn("db-toolbar", vertical && "db-toolbar--vertical", className)}
      role="toolbar"
      aria-orientation={vertical ? "vertical" : "horizontal"}
      {...props}
      data-db-react=""
      onFocus={(event) => { onFocus?.(event); setActive(event.target as HTMLElement); }}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (event.defaultPrevented) return;
        const target = event.target as HTMLElement;
        if (target.matches('input, textarea, select, [contenteditable="true"]')) return;
        const nodes = controls();
        const current = nodes.indexOf(target);
        if (current < 0) return;
        const direction = getComputedStyle(event.currentTarget).direction === "rtl" ? -1 : 1;
        let index: number;
        if (event.key === "Home") index = 0;
        else if (event.key === "End") index = nodes.length - 1;
        else if (event.key === (vertical ? "ArrowDown" : "ArrowRight")) index = (current + (vertical ? 1 : direction) + nodes.length) % nodes.length;
        else if (event.key === (vertical ? "ArrowUp" : "ArrowLeft")) index = (current - (vertical ? 1 : direction) + nodes.length) % nodes.length;
        else return;
        event.preventDefault();
        nodes[index]?.focus();
      }}
    >{children}</div>
    );
  },
);

Toolbar.displayName = "Toolbar";
