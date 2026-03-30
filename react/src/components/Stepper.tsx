import { forwardRef, type ComponentProps } from "react";
import { cn } from "../utils/cn";

export interface StepperStep {
  label: string;
  completed?: boolean;
  active?: boolean;
}

export interface StepperProps extends Omit<ComponentProps<"div">, "children"> {
  steps: StepperStep[];
  vertical?: boolean;
}

export const Stepper = forwardRef<HTMLDivElement, StepperProps>(
  ({ steps, vertical, className, ...props }, ref) => (
    <div
      ref={ref}
      {...props}
      className={cn(
        "db-stepper",
        vertical && "db-stepper--vertical",
        className,
      )}
    >
      {steps.map((step, i) => (
        <div
          key={i}
          className={cn(
            "db-stepper__step",
            step.completed && "db-stepper__step--completed",
            step.active && "db-stepper__step--active",
          )}
        >
          <div className="db-stepper__circle">
            {step.completed ? "\u2713" : i + 1}
          </div>
          <span className="db-stepper__label">{step.label}</span>
        </div>
      ))}
    </div>
  ),
);

Stepper.displayName = "Stepper";
