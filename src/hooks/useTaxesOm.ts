import { useCallback, useState } from "react";
import { supabase, SUPABASE_ENV_OK } from "@/integrations/supabase/client";
import { isMissingTableError } from "@/domain/calc";

export type TaxesOmCounts = {
  vatRates: number;
  taxRulesExtra: number;
  omRates: number;
};

export function useTaxesOm() {
  const [counts, setCounts] = useState<TaxesOmCounts>({ vatRates: 0, taxRulesExtra: 0, omRates: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError("");
    setWarning("");

    if (!SUPABASE_ENV_OK) {
      setWarning("Supabase env manquantes (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).");
      setCounts({ vatRates: 0, taxRulesExtra: 0, omRates: 0 });
      setIsLoading(false);
      return;
    }

    try {
      const [vatRes, taxRes, omRes] = await Promise.all([
        supabase.from("vat_rates").select("id", { count: "exact", head: true }),
        supabase.from("tax_rules_extra").select("id", { count: "exact", head: true }),
        supabase.from("om_rates").select("id", { count: "exact", head: true }),
      ]);

      const missing: string[] = [];

      if (vatRes.error) {
        if (isMissingTableError(vatRes.error)) missing.push("vat_rates");
        else throw vatRes.error;
      }
      if (taxRes.error) {
        if (isMissingTableError(taxRes.error)) missing.push("tax_rules_extra");
        else throw taxRes.error;
      }
      if (omRes.error) {
        if (isMissingTableError(omRes.error)) missing.push("om_rates");
        else throw omRes.error;
      }

      if (missing.length) {
        setWarning(`Tables manquantes côté Supabase: ${missing.join(", ")}. Ajoute la migration SQL fournie pour activer la page.`);
        setCounts({ vatRates: vatRes.count ?? 0, taxRulesExtra: taxRes.count ?? 0, omRates: omRes.count ?? 0 });
      } else {
        setCounts({
          vatRates: vatRes.count ?? 0,
          taxRulesExtra: taxRes.count ?? 0,
          omRates: omRes.count ?? 0,
        });
      }
    } catch (e: any) {
      setError(e?.message || "Erreur chargement règles taxes/OM");
      setCounts({ vatRates: 0, taxRulesExtra: 0, omRates: 0 });
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { counts, isLoading, error, warning, refresh };
}
