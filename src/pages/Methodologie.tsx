import React from "react";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const sources = [
  { label: "Economie.gouv.fr (actualites)", note: "Reglementation et politique commerciale" },
  { label: "Service-Public Pro", note: "Infos pratiques pour entreprises" },
  { label: "WTO - Latest News", note: "Commerce international et mesures" },
];

const limits = [
  "Estimation indicative fondee sur vos donnees manuelles.",
  "Les taux de droits/TVA ne sont pas fournis automatiquement.",
  "Validation finale par votre conseil douane/transitaire requise.",
];

const steps = [
  "Saisie des couts et parametres de votre scenario.",
  "Calcul du landed cost et du cout unitaire si quantite.",
  "Comparaison de scenarios (incoterm, transport, couts).",
  "Lecture decisionnelle: risques, checklist documents, rappel incoterms.",
];

export default function Methodologie() {
  return (
    <PublicLayout>
      <div className="space-y-10">
        <section className="space-y-3 text-white">
          <p className="text-xs uppercase tracking-[0.35em] text-blue-200">Methodologie</p>
          <h1 className="text-4xl font-semibold">Comment MPL Export Conseil calcule vos estimations.</h1>
          <p className="text-lg text-slate-200">
            Transparence, limites et sources. L'objectif: aider a la decision, pas remplacer un expert.
          </p>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <Card className="border border-white/15 bg-white/10 text-white backdrop-blur">
            <CardHeader>
              <CardTitle>Structure des couts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-200">
              {steps.map((step) => (
                <div key={step} className="flex items-start gap-2">
                  <Badge className="bg-white/10 text-white border-white/20">OK</Badge>
                  <span>{step}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border border-white/15 bg-white/10 text-white backdrop-blur">
            <CardHeader>
              <CardTitle>Limites & hypotheses</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-200">
              {limits.map((limit) => (
                <div key={limit} className="flex items-start gap-2">
                  <Badge className="bg-white/10 text-white border-white/20">Info</Badge>
                  <span>{limit}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <Card className="border border-white/15 bg-white/10 text-white backdrop-blur">
            <CardHeader>
              <CardTitle>Sources de veille</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-200">
              {sources.map((source) => (
                <div key={source.label}>
                  <div className="font-semibold text-white">{source.label}</div>
                  <div>{source.note}</div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border border-white/15 bg-white/10 text-white backdrop-blur">
            <CardHeader>
              <CardTitle>RGPD & confidentialite</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-200">
              <p>Vos donnees restent dans votre navigateur pour les scenarios gratuits.</p>
              <p>Les demandes d'audit sont traitees manuellement par MPL Export Conseil.</p>
              <p>Vous pouvez demander la suppression de vos informations a tout moment.</p>
            </CardContent>
          </Card>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-gradient-to-r from-blue-700 via-blue-900 to-red-600 p-6 text-white">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.25em] text-white/70">Besoin d'une validation ?</div>
              <div className="text-2xl font-semibold">Demandez un audit complet ou une validation express.</div>
            </div>
            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => (window.location.href = "/contact?offer=express")}
              >
                Validation express
              </Button>
              <Button variant="outline" className="border-white text-white hover:bg-white/10" onClick={() => (window.location.href = "/contact")}
              >
                Demander un audit
              </Button>
            </div>
          </div>
        </section>
      </div>
    </PublicLayout>
  );
}
