import * as React from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getAlerts } from "@/lib/leadMagnetApi";
import { formatDateTimeFr } from "@/lib/formatters";
import { EmptyState } from "@/components/EmptyState";
import { demoAlerts } from "@/lib/demoData";
import { DEMO_MODE } from "@/integrations/supabase/client";
import { PanoramicControlTowerMap } from "@/components/controlTower/PanoramicControlTowerMap";

type AlertRow = {
  id: string;
  title: string;
  message: string;
  severity: string;
  detectedAt?: string | null;
  country?: string | null;
  hsPrefix?: string | null;
};

type Severity = "high" | "medium" | "low";

const FALLBACK_COUNTRIES = ["US", "DE", "CN", "GB", "MA"];

function normalizeCountry(v?: string | null) {
  const s = String(v || "").trim().toUpperCase();
  return s || null;
}

function normalizeHs(v?: string | null) {
  const s = String(v || "").replace(/[^0-9]/g, "").trim();
  return s || null;
}

function normalizeSeverity(v?: string | null): Severity {
  const s = String(v || "").trim().toLowerCase();
  if (s === "high" || s === "medium" || s === "low") return s;
  return "medium";
}

function severityBadge(sev: Severity) {
  if (sev === "high") return { label: "Haute", variant: "destructive" as const };
  if (sev === "low") return { label: "Basse", variant: "secondary" as const };
  return { label: "Moyenne", variant: "outline" as const };
}

export default function WatchCenter() {
  const [alerts, setAlerts] = React.useState<AlertRow[]>([]);
  const [updatedAt, setUpdatedAt] = React.useState<string>("");
  const [loading, setLoading] = React.useState(true);

  const [countryFilter, setCountryFilter] = React.useState<string>("all");
  const [hsFilter, setHsFilter] = React.useState<string>("");
  const [severityFilter, setSeverityFilter] = React.useState<string>("all");
  const [q, setQ] = React.useState<string>("");

  React.useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        if (DEMO_MODE) {
          if (!active) return;
          setAlerts(
            demoAlerts.map((a) => ({
              id: a.id,
              title: a.title,
              message: a.message,
              severity: a.severity,
              detectedAt: a.detected_at,
              country: a.country_iso2,
              hsPrefix: a.hs_prefix,
            }))
          );
          setUpdatedAt(new Date().toISOString());
          return;
        }

        const email = localStorage.getItem("mpl_lead_email") || undefined;
        const res = await getAlerts(email);
        if (!active) return;

        setAlerts(
          res.alerts.map((a) => ({
            id: a.id,
            title: a.title,
            message: a.message,
            severity: a.severity,
            detectedAt: a.detectedAt,
            country: a.country,
            hsPrefix: a.hsPrefix,
          }))
        );
        setUpdatedAt(res.updatedAt);
      } catch {
        if (!active) return;
        setAlerts([]);
        setUpdatedAt("");
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, []);

  const filteredAlerts = React.useMemo(() => {
    const qn = q.trim().toLowerCase();
    const hsN = hsFilter.replace(/[^0-9]/g, "").trim();
    const countryN = countryFilter === "all" ? "all" : normalizeCountry(countryFilter);

    return alerts.filter((alert) => {
      const c = normalizeCountry(alert.country);
      const hs = normalizeHs(alert.hsPrefix);
      const sev = normalizeSeverity(alert.severity);

      // Pays (si filtre actif : on exclut aussi les alertes sans pays)
      if (countryN !== "all") {
        if (!c) return false;
        if (c !== countryN) return false;
      }

      // HS prefix (si filtre actif : on exclut aussi les alertes sans HS)
      if (hsN) {
        if (!hs) return false;
        if (!hs.startsWith(hsN)) return false;
      }

      // Sévérité
      if (severityFilter !== "all") {
        if (sev !== severityFilter) return false;
      }

      // Recherche texte
      if (qn) {
        const hay = `${alert.title || ""} ${alert.message || ""}`.toLowerCase();
        if (!hay.includes(qn)) return false;
      }

      return true;
    });
  }, [alerts, countryFilter, hsFilter, severityFilter, q]);

  const selectedCountry = countryFilter === "all" ? null : normalizeCountry(countryFilter);

  const availableCountries = React.useMemo(() => {
    const set = new Set<string>();
    for (const a of alerts) {
      const c = normalizeCountry(a.country);
      if (c) set.add(c);
    }
    const arr = Array.from(set).sort();
    if (selectedCountry && !arr.includes(selectedCountry)) arr.unshift(selectedCountry);
    return arr.length ? arr : FALLBACK_COUNTRIES;
  }, [alerts, selectedCountry]);

  const resetFilters = () => {
    setCountryFilter("all");
    setHsFilter("");
    setSeverityFilter("all");
    setQ("");
  };

  const lastUpdateLabel = updatedAt ? formatDateTimeFr(updatedAt) : "";

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Centre veille</p>
            <h1 className="text-3xl font-semibold">Alertes réglementaires & marché</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>{loading ? "Chargement…" : `${filteredAlerts.length}/${alerts.length} alertes`}</span>
              {lastUpdateLabel ? (
                <span className="text-muted-foreground">• Dernière mise à jour : {lastUpdateLabel}</span>
              ) : null}
              {DEMO_MODE ? <Badge variant="secondary">DEMO</Badge> : null}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={resetFilters} disabled={loading}>
              Réinitialiser
            </Button>
          </div>
        </div>

        <PanoramicControlTowerMap
          selectedCountry={selectedCountry}
          selectedLabel={selectedCountry || "Tous"}
          stats={{ alerts: filteredAlerts.length, updates: alerts.length, total: alerts.length }}
          onCountrySelect={(iso) => setCountryFilter(iso)}
          onReset={() => setCountryFilter("all")}
        />

        <Card className="border border-slate-200">
          <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <CardTitle>Filtres</CardTitle>
            <div className="w-full md:w-80">
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Rechercher (titre, message)…"
              />
            </div>
          </CardHeader>

          <CardContent className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-xs text-slate-500">Pays</label>
              <Select value={countryFilter} onValueChange={setCountryFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Tous" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  {availableCountries.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-slate-500">HS (préfixe)</label>
              <Input
                value={hsFilter}
                onChange={(e) => setHsFilter(e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="Ex : 3004"
                inputMode="numeric"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs text-slate-500">Sévérité</label>
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Toutes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes</SelectItem>
                  <SelectItem value="high">Haute</SelectItem>
                  <SelectItem value="medium">Moyenne</SelectItem>
                  <SelectItem value="low">Basse</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-slate-200">
          <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <CardTitle>Timeline</CardTitle>
            {!loading && alerts.length > 0 ? (
              <div className="text-xs text-muted-foreground">
                Astuce : filtre HS + pays pour réduire le bruit.
              </div>
            ) : null}
          </CardHeader>

          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Chargement…</p>
            ) : alerts.length === 0 ? (
              <EmptyState
                title="Aucune alerte pour le moment"
                description="Active la veille et initialise la base pour recevoir des alertes réglementaires."
                primaryAction={{ label: "Initialiser la base", to: "/resources" }}
                secondaryAction={{ label: "Configurer la veille", to: "/app/centre-veille" }}
              />
            ) : filteredAlerts.length === 0 ? (
              <div className="rounded-2xl border border-border bg-card/70 p-6">
                <div className="text-base font-semibold">Aucun résultat avec ces filtres</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  Essaie d’élargir un filtre (pays / HS / sévérité) ou de vider la recherche.
                </div>
                <div className="mt-4">
                  <Button variant="secondary" onClick={resetFilters}>
                    Réinitialiser les filtres
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredAlerts.map((alert) => {
                  const sev = normalizeSeverity(alert.severity);
                  const { label, variant } = severityBadge(sev);
                  const date = alert.detectedAt || updatedAt;
                  const dateLabel = date ? formatDateTimeFr(date) : "";

                  return (
                    <div key={alert.id} className="border-l-2 border-blue-500 pl-4">
                      {dateLabel ? <div className="text-xs text-muted-foreground">{dateLabel}</div> : null}

                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <div className="font-semibold">{alert.title}</div>
                        <Badge variant={variant}>{label}</Badge>
                      </div>

                      <div className="mt-1 text-sm text-muted-foreground">{alert.message}</div>

                      <div className="mt-2 text-xs text-slate-500">
                        {alert.country ? `Pays : ${normalizeCountry(alert.country)}` : "Pays : n/a"}
                        {" • "}
                        {alert.hsPrefix ? `HS : ${normalizeHs(alert.hsPrefix)}` : "HS : n/a"}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
