import { Link } from "react-router-dom";
import * as React from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ClipboardList, ShieldCheck, FileCheck2, Target, BarChart3 } from "lucide-react";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";

const PILLARS = [
  {
    title: "Process & responsabilités",
    description: "Cartographier qui fait quoi (vente, ADV, logistique, douane) et définir les points de contrôle.",
    icon: ClipboardList,
  },
  {
    title: "Factures & documents",
    description: "Valider facture, packing list, transport, origine et cohérence incoterm.",
    icon: FileCheck2,
  },
  {
    title: "Taxes, droits & DDP",
    description: "Sécuriser la base douane, les taxes locales, et les frais annexes selon l'incoterm.",
    icon: ShieldCheck,
  },
  {
    title: "Pilotage & marges",
    description: "Suivre les marges par pays/produit et détecter les pertes de rentabilité.",
    icon: BarChart3,
  },
];

const QUICK_CHECKS = [
  "Intitulé exact de l'activité, produits, HS code et destinations prioritaires.",
  "Incoterm utilisé, transport et règles de facturation (HT, TVA, DDP).",
  "Documents obligatoires et responsables de validation.",
  "Marge cible, risques pays et exigences documentaires."
];

export default function Compliance() {
  const { labels, variables } = useGlobalFilters();
  const destinationLabel =
    (labels?.territory_label?.trim() || "") ||
    (String(variables?.territory_code || "").trim() || "");

  const [activityLabel, setActivityLabel] = React.useState("");

  return (
    <AppLayout>
      <div className="space-y-6">
        <section className="rounded-3xl border border-border bg-card/95 p-6 shadow-xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl space-y-2">
              <p className="text-xs font-semibold tracking-[0.2em] text-muted-foreground">
                Audit interne
              </p>
              <h1 className="text-3xl font-semibold font-display text-foreground">
                Audit interne export, clair et actionnable.
              </h1>
              <p className="text-sm text-muted-foreground">
                Identifiez les failles de process, les risques douaniers et les pertes de marge avant le prochain envoi.
              </p>

              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">Priorité : avant devis / expédition</Badge>
                <Badge variant="outline">
                  Destination : {destinationLabel ? destinationLabel : "à définir"}
                </Badge>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button asChild className="gap-2">
                <Link to="/contact?offer=audit-interne">
                  <Target className="h-4 w-4" />
                  Demander un audit
                </Link>
              </Button>
              <Button asChild variant="outline" className="gap-2">
                <Link to="/app/control-tower">
                  <ShieldCheck className="h-4 w-4" />
                  Ouvrir la tour de contrôle
                </Link>
              </Button>
            </div>
          </div>
        </section>

        <Card>
          <CardHeader>
            <CardTitle>Contexte de votre activité</CardTitle>
            <CardDescription>Indiquez l'intitulé exact de l'activité pour adapter l'audit.</CardDescription>
          </CardHeader>
          <CardContent>
            <Input
              value={activityLabel}
              onChange={(e) => setActivityLabel(e.target.value)}
              placeholder="Ex : Fabrication de dispositifs médicaux, cosémétiques, agro..."
            />
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          {PILLARS.map((item) => {
            const Icon = item.icon;
            return (
              <Card key={item.title} className="card-hover">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Icon className="h-5 w-5" />
                    {item.title}
                  </CardTitle>
                  <CardDescription>{item.description}</CardDescription>
                </CardHeader>
              </Card>
            );
          })}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Checklist audit (à valider)</CardTitle>
            <CardDescription>Les points qui évitent 80% des blocages et surcoûts.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <ul className="list-disc space-y-2 pl-5">
              {QUICK_CHECKS.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="card-hover">
            <CardHeader>
              <CardTitle className="text-base">Contrôle facture</CardTitle>
              <CardDescription>Importer une facture ou saisir manuellement les lignes.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="secondary">
                <Link to="/app/invoice-check">Ouvrir l'analyse facture</Link>
              </Button>
            </CardContent>
          </Card>
          <Card className="card-hover">
            <CardHeader>
              <CardTitle className="text-base">Taxes & OM</CardTitle>
              <CardDescription>Droits, TVA import, DDP et frais annexes.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="secondary">
                <Link to="/app/taxes-om">Calculer les taxes</Link>
              </Button>
            </CardContent>
          </Card>
          <Card className="card-hover">
            <CardHeader>
              <CardTitle className="text-base">Guides export</CardTitle>
              <CardDescription>Incoterms, géopolitique et erreurs de process.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="secondary">
                <Link to="/guides">Voir les guides</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
