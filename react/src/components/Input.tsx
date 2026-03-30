import { forwardRef, type ComponentProps } from "react";
import { cn } from "../utils/cn";

export interface InputProps extends ComponentProps<"input"> {
  error?: boolean;
  inputSize?: "sm" | "lg";
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ error, inputSize, className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "db-input",
        inputSize && `db-input--${inputSize}`,
        error && "db-input--error",
        className,
      )}
      {...props}
    />
  ),
);

Input.displayName = "Input";
