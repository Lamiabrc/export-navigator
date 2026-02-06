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
  Sparkles,
  BriefcaseBusiness,
  MapPinned,
  Scale,
  Brain,
  Flame,
  CheckCircle2,
  ClipboardCheck,
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

  storyKicker: string;
  storyTitle: string;
  storyBodyA: string;
  storyBodyB: string;
  storyBodyC: string;

  methodTitle: string;
  methodSubtitle: string;

  ctaTitle: string;
  ctaBody: string;
  ctaButton: string;

  transparencyTitle: string;
  contactTitle: string;
};

type ListItem = { title: string; desc: string; icon: React.ReactNode };

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

    storyKicker: "Mon approche",
    storyTitle: "Du terrain aux décisions : une expertise construite par immersion",
    storyBodyA:
      "Depuis 2018 — année où j’ai obtenu mon diplôme en import/export à Rennes — je n’ai cessé d’intégrer des entreprises, PME comme grands groupes, pour m’enquérir de leurs process d’exportation : les indispensables, les points de rupture, les bonnes pratiques et les stratégies qui font gagner du temps (et éviter les blocages).",
    storyBodyB:
      "J’ai enrichi cette base par d’autres qualifications, notamment au CNAM avec le certificat de compétences “Environnement international des entreprises”, qui a renforcé mon approche en business intelligence et en géopolitique : comprendre les signaux pays, les risques et le contexte qui impactent les flux.",
    storyBodyC:
      "J’ai également consolidé l’aspect légal et réglementaire grâce à une licence de droit, pour mieux appréhender les enjeux de conformité : documents, responsabilités, clauses, vigilance sanctions, et zones sensibles. Ajoutez à cela un appétit du savoir et de l’IA : aujourd’hui, je rassemble tout ce capital dans une proposition claire — un service et un outil — pour rendre l’export plus simple, plus sûr, et plus rapide à décider.",

    methodTitle: "Méthode (simple, robuste, réplicable)",
    methodSubtitle:
      "Une méthode en 3 étapes : cadrer → simuler → sécuriser. Chaque sortie doit être exploitable : risques, documents, recommandations, next steps.",

    ctaTitle: "Besoin d’une validation express ?",
    ctaBody:
      "Si votre expédition engage du DDP, une valeur élevée ou un produit sensible, je vous aide à sécuriser la décision avant l’envoi.",
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

  const offers: ListItem[] = [
    {
      title: "Estimation rapide & scénarios",
      desc: "Landed cost, coûts unitaires, scénarios Incoterms (dont DDP), arbitrages et alertes.",
      icon: <Calculator className="h-5 w-5 text-slate-900" />,
    },
    {
      title: "Checklist & conformité documentaire",
      desc: "Facture, packing list, transport, origine, exigences pays : une liste actionnable, pas du blabla.",
      icon: <FileCheck2 className="h-5 w-5 text-slate-900" />,
    },
    {
      title: "Veille export utile",
      desc: "Signaux pays, sanctions, mesures : ce qui peut impacter vos expéditions (et vos décisions).",
      icon: <Radar className="h-5 w-5 text-slate-900" />,
    },
    {
      title: "Lecture risques (TVA / Douane / DDP)",
      desc: "Détecter ce qui peut coûter cher : incohérence incoterm, responsabilité, zones de blocage.",
      icon: <ShieldCheck className="h-5 w-5 text-slate-900" />,
    },
    {
      title: "Approche légal & réglementaire",
      desc: "Comprendre l’enjeu conformité : responsabilités, preuves, vigilance sanctions, exigences pays.",
      icon: <Scale className="h-5 w-5 text-slate-900" />,
    },
    {
      title: "Décision rapide + validation si besoin",
      desc: "Un premier avis en minutes, puis une validation experte si votre cas est sensible.",
      icon: <Clock className="h-5 w-5 text-slate-900" />,
    },
  ];

  const process = [
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

  const markers = [
    { label: "Immersion terrain", icon: <BriefcaseBusiness className="h-4 w-4" /> },
    { label: "Business intelligence & géopolitique", icon: <Globe2 className="h-4 w-4" /> },
    { label: "Cadre légal & conformité", icon: <Scale className="h-4 w-4" /> },
    { label: "IA & automatisation utile", icon: <Brain className="h-4 w-4" /> },
    { label: "Curiosité féroce", icon: <Flame className="h-4 w-4" /> },
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
                {markers.map((m) => (
                  <span
                    key={m.label}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-700"
                  >
                    {m.icon}
                    {m.label}
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
                  <Sparkles className="mt-0.5 h-5 w-5 text-slate-900" />
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Promesse</div>
                    <div className="text-sm text-slate-600">
                      Transformer un sujet “flou” en une décision claire : risques, actions, documents, next steps.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* STORY (REWRITE AS REQUESTED) */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-6xl px-6">
          <p className="text-xs uppercase tracking-[0.6em] text-[#1E3A8A]">{copy.storyKicker}</p>
          <h2 className="mt-3 text-3xl font-semibold text-slate-900">{copy.storyTitle}</h2>

          <div className="mt-8 grid gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-8 shadow-lg">
              <div className="flex items-start gap-4">
                <div className="mt-1 rounded-2xl border border-slate-200 bg-white p-3">
                  <BriefcaseBusiness className="h-5 w-5 text-slate-900" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Une construction par immersion (depuis 2018)</h3>
                  <p className="mt-3 text-sm leading-relaxed text-slate-700">{copy.storyBodyA}</p>
                  <p className="mt-4 text-sm leading-relaxed text-slate-700">{copy.storyBodyB}</p>
                  <p className="mt-4 text-sm leading-relaxed text-slate-700">{copy.storyBodyC}</p>

                  <div className="mt-6 grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                        <Globe2 className="h-4 w-4" />
                        BI & géopolitique
                      </div>
                      <p className="mt-2 text-sm text-slate-600">
                        Lire le contexte pays, détecter les signaux, anticiper les impacts sur les flux.
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                        <Scale className="h-4 w-4" />
                        Legal & conformité
                      </div>
                      <p className="mt-2 text-sm text-slate-600">
                        Responsabilités, preuves, exigences : sécuriser avant l’envoi.
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                        <Brain className="h-4 w-4" />
                        IA utile
                      </div>
                      <p className="mt-2 text-sm text-slate-600">
                        Automatiser la lecture, structurer la décision, éviter le “bruit”.
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                        <MapPinned className="h-4 w-4" />
                        Process & indispensables
                      </div>
                      <p className="mt-2 text-sm text-slate-600">
                        Ce qui doit être vrai pour expédier sans surprises.
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 flex flex-wrap gap-3">
                    <Link
                      to="/tool"
                      className="rounded-full bg-slate-900 px-6 py-3 text-xs font-semibold uppercase tracking-[0.35em] text-white transition hover:bg-slate-800"
                    >
                      Découvrir l’outil
                    </Link>
                    <Link
                      to="/veille"
                      className="rounded-full border border-slate-200 bg-white px-6 py-3 text-xs font-semibold uppercase tracking-[0.35em] text-slate-700 transition hover:bg-slate-50"
                    >
                      Voir la veille
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            {/* SIDE: method snapshot */}
            <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
              <h3 className="text-sm font-semibold uppercase tracking-[0.35em] text-slate-900">{copy.methodTitle}</h3>
              <p className="mt-2 text-sm text-slate-600">{copy.methodSubtitle}</p>

              <div className="mt-6 space-y-3">
                {process.map((s) => (
                  <div key={s.step} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-start gap-3">
                      {s.icon}
                      <div className="min-w-0">
                        <div className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">Étape {s.step}</div>
                        <div className="text-sm font-semibold text-slate-900">{s.title}</div>
                        <div className="mt-1 text-sm text-slate-600">{s.desc}</div>
                      </div>
                      <CheckCircle2 className="mt-1 h-5 w-5 text-slate-300" />
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                <span className="font-semibold text-slate-900">Résultat :</span> une décision claire + un plan d’action concret.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* WHAT YOU GET */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-sm uppercase tracking-[0.6em] text-[#1E3A8A]">{copy.blocksTitle}</h2>
          <p className="mt-2 text-3xl font-semibold text-slate-900">Une vue claire, puis une validation si besoin</p>

          <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {offers.map((o) => (
              <article key={o.title} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
                <div className="flex items-center gap-3">
                  {o.icon}
                  <h3 className="text-lg font-semibold text-slate-900">{o.title}</h3>
                </div>
                <p className="mt-3 text-sm text-slate-600">{o.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* TRANSPARENCY + CONTACT */}
      <section className="py-16">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
              <h3 className="text-sm font-semibold uppercase tracking-[0.35em] text-slate-900">{copy.transparencyTitle}</h3>
              <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-slate-700">
                <li>Les estimations sont indicatives : elles aident à la décision, ne remplacent pas un conseil officiel.</li>
                <li>Les paramètres exacts peuvent dépendre du HS code, du régime, des exemptions et du dossier documentaire.</li>
                <li>Les contenus de veille sont informatifs : toujours vérifier la source officielle avant d’engager un flux.</li>
                <li>Pour un dossier engageant (DDP, valeur élevée, produit sensible), demandez une validation.</li>
              </ul>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-8 shadow-lg">
              <h3 className="text-sm font-semibold uppercase tracking-[0.35em] text-slate-900">{copy.contactTitle}</h3>

              <div className="mt-5 space-y-3 text-sm text-slate-700">
                <a
                  href={`tel:${phoneRaw}`}
                  className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 font-semibold text-slate-900 hover:bg-slate-50"
                >
                  <Phone className="h-4 w-4" />
                  {phonePretty}
                </a>

                <a
                  href={`mailto:${emailMain}`}
                  className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 font-semibold text-slate-900 hover:bg-slate-50"
                >
                  <Mail className="h-4 w-4" />
                  {emailMain}
                </a>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                  <div className="font-semibold text-slate-900">Conseil pour gagner du temps</div>
                  <div className="mt-1">
                    Dans votre message : destination, valeur, incoterm, HS code (même approximatif), et délai.
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  <Link
                    to="/contact?offer=diagnostic"
                    className="rounded-full bg-[#DC2626] px-6 py-3 text-xs font-semibold uppercase tracking-[0.35em] text-white transition hover:bg-[#B0231D]"
                  >
                    {copy.ctaButton}
                  </Link>
                  <Link
                    to="/veille"
                    className="rounded-full border border-slate-200 bg-white px-6 py-3 text-xs font-semibold uppercase tracking-[0.35em] text-slate-700 transition hover:bg-slate-50"
                  >
                    Voir la veille
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* CTA BAND */}
          <div className="mt-10 rounded-3xl border border-slate-200 bg-gradient-to-r from-[#1E3A8A] via-[#0B1220] to-[#DC2626] p-8 text-white shadow-xl">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.35em] text-white/70">{copy.ctaTitle}</div>
                <div className="mt-2 text-2xl font-semibold">{copy.ctaBody}</div>
              </div>
              <Link
                to="/contact?offer=diagnostic"
                className="inline-flex rounded-full bg-white px-6 py-3 text-xs font-semibold uppercase tracking-[0.35em] text-slate-900 transition hover:bg-white/90"
              >
                {copy.ctaButton}
              </Link>
            </div>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
