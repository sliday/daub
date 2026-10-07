import { forwardRef, type ComponentProps } from "react";
import { cn } from "../utils/cn";
import type { GapToken } from "../utils/types";

type Justify = "start" | "end" | "center" | "between" | "around";
type Align = "start" | "end" | "center" | "stretch";

export interface StackProps extends ComponentProps<"div"> {
  direction?: "vertical" | "horizontal";
  gap?: GapToken;
  justify?: Justify;
  align?: Align;
  wrap?: boolean;
  container?: boolean | "wide" | "narrow";
}

export const Stack = forwardRef<HTMLDivElement, StackProps>(
  (
    { direction, gap, justify, align, wrap, container, className, style, ...props },
    ref,
  ) => (
    <div
      ref={ref}
      className={cn(
        "db-stack",
        "db-flex",
        direction !== "horizontal" && "db-flex--col",
        direction === "horizontal" && "db-stack--h",
        gap != null && `db-gap-${gap}`,
        justify && `db-justify-${justify}`,
        align && `db-align-${align}`,
        wrap && "db-flex--wrap",
        container === true && "db-container",
        container === "wide" && "db-container db-container--wide",
        container === "narrow" && "db-container db-container--narrow",
        className,
      )}
      {...props}
      style={{
        justifyContent: justify ? { start: "flex-start", end: "flex-end", center: "center", between: "space-between", around: "space-around" }[justify] : undefined,
        alignItems: align ? { start: "flex-start", end: "flex-end", center: "center", stretch: "stretch" }[align] : undefined,
        ...style,
      }}
    />
  ),
);

Stack.displayName = "Stack";
