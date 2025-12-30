import * as React from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, Scale } from "lucide-react";
import { supabase, SUPABASE_ENV_OK } from "@/integrations/supabase/client";
import { isMissingTableError } from "@/domain/calc";

export default function TaxesOM() {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [taxRulesCount, setTaxRulesCount] = React.useState(0);
  const [omRulesCount, setOmRulesCount] = React.useState(0);
  const [vatRatesCount, setVatRatesCount] = React.useState(0);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError("");

    if (!SUPABASE_ENV_OK) {
      setError("Supabase env manquantes (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).");
      setLoading(false);
      return;
    }

    try {
      const [taxRes, omRes, vatRes] = await Promise.all([
        supabase.from("tax_rules_extra").select("id", { count: "exact", head: true }),
        supabase.from("om_rates").select("id", { count: "exact", head: true }),
        supabase.from("vat_rates").select("id", { count: "exact", head: true }),
      ]);

      const missingTables: string[] = [];

      if (taxRes.error) {
        if (isMissingTableError(taxRes.error)) missingTables.push("tax_rules_extra");
        else throw taxRes.error;
        setTaxRulesCount(0);
      } else {
        setTaxRulesCount(taxRes.count ?? 0);
      }

      if (omRes.error) {
        if (isMissingTableError(omRes.error)) missingTables.push("om_rates");
        else throw omRes.error;
        setOmRulesCount(0);
      } else {
        setOmRulesCount(omRes.count ?? 0);
      }

      if (vatRes.error) {
        if (isMissingTableError(vatRes.error)) missingTables.push("vat_rates");
        else throw vatRes.error;
        setVatRatesCount(0);
      } else {
        setVatRatesCount(vatRes.count ?? 0);
      }

      if (missingTables.length) {
        setError(`Tables manquantes côté Supabase: ${missingTables.join(", ")}. Ajoute les migrations pour activer la page.`);
      } else {
        setError("");
      }
    } catch (e: any) {
      setError(e?.message || "Erreur chargement règles taxes/OM");
      setTaxRulesCount(0);
      setOmRulesCount(0);
      setVatRatesCount(0);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  return (
    <MainLayout>
      <div className="space-y-5">
        <div>
          <p className="text-sm text-muted-foreground">Données</p>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Scale className="h-6 w-6" />
            Taxes & OM
          </h1>
          <p className="text-sm text-muted-foreground">
            Référentiels: <code className="text-xs">vat_rates</code>,{" "}
            <code className="text-xs">tax_rules_extra</code> et <code className="text-xs">om_rates</code>
          </p>
        </div>

        {error ? (
          <Card className={error.toLowerCase().includes("manquante") ? "border-amber-300 bg-amber-50" : "border-red-200"}>
            <CardContent className="pt-6 text-sm text-foreground">{error}</CardContent>
          </Card>
        ) : null}

        <div className="flex flex-wrap gap-2 items-center">
          <Badge variant="secondary">VAT rates: {loading ? "…" : vatRatesCount}</Badge>
          <Badge variant="secondary">Tax rules: {loading ? "…" : taxRulesCount}</Badge>
          <Badge variant="secondary">OM rules: {loading ? "…" : omRulesCount}</Badge>
          <Button variant="outline" onClick={load} disabled={loading} className="ml-auto gap-2">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Actualiser
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>À brancher dans le moteur</CardTitle>
            <CardDescription>
              Ces règles alimentent : simulateur, marge, dashboard (OM DROM + taxes par zone/incoterm).
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <div>• OM/OMR : généralement par HS code + drom_code (validité dates).</div>
            <div>• Taxes : TVA/droits/taxes locales selon zone + incoterm (validité dates).</div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
