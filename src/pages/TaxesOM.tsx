import * as React from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, Scale } from "lucide-react";
import { useTaxesOm } from "@/hooks/useTaxesOm";

export default function TaxesOM() {
  const { counts, isLoading, error, warning, refresh } = useTaxesOm();

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

        {error || warning ? (
          <Card className={(warning || "").toLowerCase().includes("manquante") ? "border-amber-300 bg-amber-50" : "border-red-200"}>
            <CardContent className="pt-6 text-sm text-foreground">{error || warning}</CardContent>
          </Card>
        ) : null}

        <div className="flex flex-wrap gap-2 items-center">
          <Badge variant="secondary">VAT rates: {isLoading ? "…" : counts.vatRates}</Badge>
          <Badge variant="secondary">Tax rules: {isLoading ? "…" : counts.taxRulesExtra}</Badge>
          <Badge variant="secondary">OM rules: {isLoading ? "…" : counts.omRates}</Badge>
          <Button variant="outline" onClick={refresh} disabled={isLoading} className="ml-auto gap-2">
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
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
