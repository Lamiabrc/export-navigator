import * as React from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getAlerts } from "@/lib/leadMagnetApi";
import { formatDateTimeFr } from "@/lib/formatters";
import { EmptyState } from "@/components/EmptyState";
import { demoAlerts } from "@/lib/demoData";
import { DEMO_MODE } from "@/integrations/supabase/client";

type AlertRow = {
  id: string;
  title: string;
  message: string;
  severity: string;
  detectedAt?: string | null;
  country?: string | null;
  hsPrefix?: string | null;
};

export default function WatchCenter() {
  const [alerts, setAlerts] = React.useState<AlertRow[]>([]);
  const [updatedAt, setUpdatedAt] = React.useState<string>("");
  const [loading, setLoading] = React.useState(true);
  const [countryFilter, setCountryFilter] = React.useState<string>("all");
  const [hsFilter, setHsFilter] = React.useState<string>("");
  const [severityFilter, setSeverityFilter] = React.useState<string>("all");

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
    return alerts.filter((alert) => {
      if (countryFilter !== "all" && alert.country && alert.country !== countryFilter) return false;
      if (hsFilter && alert.hsPrefix && !String(alert.hsPrefix).startsWith(hsFilter)) return false;
      if (severityFilter !== "all" && alert.severity !== severityFilter) return false;
      return true;
    });
  }, [alerts, countryFilter, hsFilter, severityFilter]);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <p className="text-sm text-muted-foreground">Centre veille</p>
          <h1 className="text-3xl font-semibold">Alertes réglementaires & marché</h1>
        </div>

        <Card className="border border-slate-200">
          <CardHeader>
            <CardTitle>Filtres</CardTitle>
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
                  <SelectItem value="US">US</SelectItem>
                  <SelectItem value="DE">DE</SelectItem>
                  <SelectItem value="CN">CN</SelectItem>
                  <SelectItem value="GB">GB</SelectItem>
                  <SelectItem value="MA">MA</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-xs text-slate-500">HS prefix</label>
              <Input value={hsFilter} onChange={(e) => setHsFilter(e.target.value.replace(/[^0-9]/g, ""))} placeholder="Ex: 3004" />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-slate-500">SÃ©vÃ©ritÃ©</label>
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
          <CardHeader>
            <CardTitle>Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Chargement...</p>
            ) : filteredAlerts.length === 0 ? (
              <EmptyState
                title="Aucune alerte pour le moment"
                description="Active la veille et initialise la base pour recevoir les alertes réglementaires."
                primaryAction={{ label: "Initialiser la base", to: "/resources" }}
                secondaryAction={{ label: "Configurer la veille", to: "/app/centre-veille" }}
              />
            ) : (
              <div className="space-y-4">
                {filteredAlerts.map((alert) => (
                  <div key={alert.id} className="border-l-2 border-blue-500 pl-4">
                    <div className="text-xs text-muted-foreground">{formatDateTimeFr(alert.detectedAt || updatedAt)}</div>
                    <div className="font-semibold">{alert.title}</div>
                    <div className="text-sm text-muted-foreground">{alert.message}</div>
                    <div className="mt-2 text-xs text-slate-500">
                      {alert.country ? `Pays: ${alert.country}` : "Pays: n/a"} • {alert.hsPrefix ? `HS: ${alert.hsPrefix}` : "HS: n/a"} • {alert.severity || "medium"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
