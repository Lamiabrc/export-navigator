import { supabase } from "@/integrations/supabase/client";

/**
 * Télécharge le CSV de v_export_pricing pour un territoire (FR, GP, MQ, GF, RE, YT, SPM, BL, MF)
 * Nécessite que l’utilisateur soit connecté (Edge Function Verify JWT).
 */
export async function downloadExportCSV(territoryCode: string) {
  const territory = (territoryCode || "FR").toUpperCase();

  const { data, error } = await supabase.functions.invoke("export-pricing", {
    body: { territory_code: territory },
  });

  if (error) {
    throw new Error(error.message || "Erreur export CSV");
  }

  // data peut être string ou Blob selon config; on sécurise les deux cas
  const blob =
    data instanceof Blob
      ? data
      : new Blob([typeof data === "string" ? data : JSON.stringify(data)], {
          type: "text/csv;charset=utf-8",
        });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `export_${territory}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
