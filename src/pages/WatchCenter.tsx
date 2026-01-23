import * as React from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAlerts } from "@/lib/leadMagnetApi";

export default function WatchCenter() {
  const [alerts, setAlerts] = React.useState<Array<{ id: string; title: string; message: string; severity: string; detectedAt?: string | null }>>([]);
  const [updatedAt, setUpdatedAt] = React.useState<string>("");
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const email = localStorage.getItem("mpl_lead_email") || undefined;
        const res = await getAlerts(email);
        if (!active) return;
        setAlerts(res.alerts);
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

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <p className="text-sm text-muted-foreground">Centre veille</p>
          <h1 className="text-3xl font-semibold">Alertes reglementaires & marche</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Chargement...</p>
            ) : alerts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune alerte pour le moment. Active la personnalisation.</p>
            ) : (
              <div className="space-y-4">
                {alerts.map((alert) => (
                  <div key={alert.id} className="border-l-2 border-blue-500 pl-4">
                    <div className="text-xs text-muted-foreground">{alert.detectedAt || updatedAt}</div>
                    <div className="font-semibold">{alert.title}</div>
                    <div className="text-sm text-muted-foreground">{alert.message}</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
