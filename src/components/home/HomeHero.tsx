import * as React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, Radar } from "lucide-react";

import heroExportVideo from "@/assets/hero-export.mp4";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { HeroLabels } from "@/content/homeContent";

type CountryInsight = {
  verdictFr: string;
  verdictEn: string;
  risk: number;
  actionFr: string;
  actionEn: string;
  rssFr: [string, string];
  rssEn: [string, string];
};

type ExporterRecord = {
  company: string;
  city: string;
  products: string;
  markets: string;
};

const COUNTRY_OPTIONS = ["Maroc", "Sénégal", "Canada", "Allemagne", "EAU"];

const FRENCH_EXPORTERS_SAMPLE: ExporterRecord[] = [
  {
    company: "LactaFrais Export",
    city: "Lyon",
    products: "Produits laitiers UHT",
    markets: "Maroc, Sénégal, Côte d’Ivoire",
  },
  {
    company: "HexaTech Industrie",
    city: "Toulouse",
    products: "Pièces machines (HS 84)",
    markets: "Allemagne, Espagne, Italie",
  },
  {
    company: "Maison Atlantique",
    city: "Bordeaux",
    products: "Cosmétiques & soins",
    markets: "Canada, EAU, Belgique",
  },
];

const COUNTRY_INSIGHTS: Record<string, CountryInsight> = {
  Maroc: {
    verdictFr: "GO sous conditions",
    verdictEn: "GO with conditions",
    risk: 42,
    actionFr: "Vérifier Incoterm + assurance transport",
    actionEn: "Validate Incoterm + cargo insurance",
    rssFr: [
      "TVA import: valider taux et base taxable avant devis.",
      "Douane: contrôler documents d’origine + conformité produit.",
    ],
    rssEn: [
      "Import VAT: validate rate and taxable base before quotation.",
      "Customs: check origin documents and product compliance.",
    ],
  },
  "Sénégal": {
    verdictFr: "GO avec vigilance paiement",
    verdictEn: "GO with payment vigilance",
    risk: 51,
    actionFr: "Sécuriser le règlement (acompte ou crédit doc)",
    actionEn: "Secure payment terms (deposit or documentary credit)",
    rssFr: [
      "Paiement: privilégier acompte confirmé avant expédition.",
      "Logistique: anticiper délais portuaires et frais locaux.",
    ],
    rssEn: [
      "Payment: prioritize confirmed deposit before shipment.",
      "Logistics: anticipate port delays and local charges.",
    ],
  },
  Canada: {
    verdictFr: "GO",
    verdictEn: "GO",
    risk: 29,
    actionFr: "Valider classification HS + preuves origine",
    actionEn: "Validate HS classification + origin evidence",
    rssFr: [
      "Conformité: vérifier marquage/étiquetage selon province.",
      "Douane: consolider code HS et origine préférentielle.",
    ],
    rssEn: [
      "Compliance: confirm labelling rules by province.",
      "Customs: consolidate HS code and preferential origin.",
    ],
  },
  Allemagne: {
    verdictFr: "GO",
    verdictEn: "GO",
    risk: 24,
    actionFr: "Confirmer obligations intra-UE (TVA, emballages)",
    actionEn: "Confirm intra-EU obligations (VAT, packaging)",
    rssFr: [
      "TVA: vérifier flux intracommunautaire et justificatifs.",
      "Emballages: anticiper obligations de reprise et déclaration.",
    ],
    rssEn: [
      "VAT: check intra-community flow and proof documents.",
      "Packaging: plan take-back and filing obligations.",
    ],
  },
  EAU: {
    verdictFr: "GO sous conformité renforcée",
    verdictEn: "GO with enhanced compliance",
    risk: 48,
    actionFr: "Vérifier restrictions sectorielles et certificats",
    actionEn: "Check sector restrictions and certificates",
    rssFr: [
      "Conformité: confirmer exigences certificat produit.",
      "Contrat: cadrer responsabilités Incoterm et assurance.",
    ],
    rssEn: [
      "Compliance: confirm product certificate requirements.",
      "Contract: align Incoterm responsibilities and insurance.",
    ],
  },
};

function hsGuidance(hsCode: string, isEn: boolean) {
  const code = hsCode.replace(/[^0-9]/g, "");
  if (!code) {
    return isEn
      ? "Add an HS code to refine customs/tax checks by destination."
      : "Ajoutez un code HS pour affiner les contrôles douane/taxes par destination.";
  }
  if (code.startsWith("84") || code.startsWith("85")) {
    return isEn
      ? "HS in machinery/electrical category: verify technical conformity and local standards."
      : "HS en catégorie machines/électrique : vérifier conformité technique et normes locales.";
  }
  if (code.startsWith("61") || code.startsWith("62")) {
    return isEn
      ? "HS in textile category: check labeling, composition and origin proof."
      : "HS en catégorie textile : contrôler étiquetage, composition et preuve d’origine.";
  }
  return isEn
    ? "HS identified: validate customs duties, VAT and required documents before final quote."
    : "HS identifié : valider droits de douane, TVA et documents requis avant devis final.";
}

export function HomeHero({
  labels,
  isEn,
}: {
  labels: HeroLabels;
  isEn: boolean;
}) {
  const [country, setCountry] = React.useState<string>("Maroc");
  const [hsCode, setHsCode] = React.useState<string>("8471");

  const insight = COUNTRY_INSIGHTS[country] ?? COUNTRY_INSIGHTS.Maroc;
  const verdict = isEn ? insight.verdictEn : insight.verdictFr;
  const action = isEn ? insight.actionEn : insight.actionFr;
  const rssLines = isEn ? insight.rssEn : insight.rssFr;
  const hsNote = hsGuidance(hsCode, isEn);

  return (
    <section className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-gradient-to-b from-white to-slate-50/70 p-6 sm:p-8 lg:p-10">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-r from-primary/5 via-transparent to-emerald-500/5" />
      <div className="relative grid items-start gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)] lg:gap-10">
        <div className="space-y-6">
          <Badge variant="secondary" className="w-fit rounded-full px-3 py-1 text-xs">{labels.badge}</Badge>
          <div className="space-y-2 rounded-xl border border-primary/20 bg-primary/5 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">{labels.welcomeTitle}</p>
            <p className="text-sm text-slate-700">{labels.welcomeBody}</p>
          </div>
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
                {isEn ? "Your export ally" : "L’allié pour l’export"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-slate-700">
              <p className="text-xs text-slate-500">
                {isEn
                  ? "Go/No-Go + recurring operations follow-up for France and Europe."
                  : "Go/No-Go + suivi récurrent des opérations export France & Europe."}
              </p>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-xs text-slate-500">{isEn ? "Destination country" : "Pays destination"}</p>
                  <Select value={country} onValueChange={setCountry}>
                    <SelectTrigger>
                      <SelectValue placeholder={isEn ? "Select country" : "Choisir un pays"} />
                    </SelectTrigger>
                    <SelectContent>
                      {COUNTRY_OPTIONS.map((item) => (
                        <SelectItem key={item} value={item}>{item}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-slate-500">HS code</p>
                  <Input value={hsCode} onChange={(e) => setHsCode(e.target.value)} placeholder="Ex: 8471" />
                </div>
              </div>

              <div className="rounded-xl border bg-slate-50 p-3">
                <p className="font-medium">
                  {isEn ? "Country" : "Pays"}: {country} • HS: {hsCode || "—"}
                </p>
                <p className="text-emerald-700">{isEn ? "Verdict" : "Verdict"}: {verdict}</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border bg-white p-3">
                  <p className="text-slate-500">{isEn ? "Risk" : "Risque"}</p>
                  <p className="font-semibold">{insight.risk} / 100</p>
                </div>
                <div className="rounded-lg border bg-white p-3">
                  <p className="text-slate-500">{isEn ? "Deliverables" : "Livrables"}</p>
                  <p className="font-semibold">{isEn ? "Checklist + client email" : "Checklist + email client"}</p>
                </div>
              </div>

              <div className="rounded-lg border bg-white p-3">
                <p className="font-semibold text-slate-900">{isEn ? "Priority action" : "Action prioritaire"}: {action}</p>
                <p className="mt-1 text-xs text-slate-600">{hsNote}</p>
              </div>

              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-primary">RSS</p>
                <p className="line-clamp-1">• {rssLines[0]}</p>
                <p className="line-clamp-1">• {rssLines[1]}</p>
              </div>

              <div className="space-y-2 rounded-lg border bg-white p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {isEn ? "French exporters database (sample)" : "Base entreprises exportatrices françaises (exemple)"}
                </p>
                <p className="text-xs text-slate-500">
                  {isEn
                    ? "Inspired by ITC-style trade directories: company profile + exported products + target markets."
                    : "Inspiré des annuaires type ITC : profil entreprise + produits exportés + marchés cibles."}
                </p>
                <div className="space-y-2">
                  {FRENCH_EXPORTERS_SAMPLE.map((row) => (
                    <div key={row.company} className="rounded-md border bg-slate-50 p-2 text-xs">
                      <p className="font-semibold text-slate-900">{row.company} · {row.city}</p>
                      <p><span className="text-slate-500">{isEn ? "Products" : "Produits"}:</span> {row.products}</p>
                      <p><span className="text-slate-500">{isEn ? "Markets" : "Marchés"}:</span> {row.markets}</p>
                    </div>
                  ))}
                </div>
                <Button asChild variant="outline" size="sm" className="w-full">
                  <Link to="/contact?topic=exporters-database-signup">
                    {isEn
                      ? "Free listing: add my company and exported products"
                      : "Inscription gratuite : ajouter mon entreprise et mes produits exportés"}
                  </Link>
                </Button>
              </div>
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
