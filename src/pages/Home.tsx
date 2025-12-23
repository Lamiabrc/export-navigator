import { Link } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Map, LayoutDashboard, ShieldCheck, Database, Compass, BellRing, Sparkles, PlayCircle } from 'lucide-react';

export default function Home() {
  return (
    <MainLayout>
      <div className="space-y-8">
        <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-slate-50 p-8">
          <div className="absolute inset-0 opacity-40 pointer-events-none bg-[radial-gradient(circle_at_20%_20%,rgba(56,189,248,0.25),transparent_25%),radial-gradient(circle_at_80%_30%,rgba(94,234,212,0.2),transparent_25%),radial-gradient(circle_at_50%_80%,rgba(167,139,250,0.22),transparent_25%)]" />
          <div className="relative flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="border-cyan-300 text-cyan-100 bg-white/5 backdrop-blur">
                <Sparkles className="h-3.5 w-3.5 mr-1" /> Cockpit Export Navigator
              </Badge>
              <Badge variant="secondary" className="bg-white/10 text-white border-white/20 animate-pulse">Live</Badge>
            </div>
            <h1 className="text-4xl font-bold leading-tight">
              Contrôle des flux export <span className="text-cyan-300">par couches</span>, rapprochement, alertes
            </h1>
            <p className="text-slate-200/80 max-w-3xl">
              Carte interactive (transport / douane-DDP / TVA), imports factures + coûts réels, rapprochement automatique,
              KPIs marge & couverture transit, alertes de cohérence. Données locales, zéro backend.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link to="/flows">
                <Button className="gap-2 shadow-lg shadow-cyan-500/30 hover:translate-y-[-1px] transition">
                  <Map className="h-4 w-4" />
                  Carte des flux
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/imports">
                <Button variant="secondary" className="gap-2 border border-white/20 bg-white/10 text-white hover:bg-white/20">
                  <Database className="h-4 w-4" />
                  Importer les données
                </Button>
              </Link>
              <Link to="/dashboard">
                <Button variant="ghost" className="gap-2 text-white hover:bg-white/10">
                  <LayoutDashboard className="h-4 w-4" />
                  Dashboard direction
                </Button>
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
              {[
                { label: 'Couverture transit', value: 'Live', tone: 'text-cyan-200' },
                { label: 'Rapprochements', value: 'Factures vs coûts', tone: 'text-emerald-200' },
                { label: 'Alertes', value: 'Incoterm / DDP / TVA', tone: 'text-amber-200' },
              ].map((kpi, idx) => (
                <div
                  key={kpi.label}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm backdrop-blur flex items-center justify-between"
                  style={{ animation: `pulse ${4 + idx}s ease-in-out infinite` }}
                >
                  <span className="text-slate-100/90">{kpi.label}</span>
                  <span className={`font-semibold ${kpi.tone}`}>{kpi.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="hover:shadow-lg hover:-translate-y-1 transition-all">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Compass className="h-5 w-5 text-primary animate-spin-slow" />
                Carte par couches
              </CardTitle>
              <CardDescription>Flux export en anneaux (transport, douane/DDP, TVA) avec coûts/destinations.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>Filtre par couche, ajout de destinations/couches, sauvegarde locale.</p>
              <Link to="/flows">
                <Button variant="link" className="px-0">Ouvrir la carte</Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg hover:-translate-y-1 transition-all">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                Contrôle & rapprochement
              </CardTitle>
              <CardDescription>Imports CSV (factures, coûts réels), match auto, couverture transit, alertes.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>Importez factures et coûts, vérifiez match, marge et alertes (incoterm, DDP, TVA, transit).</p>
              <div className="flex gap-2">
                <Link to="/imports"><Button variant="link" className="px-0">Importer</Button></Link>
                <Link to="/invoices"><Button variant="link" className="px-0">Rapprochements</Button></Link>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg hover:-translate-y-1 transition-all">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BellRing className="h-5 w-5 text-primary" />
                Pilotage & bible
              </CardTitle>
              <CardDescription>Dashboards, marge/couverture transit, référentiel Incoterms/destinations.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>KPIs, top pertes, marge par destination/client/incoterm, guide et référentiel versionné.</p>
              <div className="flex gap-2">
                <Link to="/margin-analysis"><Button variant="link" className="px-0">Analyse marges</Button></Link>
                <Link to="/reference-library"><Button variant="link" className="px-0">Référentiel</Button></Link>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-dashed hover:shadow-md transition-all">
          <CardHeader className="flex items-center justify-between">
            <div>
              <CardTitle>Mode d’emploi rapide</CardTitle>
              <CardDescription>6 étapes pour être opérationnel</CardDescription>
            </div>
            <PlayCircle className="h-6 w-6 text-primary animate-pulse" />
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-muted-foreground">
            <div className="space-y-2">
              <p>1. Importer : onglet Imports → CSV Factures + CSV Coûts réels (transit/douane).</p>
              <p>2. Visualiser : onglet Flows → carte des flux par couches, vérifier les destinations sensibles.</p>
              <p>3. Contrôler : onglet Invoices → rapprochements, alertes, couverture transit.</p>
            </div>
            <div className="space-y-2">
              <p>4. Piloter : onglet Margin Analysis → top pertes, marge par destination/client/incoterm.</p>
              <p>5. Référentiel : onglet Reference Library → Incoterms/destinations, import/export JSON.</p>
              <p>6. Logistique/Finance : checklists, charges, documents (pages Logistics/Finance).</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
