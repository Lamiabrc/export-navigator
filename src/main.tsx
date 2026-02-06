import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

/**
 * IMPORTANT:
 * Doit matcher le storageKey du ThemeProvider dans App.tsx :
 * <ThemeProvider defaultTheme="light" storageKey="mpl-ui-theme">
 */
const THEME_STORAGE_KEY = "mpl-ui-theme";
const DEFAULT_THEME: "light" | "dark" = "light";

const applyTheme = () => {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY) as "light" | "dark" | null;
    const theme = stored === "dark" ? "dark" : DEFAULT_THEME;

    // shadcn/ThemeProvider utilisent généralement la classe "dark"
    document.documentElement.classList.toggle("dark", theme === "dark");

    // normaliser la valeur stockée (évite les valeurs invalides)
    if (stored !== theme) {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    }
  } catch {
    // si localStorage indisponible, on reste sur le thème par défaut
    document.documentElement.classList.toggle("dark", DEFAULT_THEME === "dark");
  }
};

// ✅ Appliquer avant le render => moins de "flash" visuel
applyTheme();

createRoot(document.getElementById("root")!).render(<App />);
