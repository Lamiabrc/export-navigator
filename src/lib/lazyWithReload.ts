import * as React from "react";

const RELOAD_KEY = "mpl-chunk-reload";

/**
 * React.lazy avec filet de sécurité : si un fichier de page n'existe plus
 * (visiteur resté sur une ancienne version pendant une mise en ligne),
 * on recharge la page une seule fois pour récupérer la nouvelle version.
 */
export function lazyWithReload<T extends React.ComponentType<any>>(loader: () => Promise<{ default: T }>) {
  return React.lazy(async () => {
    try {
      const mod = await loader();
      try {
        window.sessionStorage.removeItem(RELOAD_KEY);
      } catch {
        /* ignore */
      }
      return mod;
    } catch (error) {
      let alreadyReloaded = false;
      try {
        alreadyReloaded = window.sessionStorage.getItem(RELOAD_KEY) === "1";
        if (!alreadyReloaded) window.sessionStorage.setItem(RELOAD_KEY, "1");
      } catch {
        /* ignore */
      }
      if (!alreadyReloaded) {
        window.location.reload();
        return new Promise<{ default: T }>(() => {});
      }
      throw error;
    }
  });
}
