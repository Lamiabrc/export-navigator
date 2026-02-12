import * as React from "react";
import { Link } from "react-router-dom";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Lock, Sparkles } from "lucide-react";
import { PanoramicControlTowerMap } from "@/components/controlTower/PanoramicControlTowerMap";

type GateMode = "invoice-check" | "analyse" | "costing" | "watch";

type GateConfig = {
  eyebrow: string;
  title: string;
  subtitle: string;
  appPath: string;
  bullets: string[];
  preview?: boolean;
};

const CONFIG: Record<GateMode, GateConfig> = {
  "invoice-check": {
    eyebrow: "Outil facture",
    title: "La vérification facture est disponible dans l'application.",
    subtitle:
      "Le site public reste informatif. Connectez-vous pour tester les contrôles, la simulation et la Control Tower.",
    appPath: "/app/invoice-check",
    bullets: [
      "Contrôle cohérence (Incoterm, assurance, documents).",
      "Simulations coûts/marge et droits estimés.",
      "Historique + suivi par destination.",
    ],
    preview: true,
  },
  analyse: {
    eyebrow: "Analyse coûts",
    title: "L'analyse complète se fait dans l'application.",
    subtitle:
      "Les calculateurs et simulateurs sont centralisés dans l'app pour garantir vos sauvegardes, l'historique et la sécurité.",
    appPath: "/app/simulator",
    bullets: [
      "Calcul du prix de revient rendu.",
      "Scénarios par Incoterm et mode de transport.",
      "Comparaison marge / sensibilité.",
    ],
  },
  costing: {
    eyebrow: "Simulation export",
    title: "La simulation est disponible dans l'application.",
    subtitle:
      "Connectez-vous pour lancer vos calculs, conserver vos scénarios et accéder aux recommandations.",
    appPath: "/app/simulator",
    bullets: [
      "Simulation coûts complets (douane, assurance, logistique).",
      "Rapport exportable.",
      "Historique par dossier.",
    ],
  },
  watch: {
    eyebrow: "Veille",
    title: "La veille personnalisée est accessible dans l'application.",
    subtitle:
      "Le site public présente l'offre. L'application centralise vos pays/HS et les alertes utiles.",
    appPath: "/app/centre-veille/reglementation",
    bullets: [
      "Flux pays + secteurs + sanctions.",
      "Alertes ciblées par destination et HS.",
      "Suivi des priorités en équipe.",
    ],
    preview: true,
  },
};

const PREVIEW_STATS = {
  FR: { label: "France", total: 14 },
  DE: { label: "Allemagne", total: 9 },
  US: { label: "Etats-Unis", total: 7 },
  CN: { label: "Chine", total: 5 },
  GB: { label: "Royaume-Uni", total: 4 },
};

const WATCH_FEED_PREVIEW = [
  { id: "1", title: "Maroc — contrôle documentaire renforcé", detail: "Impact potentiel sur les délais de dédouanement." },
  { id: "2", title: "USA — ajustement tarifaire HS 84", detail: "Vérifier vos prix DDP et la marge minimale." },
  { id: "3", title: "UE — mise à jour conformité emballages", detail: "Anticiper les justificatifs pour les produits sensibles." },
];

export default function PublicAppGate({ mode }: { mode: GateMode }) {
  const config = CONFIG[mode];
  const [selected, setSelected] = React.useState<string | null>("FR");

  return (
    <PublicLayout>
      <div className="space-y-10">
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-center">
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.35em] text-blue-600">{config.eyebrow}</p>
            <h1 className="text-4xl font-semibold text-slate-900">{config.title}</h1>
            <p className="text-slate-600">{config.subtitle}</p>

            <div className="flex flex-wrap gap-2">
              {config.bullets.map((b) => (
                <Badge key={b} variant="outline" className="gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {b}
                </Badge>
              ))}
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <Button asChild className="gap-2">
                <Link to={`/register?next=${encodeURIComponent(config.appPath)}`}>
                  <Sparkles className="h-4 w-4" />
                  Créer un compte gratuit
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link to={`/login?next=${encodeURIComponent(config.appPath)}`}>Se connecter</Link>
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              Le site public est informatif. Les calculs et simulations se font dans l'application.
            </p>
          </div>

          <Card className="overflow-hidden border-blue-200 bg-gradient-to-br from-white via-slate-50 to-blue-50">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Lock className="h-4 w-4 text-blue-600" />
                Accès application
              </CardTitle>
              <CardDescription>
                Connectez-vous pour accéder a la Control Tower, aux simulateurs et a la veille.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-600">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="font-medium text-slate-900">Control Tower</div>
                  <div className="text-xs">Pilotage pays/HS, marges et alertes.</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="font-medium text-slate-900">Simulations</div>
                  <div className="text-xs">Couts complets et scénarios Incoterm.</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="font-medium text-slate-900">Veille</div>
                  <div className="text-xs">Flux pays, sanctions, réglementations.</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="font-medium text-slate-900">Historique</div>
                  <div className="text-xs">Sauvegarde et suivi des décisions.</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {config.preview ? (
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
              <p className="text-xs uppercase tracking-[0.35em] text-blue-600">Aperçu</p>
              <h2 className="text-2xl font-semibold text-slate-900">Prévisualisation Control Tower</h2>
            </div>
            <Badge variant="outline">Exemple visuel (demo)</Badge>
          </div>

            <Card className="border-slate-200 bg-white/90">
              <CardContent className="p-0">
                <div className="grid grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)]">
                  <aside className="border-b border-slate-200 bg-white/95 px-4 py-5 text-slate-700 lg:border-b-0 lg:border-r">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-400">
                      Accueil
                    </div>
                    <div className="mt-3 flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-900 shadow-sm">
                      <span>Tour de contrôle</span>
                      <Badge className="bg-blue-600 text-white hover:bg-blue-600">Live</Badge>
                    </div>

                    <div className="mt-5 text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-400">
                      Décider vite
                    </div>
                    <div className="mt-2 space-y-2 text-sm">
                      {["Analyse coûts", "Contrôle facture", "Taxes & OM"].map((item) => (
                        <div key={item} className="flex items-center gap-2 text-slate-600">
                          <span className="h-2 w-2 rounded-full bg-slate-300" />
                          {item}
                        </div>
                      ))}
                    </div>

                    <div className="mt-5 text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-400">
                      Conformité
                    </div>
                    <div className="mt-2 space-y-2 text-sm">
                      {["Centre conformité", "Guides (Incoterms, TVA)", "Veille réglementaire"].map((item) => (
                        <div key={item} className="flex items-center gap-2 text-slate-600">
                          <span className="h-2 w-2 rounded-full bg-slate-300" />
                          {item}
                        </div>
                      ))}
                    </div>

                    <div className="mt-5 text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-400">
                      Référentiels
                    </div>
                    <div className="mt-2 space-y-2 text-sm">
                      {["Produits (HS code)", "Clients & fournisseurs"].map((item) => (
                        <div key={item} className="flex items-center gap-2 text-slate-600">
                          <span className="h-2 w-2 rounded-full bg-slate-300" />
                          {item}
                        </div>
                      ))}
                    </div>

                    <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
                      Aperçu interface — connectez-vous pour tout débloquer.
                    </div>
                  </aside>

                  <div className="p-4 md:p-6">
                    {mode === "watch" ? (
                      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
                        <PanoramicControlTowerMap
                          selectedCountry={selected}
                          selectedLabel={selected ?? undefined}
                          countryStats={PREVIEW_STATS}
                          onCountrySelect={(iso) => setSelected(iso)}
                          onReset={() => setSelected(null)}
                        />
                        <div className="rounded-2xl border border-slate-200 bg-white p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">Flux de veille</p>
                          <div className="mt-3 space-y-3">
                            {WATCH_FEED_PREVIEW.map((item) => (
                              <div key={item.id} className="rounded-xl border border-slate-200 p-3">
                                <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                                <p className="mt-1 text-xs text-slate-600">{item.detail}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <PanoramicControlTowerMap
                        selectedCountry={selected}
                        selectedLabel={selected ?? undefined}
                        countryStats={PREVIEW_STATS}
                        onCountrySelect={(iso) => setSelected(iso)}
                        onReset={() => setSelected(null)}
                      />
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>
        ) : null}
      </div>
    </PublicLayout>
  );
}
