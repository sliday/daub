import { forwardRef, type ComponentProps } from "react";
import { cn } from "../utils/cn";

export interface TextareaProps extends ComponentProps<"textarea"> {
  error?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ error, className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn("db-textarea", error && "db-textarea--error", className)}
      {...props}
    />
  ),
);

Textarea.displayName = "Textarea";
