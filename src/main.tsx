import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const THEME_STORAGE_KEY = "theme";

const applyTheme = () => {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  const theme = stored === "dark" ? "dark" : "light";
  document.documentElement.classList.toggle("dark", theme === "dark");
  if (stored !== theme) {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }
};

applyTheme();

createRoot(document.getElementById("root")!).render(<App />);
