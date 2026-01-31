import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const THEME_STORAGE_KEY = "export-ui-theme";
const DEFAULT_THEME: "light" | "dark" = "light";

const applyTheme = () => {
  const stored = localStorage.getItem(THEME_STORAGE_KEY) as "light" | "dark" | null;
  const theme = stored === "dark" ? "dark" : DEFAULT_THEME;
  document.documentElement.classList.toggle("dark", theme === "dark");
  if (stored !== theme) {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }
};

applyTheme();

createRoot(document.getElementById("root")!).render(<App />);
