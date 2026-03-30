import { forwardRef, type ComponentProps } from "react";
import { cn } from "../utils/cn";

type SeparatorDivProps = ComponentProps<"div"> & {
  label: string;
  vertical?: boolean;
  dashed?: boolean;
};

type SeparatorHrProps = ComponentProps<"hr"> & {
  label?: undefined;
  vertical?: boolean;
  dashed?: boolean;
};

export type SeparatorProps = SeparatorDivProps | SeparatorHrProps;

export const Separator = forwardRef<HTMLHRElement | HTMLDivElement, SeparatorProps>(
  ({ vertical, dashed, label, className, ...props }, ref) => {
    const classes = cn(
      "db-separator",
      vertical && "db-separator--vertical",
      dashed && "db-separator--dashed",
      className,
    );

    if (label) {
      return (
        <div
          ref={ref as React.Ref<HTMLDivElement>}
          role="separator"
          className={classes}
          {...(props as ComponentProps<"div">)}
        >
          <span>{label}</span>
        </div>
      );
    }

    return (
      <hr
        ref={ref as React.Ref<HTMLHRElement>}
        className={classes}
        {...(props as ComponentProps<"hr">)}
      />
    );
  },
);

Separator.displayName = "Separator";
