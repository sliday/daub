import type { ReactNode } from "react";

export interface ThemeProviderProps {
  theme?: string;
  children: ReactNode;
}

export function ThemeProvider({ theme, children }: ThemeProviderProps) {
  return <div data-theme={theme}>{children}</div>;
}

ThemeProvider.displayName = "ThemeProvider";
