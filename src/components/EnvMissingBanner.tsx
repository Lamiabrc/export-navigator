import { AlertTriangle } from "lucide-react";

import { DEMO_MODE } from "@/integrations/supabase/client";

export function EnvMissingBanner() {
  if (!DEMO_MODE) return null;

  return (
    <div className="sticky top-0 z-[120] border-b border-amber-300 bg-amber-100/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-[90rem] items-center gap-2 px-4 py-2 text-xs text-amber-900 md:px-6">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span>
          Mode DEMO actif: variables Supabase manquantes. Certaines fonctions serveur peuvent etre indisponibles.
        </span>
      </div>
    </div>
  );
}
