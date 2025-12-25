import { Link } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { KPIStatCard } from "@/components/strategy/KPIStatCard";
import { InsightCard } from "@/components/strategy/InsightCard";
import { RiskBadge } from "@/components/strategy/RiskBadge";
import { PageHeader } from "@/components/PageHeader";

const kpis = [
  { title: "Opportunites prix", value: "12", delta: "+3 cette semaine", badge: "NEW" },
  { title: "Risque conformite", value: "3 alertes", delta: "Prioriser DROM", badge: "PRO" },
  { title: "Marge moyenne", value: "42%", delta: "+2.1 pts" },
  { title: "Temps de cycle", value: "9j", delta: "-1.3j" },
];

const alerts = [
  { id: "a1", label: "Aligner prix DROM vs Gibaud sur chevillere", level: "medium" as const },
  { id: "a2", label: "Verifier LPP pour nouvelle gamme genou", level: "high" as const },
  { id: "a3", label: "Mettre a jour scenarii logistiques Miami", level: "low" as const },
];

export default function StrategyHub() {
  return (
    <MainLayout>
      <PageHeader
        title="Strategy Hub"
        subtitle="Un seul ecran pour decider : prix, scenarios, alertes."
        actions={
          <Link
            to="/scenario-lab"
            className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/30 border border-primary/60"
          >
            Ouvrir Scenario Lab
          </Link>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mt-4">
        {kpis.map((item) => (
          <KPIStatCard
            key={item.title}
            title={item.title}
            value={item.value}
            delta={item.delta}
            badge={item.badge}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-6">
        <div className="lg:col-span-2 space-y-4">
          <InsightCard
            accent="primary"
            title="Recommandation du jour"
            bullets={[
              "Prioriser offre premium sur DROM avec pack service",
              "Aligner prix retail sur Gibaud pour proteger volumes",
              "Envoyer note flash aux commerciaux DROM",
            ]}
          />

          <div className="rounded-2xl border border-border bg-card p-4 space-y-3 dark:border-white/10 dark:bg-white/5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                ⚠️ Alertes a traiter
              </h2>
              <span className="text-xs text-muted-foreground">Automatique + manuel</span>
            </div>
            <div className="space-y-2">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className="flex items-center justify-between rounded-xl bg-muted/40 border border-border px-3 py-2 dark:border-white/10 dark:bg-white/5"
                >
                  <span className="text-sm text-foreground">{alert.label}</span>
                  <RiskBadge level={alert.level} />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-4 dark:border-white/10 dark:bg-white/5">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              🚀 Scenarios rapides
            </h2>
            <p className="text-sm text-muted-foreground mb-3">
              Pre-remplis Scenario Lab avec une strategie cible.
            </p>
            <div className="grid grid-cols-1 gap-2">
              {[
                { label: "Premium", strategy: "premium" },
                { label: "Match", strategy: "match" },
                { label: "Penetration", strategy: "penetration" },
              ].map((item) => (
                <Link
                  key={item.strategy}
                  to={`/scenario-lab?strategy=${item.strategy}&market=DROM&channel=hospital`}
                  className="rounded-xl border border-border bg-card px-3 py-2 text-sm font-semibold text-foreground hover:border-primary/50 hover:-translate-y-0.5 transition dark:border-white/10 dark:bg-white/5 dark:text-white"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4 space-y-2 dark:border-white/10 dark:bg-white/5">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              🔗 Liens rapides
            </h2>
            <div className="space-y-2 text-sm text-muted-foreground">
              <Link to="/competitive" className="block hover:text-primary text-foreground">
                Competitive Intel
              </Link>
              <Link to="/drom-playbook" className="block hover:text-primary text-foreground">
                DROM Playbook
              </Link>
              <Link to="/dashboard" className="block hover:text-primary text-foreground">
                Dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
