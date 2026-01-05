import { supabase } from "@/integrations/supabase/client";

/**
 * Telecharge un CSV issu de la vue v_export_pricing pour un territoire.
 */
export async function downloadExportCSV(territoryCode: string) {
  const territory = (territoryCode || "FR").toUpperCase();

  const { data, error } = await supabase
    .from("v_export_pricing")
    .select("*")
    .eq("territory_code", territory)
    .limit(3000);

  if (error) {
    throw new Error(error.message || "Erreur export CSV");
  }

  const rows = data || [];
  const headers = rows.length ? Object.keys(rows[0]) : [];
  const lines = [headers.join(";")];
  for (const row of rows) {
    lines.push(headers.map((h) => String((row as any)[h] ?? "")).join(";"));
  }
  const csv = lines.join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `export_${territory}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
