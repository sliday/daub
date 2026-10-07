import { createContext, useContext, type ReactNode } from "react";

export const PortalThemeContext = createContext<string | undefined>(undefined);
export const portalTextStyle = { color: "var(--db-color-text)", fontFamily: "var(--db-font-body)" };

export interface ThemeProviderProps {
  theme?: string;
  children: ReactNode;
}

export function ThemeProvider({ theme, children }: ThemeProviderProps) {
  const inherited = useContext(PortalThemeContext);
  return <PortalThemeContext.Provider value={theme ?? inherited}><div data-db-react="" data-theme={theme} style={{ ...portalTextStyle, backgroundColor: "var(--db-color-bg)" }}>{children}</div></PortalThemeContext.Provider>;
}

ThemeProvider.displayName = "ThemeProvider";
