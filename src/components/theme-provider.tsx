import * as React from "react";

type Theme = "light" | "dark";

export function ThemeProvider({
  children,
  defaultTheme = "light",
  storageKey = "export-ui-theme",
}: {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
}) {
  React.useEffect(() => {
    const saved = (localStorage.getItem(storageKey) as Theme) || defaultTheme;

    // Force le comportement attendu
    document.documentElement.classList.remove("dark");
    if (saved === "dark") {
      document.documentElement.classList.add("dark");
    }
  }, [defaultTheme, storageKey]);

  return <>{children}</>;
}
