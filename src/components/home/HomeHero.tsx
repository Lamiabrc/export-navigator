import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, Radar } from "lucide-react";

import heroExportVideo from "@/assets/hero-export.mp4";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type HeroLabels = {
  badge: string;
  title: string;
  intro: string;
  bullets: string[];
  ctaVideo: string;
  ctaTower: string;
  ctaContact: string;
  confidentiality: string;
};

export function HomeHero({
  labels,
  isEn,
}: {
  labels: HeroLabels;
  isEn: boolean;
}) {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-gradient-to-b from-white to-slate-50/70 p-6 sm:p-8 lg:p-10">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-r from-primary/5 via-transparent to-emerald-500/5" />
      <div className="relative grid items-start gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)] lg:gap-10">
        <div className="space-y-6">
          <Badge variant="secondary" className="w-fit rounded-full px-3 py-1 text-xs">{labels.badge}</Badge>
          <div className="space-y-4">
            <h1 className="text-balance text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">{labels.title}</h1>
            <p className="max-w-2xl text-lg text-slate-600">{labels.intro}</p>
          </div>
          <ul className="space-y-2 text-slate-700">
            {labels.bullets.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Button asChild size="lg" className="sm:min-w-60">
              <Link to="/#hero-video">
                {labels.ctaVideo} <ArrowRight className="ml-2 size-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="sm:min-w-52">
              <Link to="/login?next=%2Fapp%2Fcontrol-tower">{labels.ctaTower}</Link>
            </Button>
            <Button asChild variant="ghost" size="lg" className="justify-start px-0 text-slate-700 hover:text-slate-900 sm:px-4">
              <Link to="/contact">{labels.ctaContact}</Link>
            </Button>
          </div>
          <p className="text-sm text-slate-500">{labels.confidentiality}</p>
        </div>

        <div className="space-y-4">
          <Card className="border-slate-200 bg-white shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Radar className="size-5 text-primary" />
                {isEn ? "Mock — Go/No-Go report" : "Mock — Rapport Go/No-Go"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-slate-700">
              <div className="rounded-xl border bg-slate-50 p-3">
                <p className="font-medium">{isEn ? "Country: Morocco • Product: Machinery" : "Pays: Maroc • Produit: Machines"}</p>
                <p className="text-emerald-700">{isEn ? "Verdict: GO with conditions" : "Verdict: GO sous conditions"}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border bg-white p-3">
                  <p className="text-slate-500">{isEn ? "Risk" : "Risque"}</p>
                  <p className="font-semibold">42 / 100</p>
                </div>
                <div className="rounded-lg border bg-white p-3">
                  <p className="text-slate-500">{isEn ? "Deliverables" : "Livrables"}</p>
                  <p className="font-semibold">{isEn ? "Checklist + client email" : "Checklist + email client"}</p>
                </div>
              </div>
              <div className="rounded-lg border bg-white p-3">
                <p className="font-semibold text-slate-900">{isEn ? "Action 1: Validate Incoterm + insurance" : "Action 1 : Vérifier Incoterm + assurance"}</p>
              </div>
              <p className="text-sm text-slate-600">
                {isEn
                  ? "Decision-oriented report: VAT/customs risks, priority actions, deliverables and execution follow-up."
                  : "Rapport orienté décision : risques TVA/douane, actions prioritaires, livrables et suivi d’exécution."}
              </p>
            </CardContent>
          </Card>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-950/95 p-2">
            <video className="aspect-video w-full rounded-lg" autoPlay muted loop playsInline preload="metadata">
              <source src={heroExportVideo} type="video/mp4" />
            </video>
            <p className="px-1 pt-2 text-xs text-slate-300">{isEn ? "Quick product preview in real conditions." : "Aperçu rapide de la plateforme en conditions réelles."}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
