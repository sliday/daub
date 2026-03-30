import { forwardRef, type ComponentProps } from "react";
import { cn } from "../utils/cn";

export interface SearchProps extends Omit<ComponentProps<"input">, "type"> {
  placeholder?: string;
  value?: string;
  onChange?: ComponentProps<"input">["onChange"];
}

export const Search = forwardRef<HTMLInputElement, SearchProps>(
  ({ className, placeholder = "Search…", ...props }, ref) => (
    <div className={cn("db-search", className)}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <input
        ref={ref}
        type="search"
        className="db-input"
        placeholder={placeholder}
        {...props}
      />
    </div>
  ),
);

Search.displayName = "Search";
