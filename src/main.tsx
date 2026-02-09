import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "@/styles/svgmap.css";

// Auto-reload once if a lazy chunk fails to load (common after new deploy)
const CHUNK_RETRY_KEY = "mpl_chunk_retry_at";
const shouldReloadForChunkError = (reason: unknown) => {
  const msg = String((reason as any)?.message || reason || "");
  return /Failed to fetch dynamically imported module|ChunkLoadError|Loading chunk \d+ failed/i.test(msg);
};

const tryReloadForChunkError = () => {
  try {
    const last = Number(sessionStorage.getItem(CHUNK_RETRY_KEY) || 0);
    const now = Date.now();
    // prevent infinite reload loops
    if (now - last < 10_000) return false;
    sessionStorage.setItem(CHUNK_RETRY_KEY, String(now));
    window.location.reload();
    return true;
  } catch {
    return false;
  }
};

window.addEventListener("unhandledrejection", (event) => {
  if (shouldReloadForChunkError(event.reason)) {
    tryReloadForChunkError();
  }
});

window.addEventListener("error", (event) => {
  const err = (event as ErrorEvent).error || (event as ErrorEvent).message;
  if (shouldReloadForChunkError(err)) {
    tryReloadForChunkError();
  }
});

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
    // si localStorage indisponible, on reste sur le thème par défaut (light)
    document.documentElement.classList.remove("dark");
  }
};

// ✅ Appliquer avant le render => moins de "flash" visuel
applyTheme();

createRoot(document.getElementById("root")!).render(<App />);
