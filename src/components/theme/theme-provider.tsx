"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/** Light, dark or system theme, applied as a class on <html> and remembered per browser. */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
    </NextThemesProvider>
  );
}
