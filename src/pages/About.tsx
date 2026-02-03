import { Link } from "react-router-dom";
import { ShieldCheck, Radar, Calculator, FileCheck2, Globe2, Clock, Phone, Mail } from "lucide-react";

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
  ctaTitle: string;
  ctaBody: string;
  ctaButton: string;
  transparencyTitle: string;
  contactTitle: string;
};

export default function About() {
  const { t } = useI18n();
  usePageMeta("meta.about.title", "meta.about.description");

  const copyRaw = t("aboutPage");
  const copy: Copy = (typeof copyRaw === "object" && copyRaw !== null ? copyRaw as unknown as Copy : null) ?? {
      headline: "À propos",
      title: "Export Navigator",
      subtitle:
        "Un outil simple pour estimer vos coûts export, détecter les risques (TVA, douane, DDP, DROM) et décider vite — avec possibilité de validation par une consultante.",
      missionTitle: "Pourquoi cet outil existe",
      missionBody:
        "Parce qu’en export, les erreurs coûtent cher : TVA mal gérée, incoterm incohérent, DDP risqué, documents incomplets, sanctions… Export Navigator vous donne une vue claire et une checklist actionnable, puis MPL Export Conseil peut valider les cas complexes.",
      blocksTitle: "Ce que vous obtenez",
      ctaTitle: "Besoin d’une validation express ?",
      ctaBody:
        "Si votre expédition engage du DDP, un territoire DROM, ou un produit sensible, je vous aide à sécuriser la décision.",
      ctaButton: "Demander un diagnostic",
      transparencyTitle: "Transparence & limites",
      contactTitle: "Contact direct",
    };

  const phoneRaw = "0676435551";
  const phonePretty = "06 76 43 55 51";
  const emailMain = "contact@exportfrancefacile.com";

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
                <span className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-slate-700">
                  Aide à la décision
                </span>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-slate-700">
                  DDP / Incoterms
                </span>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-slate-700">
                  DROM / DOM
                </span>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-slate-700">
                  TVA / Douane
                </span>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-slate-700">
                  Sanctions / conformité
                </span>
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
            </div>
          </div>
        </div>
      </section>

      {/* WHAT YOU GET */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-sm uppercase tracking-[0.6em] text-[#1E3A8A]">{copy.blocksTitle}</h2>
          <p className="mt-2 text-3xl font-semibold text-slate-900">Une vue claire, puis une validation si besoin</p>

          <div className="mt-10 grid gap-6 md:grid-cols-3">
            <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
              <div className="flex items-center gap-3">
                <Globe2 className="h-5 w-5 text-slate-900" />
                <h3 className="text-lg font-semibold text-slate-900">Contexte pays / territoire</h3>
              </div>
              <p className="mt-3 text-sm text-slate-600">
                Comprendre les implications selon destination (y compris DROM), incoterm et transit.
              </p>
            </article>

            <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 text-slate-900" />
                <h3 className="text-lg font-semibold text-slate-900">Risques & conformité</h3>
              </div>
              <p className="mt-3 text-sm text-slate-600">
                Repérer ce qui peut bloquer : TVA, douane, sanctions, docs incomplets, DDP “piège”.
              </p>
            </article>

            <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-slate-900" />
                <h3 className="text-lg font-semibold text-slate-900">Décision rapide</h3>
              </div>
              <p className="mt-3 text-sm text-slate-600">
                Un premier avis en quelques minutes, puis un diagnostic si votre cas est sensible.
              </p>
            </article>
          </div>
        </div>
      </section>

      {/* TRANSPARENCY */}
      <section className="py-16">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
              <h3 className="text-sm font-semibold uppercase tracking-[0.35em] text-slate-900">
                {copy.transparencyTitle}
              </h3>
              <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-slate-700">
                <li>Les estimations sont indicatives : elles aident à la décision, ne remplacent pas un conseil officiel.</li>
                <li>Les taux exacts peuvent dépendre du HS code, du régime, des exemptions et du dossier documentaire.</li>
                <li>Sur les scénarios gratuits, les données peuvent rester côté navigateur (selon les pages).</li>
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
                    to="/newsletter"
                    className="rounded-full border border-slate-200 bg-white px-6 py-3 text-xs font-semibold uppercase tracking-[0.35em] text-slate-700 transition hover:bg-slate-50"
                  >
                    Recevoir la veille
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
