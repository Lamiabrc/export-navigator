import { Link } from "react-router-dom";
import {
  ShieldCheck,
  Radar,
  Calculator,
  FileCheck2,
  Globe2,
  Clock,
  Phone,
  Mail,
  GraduationCap,
  BriefcaseBusiness,
  CheckCircle2,
  MapPinned,
  ClipboardCheck,
  Layers3,
  BadgeCheck,
} from "lucide-react";

import { MarketingLayout } from "@/components/marketing/MarketingLayout";
import { useI18n } from "@/contexts/LanguageContext";
import { usePageMeta } from "@/hooks/usePageMeta";

type Copy = {
  headline: string;
  title: string;
  subtitle: string;

  missionTitle: string;
  missionBody: string;

  blocksTitle: string;

  expertiseTitle: string;
  expertiseSubtitle: string;

  credentialsTitle: string;
  credentialsBody: string;

  immersionTitle: string;
  immersionBody: string;

  methodTitle: string;
  methodSubtitle: string;

  ctaTitle: string;
  ctaBody: string;
  ctaButton: string;

  transparencyTitle: string;
  contactTitle: string;
};

type ListItem = { title: string; desc: string };
type Bullet = { label: string; note?: string };

export default function About() {
  const { t } = useI18n();
  usePageMeta("meta.about.title", "meta.about.description");

  const fallback: Copy = {
    headline: "À propos",
    title: "MPL Export Navigator",
    subtitle:
      "Le “département export” digital des PME : estimation des coûts export, détection des risques (TVA, douane, DDP), checklists actionnables et veille — avec option de validation experte quand le dossier est sensible.",

    missionTitle: "Pourquoi cet outil existe",
    missionBody:
      "Parce qu’en export, les erreurs coûtent cher : TVA mal gérée, incoterm incohérent, DDP risqué, documents incomplets, sanctions… Export Navigator vous donne une vue claire et une checklist actionnable. Et si votre cas est complexe, MPL Export Conseil peut valider et sécuriser la décision.",

    blocksTitle: "Ce que vous obtenez",

    expertiseTitle: "Une expertise multi-domaines, orientée décision",
    expertiseSubtitle:
      "Le cœur : transformer un sujet “flou” en plan d’action simple, chiffré et documenté — sans recruter, sans multiplier les outils.",

    credentialsTitle: "Diplômes & formation",
    credentialsBody:
      "Une approche structurée et pragmatique, nourrie par la formation et l’expérience terrain (immersion en entreprise, cas concrets, priorisation des risques).",

    immersionTitle: "Immersions & terrain",
    immersionBody:
      "Depuis 2019, MPL Export Conseil intervient au plus près des opérations : diagnostic, organisation, documentation, conformité et aide à la décision pour sécuriser les expéditions et réduire les blocages.",

    methodTitle: "Méthode (simple, robuste, réplicable)",
    methodSubtitle:
      "Une méthode en 3 étapes : cadrer → simuler → sécuriser. Chaque sortie doit être exploitable : risques, documents, recommandations, next steps.",

    ctaTitle: "Besoin d’une validation express ?",
    ctaBody: "Si votre expédition engage du DDP, une valeur élevée ou un produit sensible, je vous aide à sécuriser la décision.",
    ctaButton: "Demander un diagnostic",

    transparencyTitle: "Transparence & limites",
    contactTitle: "Contact direct",
  };

  const copyRaw = t("aboutPage");
  const copyObj = typeof copyRaw === "object" && copyRaw !== null ? (copyRaw as Partial<Copy>) : {};
  const copy: Copy = { ...fallback, ...copyObj };

  const phoneRaw = "0676435551";
  const phonePretty = "06 76 43 55 51";
  const emailMain = "contact@exportfrancefacile.com";

  const pillars: ListItem[] = [
    {
      title: "Simulation coûts & scénarios",
      desc: "Landed cost, coûts unitaires, scénarios Incoterms (dont DDP), points de vigilance & arbitrages.",
    },
    {
      title: "Douane & conformité documentaire",
      desc: "Checklist actionnable : facture, packing list, documents d’origine, transport, exigences pays, cohérence des données.",
    },
    {
      title: "TVA & risques fiscaux",
      desc: "Repérage des zones de risque et incohérences fréquentes (territoires, ventes, DDP, formalités, rôle des parties).",
    },
    {
      title: "Sanctions & contrôles export",
      desc: "Veille et signaux utiles : pays sensibles, restrictions, contrôles — pour éviter la mauvaise surprise au dernier moment.",
    },
    {
      title: "Organisation export (PME)",
      desc: "Structuration simple : qui fait quoi, quand, avec quels documents. Moins d’impro, plus de reproductibilité.",
    },
    {
      title: "Validation “cas sensibles”",
      desc: "Quand ça engage : DDP, valeur élevée, produit à risque, délais serrés — une validation pour sécuriser la décision.",
    },
  ];

  const credentials: Bullet[] = [
    { label: "CNAM — Certificat de compétences : “L’environnement international des entreprises”" },
    { label: "Approche terrain : diagnostic + immersion en entreprise (MPL Export Conseil, depuis 2019)" },
  ];

  const immersions: Bullet[] = [
    { label: "Immersion opérationnelle : audit rapide des flux export (documents, incoterms, acteurs, zones à risque)" },
    { label: "Accompagnement décisionnel : DDP, TVA, douane, contraintes pays/territoires" },
    { label: "Mise en place de checklists et routines : moins d’erreurs, moins de retards, plus de sérénité" },
  ];

  const process: Array<{ step: string; title: string; desc: string; icon: React.ReactNode }> = [
    {
      step: "01",
      title: "Cadrer",
      desc: "Destination, valeur, incoterm, produit, contraintes. On clarifie le contexte et les inconnues.",
      icon: <ClipboardCheck className="h-5 w-5 text-slate-900" />,
    },
    {
      step: "02",
      title: "Simuler",
      desc: "Chiffrage + scénarios. On fait apparaître les écarts, les risques et les décisions à prendre.",
      icon: <Calculator className="h-5 w-5 text-slate-900" />,
    },
    {
      step: "03",
      title: "Sécuriser",
      desc: "Checklist + recommandations. Si besoin : validation experte sur les points sensibles.",
      icon: <BadgeCheck className="h-5 w-5 text-slate-900" />,
    },
  ];

  return (
    <MarketingLayout>
      {/* HERO */}
      <section className="relative overflow-hidden bg-white">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(15,23,42,0.07),transparent_55%)]" />
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
            <div>
              <p className="text-xs uppercase tracking-[0.5em] text-slate-400">{copy.headline}</p>
              <h1 className="mt-3 text-4xl font-semibold text-slate-900 sm:text-5xl">{copy.title}</h1>
              <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-700">{copy.subtitle}</p>

              <div className="mt-8 flex flex-wrap gap-2">
                {[
                  "Aide à la décision",
                  "DDP / Incoterms",
                  "TVA / Douane",
                  "Sanctions / conformité",
                  "PME / international",
                  "Checklists",
                ].map((x) => (
                  <span
                    key={x}
                    className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-slate-700"
                  >
                    {x}
                  </span>
                ))}
              </div>

              <div className="mt-10 flex flex-wrap gap-4">
                <Link
                  to="/tool"
                  className="rounded-full bg-slate-900 px-6 py-3 text-xs font-semibold uppercase tracking-[0.35em] text-white transition hover:bg-slate-800"
                >
                  Lancer l’outil
                </Link>
                <Link
                  to="/contact?offer=diagnostic"
                  className="rounded-full bg-[#DC2626] px-6 py-3 text-xs font-semibold uppercase tracking-[0.35em] text-white transition hover:bg-[#B0231D]"
                >
                  {copy.ctaButton}
                </Link>
              </div>
            </div>

            {/* RIGHT CARD */}
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-8 shadow-lg">
              <h2 className="text-xl font-semibold text-slate-900">{copy.missionTitle}</h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">{copy.missionBody}</p>

              <div className="mt-6 grid gap-3">
                <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4">
                  <Calculator className="mt-0.5 h-5 w-5 text-slate-900" />
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Estimation rapide</div>
                    <div className="text-sm text-slate-600">Landed cost, coûts unitaires, scénarios.</div>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4">
                  <FileCheck2 className="mt-0.5 h-5 w-5 text-slate-900" />
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Checklist & risques</div>
                    <div className="text-sm text-slate-600">DDP, TVA, douane, documents.</div>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4">
                  <Radar className="mt-0.5 h-5 w-5 text-slate-900" />
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Veille export</div>
                    <div className="text-sm text-slate-600">Signaux utiles (sanctions, règles, marchés).</div>
                  </div>
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 h-5 w-5 text-slate-900" />
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Objectif</div>
                    <div className="text-sm text-slate-600">
                      Éviter la mauvaise surprise (blocage, retard, non-conformité) et sécuriser la décision.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* EXPERTISE */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-sm uppercase tracking-[0.6em] text-[#1E3A8A]">{copy.expertiseTitle}</h2>
          <p className="mt-2 max-w-3xl text-base text-slate-700">{copy.expertiseSubtitle}</p>

          <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {pillars.map((p) => (
              <article key={p.title} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
                <div className="flex items-center gap-3">
                  <Layers3 className="h-5 w-5 text-slate-900" />
                  <h3 className="text-lg font-semibold text-slate-900">{p.title}</h3>
                </div>
                <p className="mt-3 text-sm text-slate-600">{p.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* METHOD */}
      <section className="py-16">
        <div className="mx-auto max-w-6xl px-6">
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-8 shadow-lg">
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-[0.35em] text-slate-900">{copy.methodTitle}</h3>
                <p className="mt-2 max-w-3xl text-sm text-slate-600">{copy.methodSubtitle}</p>
              </div>
              <Link
                to="/tool"
                className="mt-3 inline-flex w-fit rounded-full bg-slate-900 px-6 py-3 text-xs font-semibold uppercase tracking-[0.35em] text-white transition hover:bg-slate-800"
              >
                Tester maintenant
              </Link>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {process.map((s) => (
                <div key={s.step} className="rounded-2xl border border-slate-200 bg-white p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {s.icon}
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">
                          Étape {s.step}
                        </div>
                        <div className="text-base font-semibold text-slate-900">{s.title}</div>
                      </div>
                    </div>
                    <CheckCircle2 className="mt-1 h-5 w-5 text-slate-300" />
                  </div>
                  <p className="mt-3 text-sm text-slate-600">{s.desc}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <MapPinned className="h-4 w-4" />
                  Contexte pays / territoire
                </div>
                <p className="mt-2 text-sm text-slate-600">Impacts destination, incoterm, transit, contraintes locales.</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <ShieldCheck className="h-4 w-4" />
                  Risques & conformité
                </div>
                <p className="mt-2 text-sm text-slate-600">TVA, douane, sanctions, docs incomplets, DDP “piège”.</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <Clock className="h-4 w-4" />
                  Décision rapide
                </div>
                <p className="mt-2 text-sm text-slate-600">Un premier avis en minutes, puis validation si besoin.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CREDENTIALS + IMMERSIONS */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-6xl px-6">
          <div className
