import { forwardRef, type ComponentProps } from "react";
import { cn } from "../utils/cn";
import { Collapsible, type CollapsibleProps } from "./Collapsible";

export type BubbleVariant = "default" | "primary" | "secondary" | "muted" | "tinted" | "outline" | "ghost" | "destructive";

export interface BubbleProps extends ComponentProps<"div"> {
  variant?: BubbleVariant;
  align?: "start" | "end";
}

export const Bubble = forwardRef<HTMLDivElement, BubbleProps>(
  ({ variant = "primary", align = "start", className, ...props }, ref) => (
    <div {...props} ref={ref} data-db-react="" className={cn(
      "db-bubble", `db-bubble--${variant === "default" ? "primary" : variant}`,
      align === "end" && "db-bubble--end", className,
    )} />
  ),
);
Bubble.displayName = "Bubble";

export const BubbleContent = forwardRef<HTMLDivElement, ComponentProps<"div">>(
  ({ className, ...props }, ref) => <div {...props} ref={ref} data-db-react="" className={cn("db-bubble__content", className)} />,
);
BubbleContent.displayName = "BubbleContent";

export const BubbleReactions = forwardRef<HTMLDivElement, ComponentProps<"div">>(
  ({ className, ...props }, ref) => <div {...props} ref={ref} data-db-react="" className={cn("db-bubble__reactions", className)} />,
);
BubbleReactions.displayName = "BubbleReactions";

export const BubbleGroup = forwardRef<HTMLDivElement, ComponentProps<"div">>(
  ({ className, ...props }, ref) => <div {...props} ref={ref} data-db-react="" className={cn("db-bubble-group", className)} />,
);
BubbleGroup.displayName = "BubbleGroup";

export type BubbleCollapsibleProps = CollapsibleProps;
export const BubbleCollapsible = forwardRef<HTMLDivElement, BubbleCollapsibleProps>(
  ({ className, ...props }, ref) => <Collapsible {...props} ref={ref} className={cn("db-bubble__content", className)} />,
);
BubbleCollapsible.displayName = "BubbleCollapsible";
