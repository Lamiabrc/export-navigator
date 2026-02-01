import { useEffect, useState } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

export const usePrefersReducedMotion = () => {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return false;
    }

    return window.matchMedia(QUERY).matches;
  });

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }

    const mediaQuery = window.matchMedia(QUERY);
    const handler = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    mediaQuery.addEventListener ? mediaQuery.addEventListener("change", handler) : mediaQuery.addListener(handler);

    return () => {
      mediaQuery.removeEventListener ? mediaQuery.removeEventListener("change", handler) : mediaQuery.removeListener(handler);
    };
  }, []);

  return prefersReducedMotion;
};
