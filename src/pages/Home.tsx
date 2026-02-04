import * as React from "react";
import { Link } from "react-router-dom";
import { MarketingLayout } from "@/components/marketing/MarketingLayout";
import { useI18n } from "@/contexts/LanguageContext";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { usePageMeta } from "@/hooks/usePageMeta";

type FeatureCard = { title: string; description: string };

export default function Home() {
  const { t, lang } = useI18n();
  const isEN = lang === "en";
  const prefersReducedMotion = usePrefersReducedMotion();
  const [shouldLoadVideo, setShouldLoadVideo] = React.useState(false);
  const heroRef = React.useRef<HTMLDivElement | null>(null);
  usePageMeta("meta.home.title", "meta.home.description");

  const heroTitle =
    (t("heroLanding.title") as string) ??
    (isEN ? "Your digital export department for SMEs." : "Analysez vos coûts export en 2 minutes");
  const heroSubtitle =
    (t("heroLanding.subtitle") as string) ??
    (isEN
      ? "Costs, documents, compliance watch - without hiring."
      : "Un premier diagnostic clair (TVA, DDP, conformité) pour décider vite — puis un audit expert si nécessaire.");
  const heroPrimary = (t("heroLanding.ctaPrimary") as string) ?? (isEN ? "Try for free" : "Lancer l’outil");
  const heroSecondary = (t("heroLanding.ctaSecondary") as string) ?? (isEN ? "See the plans" : "Voir les offres");
  const featureCardsRaw = t("heroLanding.featureCards");
  const featureCardsFromI18n: FeatureCard[] = Array.isArray(featureCardsRaw)
    ? (featureCardsRaw as unknown as FeatureCard[])
    : [];

  const heroBulletsRaw = t("heroLanding.bullets");
  const heroBullets: string[] = Array.isArray(heroBulletsRaw)
    ? (heroBulletsRaw as string[])
    : [];

  const proofTitle = (t("heroLanding.proofTitle") as string) ?? "Ce que l’outil automatise (au lieu d’embaucher)";
  const proofDescription = (t("heroLanding.proofDescription") as string) ?? "";
  const proofItemsRaw = t("heroLanding.proofItems");
  const proofItems: Array<{ title: string; description: string }> =
    Array.isArray(proofItemsRaw) && proofItemsRaw.length > 0 && typeof proofItemsRaw[0] === "object"
      ? (proofItemsRaw as unknown as Array<{ title: string; description: string }>)
      : [];

  const featureCards: FeatureCard[] =
    featureCardsFromI18n?.length > 0
      ? featureCardsFromI18n
      : isEN
        ? [
            {
              title: "Costs & margins",
              description: "See the impact of OM / octroi / VAT / local rules on your margins in seconds.",
            },
            {
              title: "Invoice checks",
              description: "Validate an invoice: inconsistencies, tax risks, missing items, fixes to apply.",
            },
            {
              title: "Decision & action",
              description: "Get a clear recommendation: GO / NO GO, and what to fix before shipping.",
            },
          ]
        : [
            {
              title: "Coûts & marges",
              description: "Visualisez l’impact OM / octroi / TVA / règles locales sur vos marges, en quelques clics.",
            },
            {
              title: "Facture & contrôle",
              description: "Vérifiez une facture : incohérences, risques fiscaux, éléments manquants, points à corriger.",
            },
            {
              title: "Décision & action",
              description: "Obtenez une recommandation claire : GO / NO GO, et quelles actions faire avant d’expédier.",
            },
          ];

  // Contact direct (utile partout)
  const phoneRaw = "0676435551";
  const phonePretty = "06 76 43 55 51";
  const emailMain = "contact@exportfrancefacile.com";

  React.useEffect(() => {
    if (prefersReducedMotion) return;
    const node = heroRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setShouldLoadVideo(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [prefersReducedMotion]);

  return (
    <MarketingLayout>
      {/* HERO */}
      <section className="relative min-h-[88vh] overflow-hidden text-white" ref={heroRef}>
        <div className="absolute inset-0">
          {!prefersReducedMotion && shouldLoadVideo ? (
            <video
              className="h-full w-full object-cover"
              autoPlay
              muted
              loop
              playsInline
              preload="none"
              poster="/videos/hero-export.jpg"
            >
              <source src="/videos/hero-export.webm" type="video/webm" />
              <source src="/videos/hero-export.mp4" type="video/mp4" />
            </video>
          ) : (
            <div
              className="absolute inset-0 bg-gradient-to-br from-[#0B1220] via-[#1E3A8A] to-[#0B1220]"
              style={{ backgroundImage: "url(/videos/hero-export.jpg)", backgroundSize: "cover", backgroundPosition: "center" }}
              aria-hidden
            />
          )}

          {/* overlays */}
          <div
            className="absolute inset-0 bg-gradient-to-b from-[#0B1220]/85 via-[#0B1220]/70 to-[#0B1220]/90"
            aria-hidden
          />
          <div
            className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.10),transparent_55%)]"
            aria-hidden
          />
          <div
            className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[size:64px_64px] opacity-20"
            aria-hidden
          />
        </div>

          <div className="relative z-10 mx-auto flex min-h-[88vh] max-w-5xl flex-col items-center justify-center gap-6 px-6 text-center">
          <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.6em] text-white/70">
            MPL Export Navigator
            <span className="hidden rounded-full bg-white/10 px-2 py-1 text-[10px] tracking-[0.3em] text-white/70 sm:inline">
              France • International
            </span>
          </p>

          <h1 className="text-4xl font-semibold leading-tight text-white sm:text-5xl md:text-6xl lg:text-7xl">
            {heroTitle}
          </h1>

          <p className="max-w-3xl text-lg leading-relaxed text-white/80 md:text-xl">{heroSubtitle}</p>

          <div className="mt-4 grid w-full max-w-3xl grid-cols-1 gap-2 text-xs uppercase tracking-[0.6em] text-white/80 md:grid-cols-2">
            {heroBullets.map((bullet) => (
              <div key={bullet} className="rounded-2xl border border-white/20 bg-white/10 px-3 py-2">
                {bullet}
              </div>
            ))}
          </div>

          <div className="flex flex-wrap justify-center gap-4 text-xs font-semibold uppercase tracking-[0.35em] md:text-sm">
            <Link
              to="/tool"
              className="rounded-full bg-[#DC2626] px-7 py-3 text-white transition hover:bg-[#b0231d]"
            >
              {heroPrimary}
            </Link>
            <Link
              to="/pricing"
              className="rounded-full border border-white/80 px-7 py-3 text-white transition hover:border-white"
            >
              {heroSecondary}
            </Link>
          </div>

          {/* PROOF BAR */}
          <div className="mt-6 grid w-full max-w-4xl grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-left">
              <p className="text-xs uppercase tracking-[0.35em] text-white/60">VAT / DDP</p>
              <p className="mt-1 text-sm text-white/85">
                {isEN ? "Tax risks + key watch points before shipment." : "Risques fiscaux + points d’attention avant expédition."}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-left">
              <p className="text-xs uppercase tracking-[0.35em] text-white/60">
                {isEN ? "France import/export expert" : "Expert import/export France"}
              </p>
              <p className="mt-1 text-sm text-white/85">
                {isEN ? "VAT, customs, Incoterms and entry rules." : "TVA, douane, incoterms et règles d’entrée."}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-left">
              <p className="text-xs uppercase tracking-[0.35em] text-white/60">
                {isEN ? "Fast decisions" : "Décision rapide"}
              </p>
              <p className="mt-1 text-sm text-white/85">
                {isEN ? "Clear diagnosis + recommended next action." : "Diagnostic + action recommandée en sortie."}
              </p>
            </div>
          </div>

          {/* CONTACT STRIP */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-xs uppercase tracking-[0.35em] text-white/70">
            <a
              href={`tel:${phoneRaw}`}
              className="rounded-full border border-white/15 bg-white/5 px-4 py-2 transition hover:bg-white/10"
            >
              {isEN ? "Call" : "Appeler"} {phonePretty}
            </a>
            <a
              href={`mailto:${emailMain}`}
              className="rounded-full border border-white/15 bg-white/5 px-4 py-2 transition hover:bg-white/10"
            >
              {emailMain}
            </a>
            <Link
              to="/contact"
              className="rounded-full border border-white/20 px-4 py-2 text-white/80 transition hover:border-white/60"
            >
              {isEN ? "Express audit" : "Audit express"}
            </Link>
          </div>
        </div>
      </section>

      {/* AUTOMATION PROOF */}
      {proofItems.length > 0 && (
        <section className="bg-white py-16">
          <div className="mx-auto max-w-6xl px-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.6em] text-[#1E3A8A]">{proofTitle}</p>
                <p className="mt-2 text-sm text-slate-600">
                  {proofDescription}
                </p>
              </div>
            </div>

          <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {proofItems.map((item) => (
              <article key={item.title} className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-[#1E3A8A]">{item.title}</h3>
                <p className="text-sm text-slate-600">{item.description}</p>
              </article>
            ))}
          </div>
          </div>
        </section>
      )}

      {/* FOCUS */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-sm uppercase tracking-[0.6em] text-[#1E3A8A]">Focus</h2>
              <p className="mt-2 text-3xl font-semibold text-[#0B1220]">
                {isEN ? "Clear view, fast decisions" : "Vue claire, décisions rapides"}
              </p>
              <p className="mt-2 max-w-2xl text-sm text-slate-600">
                {isEN
                  ? "An operational view: costs, risks, and what to fix before shipping."
                  : "Une lecture “opérationnelle” : coûts, risques, et ce qu’il faut corriger avant l’expédition."}
              </p>
            </div>

            <div className="mt-4 flex flex-wrap gap-3 md:mt-0">
              <Link
                to="/import/check-invoice"
                className="rounded-full bg-[#1E3A8A] px-6 py-3 text-xs font-semibold uppercase tracking-[0.4em] text-white transition hover:bg-[#162864]"
              >
                {isEN ? "Check an invoice" : "Vérifier une facture"}
              </Link>
              <Link
                to="/tool"
                className="rounded-full border border-[#1E3A8A]/30 px-6 py-3 text-xs font-semibold uppercase tracking-[0.4em] text-[#1E3A8A] transition hover:border-[#1E3A8A]"
              >
                {isEN ? "Run the analysis" : "Lancer l’analyse"}
              </Link>
            </div>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {featureCards.map((card) => (
              <article
                key={card.title}
                className="group flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
              >
                <div className="h-1 w-12 rounded-full bg-[#1E3A8A]/80" />
                <h3 className="text-xl font-semibold text-[#1E3A8A]">{card.title}</h3>
                <p className="text-sm text-slate-600">{card.description}</p>
                <div className="mt-3">
                  <Link
                    to="/tool"
                    className="text-xs font-semibold uppercase tracking-[0.35em] text-[#0B1220]/70 transition group-hover:text-[#0B1220]"
                  >
                    {isEN ? "Try →" : "Essayer →"}
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="bg-slate-50 py-16">
        <div className="mx-auto max-w-6xl px-6">
          <h3 className="text-sm uppercase tracking-[0.6em] text-slate-500">
            {isEN ? "How it works" : "Comment ça marche"}
          </h3>
          <p className="mt-2 text-3xl font-semibold text-slate-900">
            {isEN ? "3 steps, no hassle" : "3 étapes, sans prise de tête"}
          </p>

          <div className="mt-10 grid gap-6 md:grid-cols-3">
            <div className="rounded-3xl border border-slate-200 bg-white p-6">
              <p className="text-xs uppercase tracking-[0.35em] text-slate-500">
                {isEN ? "Step 1" : "Étape 1"}
              </p>
              <p className="mt-2 text-lg font-semibold text-slate-900">
                {isEN ? "Choose destination & context" : "Choisir destination & contexte"}
              </p>
              <p className="mt-2 text-sm text-slate-600">
                {isEN ? "Country/territory + operation type." : "Pays/territoire + type d’opération."}
              </p>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6">
              <p className="text-xs uppercase tracking-[0.35em] text-slate-500">
                {isEN ? "Step 2" : "Étape 2"}
              </p>
              <p className="mt-2 text-lg font-semibold text-slate-900">
                {isEN ? "Import / check an invoice" : "Importer / vérifier une facture"}
              </p>
              <p className="mt-2 text-sm text-slate-600">
                {isEN ? "Quick checks + alerts on inconsistencies." : "Contrôles rapides + alertes si incohérences."}
              </p>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6">
              <p className="text-xs uppercase tracking-[0.35em] text-slate-500">
                {isEN ? "Step 3" : "Étape 3"}
              </p>
              <p className="mt-2 text-lg font-semibold text-slate-900">
                {isEN ? "Decide & act" : "Décider & passer à l’action"}
              </p>
              <p className="mt-2 text-sm text-slate-600">
                {isEN ? "GO / NO GO + clear next actions." : "GO / NO GO + recommandations concrètes."}
              </p>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/tool"
              className="rounded-full bg-[#DC2626] px-6 py-3 text-xs font-semibold uppercase tracking-[0.4em] text-white transition hover:bg-[#b0231d]"
            >
              {isEN ? "Start now" : "Démarrer maintenant"}
            </Link>
            <Link
              to="/pricing"
              className="rounded-full border border-slate-300 bg-white px-6 py-3 text-xs font-semibold uppercase tracking-[0.4em] text-slate-800 transition hover:border-slate-500"
            >
              {isEN ? "Plans & limits" : "Offres & limites"}
            </Link>
          </div>
        </div>
      </section>

      {/* SOURCES / TRUST */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-6xl px-6">
          <h3 className="text-sm uppercase tracking-[0.6em] text-[#1E3A8A]">
            {isEN ? "Trust" : "Confiance"}
          </h3>
          <p className="mt-2 text-3xl font-semibold text-[#0B1220]">
            {isEN ? "Compliance & rules, at the right place" : "Veille & règles, au bon endroit"}
          </p>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            {isEN
              ? "Goal: give you reliable, actionable references. A consultant validates complex cases."
              : "L’objectif : te donner des repères fiables et actionnables. Pour les cas complexes, une consultante valide."}
          </p>

          <div className="mt-10 grid gap-6 md:grid-cols-3">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
              <p className="text-xs uppercase tracking-[0.35em] text-slate-500">
                {isEN ? "Customs / VAT" : "Douanes / TVA"}
              </p>
              <p className="mt-2 text-lg font-semibold text-slate-900">
                {isEN ? "Rules & obligations" : "Règles & obligations"}
              </p>
              <p className="mt-2 text-sm text-slate-600">
                {isEN
                  ? "Spot risk areas (VAT, exemptions, statements, proof)."
                  : "Aide à repérer les zones à risque (TVA, exonérations, mentions, justificatifs)."}
              </p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
              <p className="text-xs uppercase tracking-[0.35em] text-slate-500">DDP / Incoterms</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">
                {isEN ? "Responsibilities & costs" : "Responsabilités & coûts"}
              </p>
              <p className="mt-2 text-sm text-slate-600">
                {isEN
                  ? "Clarifies who pays what and where hidden costs (and disputes) appear."
                  : "Clarifie qui paie quoi, et où se cachent les coûts (et litiges) classiques."}
              </p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
              <p className="text-xs uppercase tracking-[0.35em] text-slate-500">
                {isEN ? "Compliance" : "Conformité"}
              </p>
              <p className="mt-2 text-lg font-semibold text-slate-900">
                {isEN ? "Sanctions / vigilance" : "Sanctions / vigilance"}
              </p>
              <p className="mt-2 text-sm text-slate-600">
                {isEN ? "Signals & control points before shipment." : "Signaux faibles & points de contrôle avant expédition."}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-16">
        <div className="mx-auto max-w-5xl px-6 text-center">
          <p className="text-sm uppercase tracking-[0.5em] text-slate-500">
            {isEN ? "Next steps" : "Étapes suivantes"}
          </p>
          <h3 className="mt-3 text-3xl font-semibold text-slate-900">
            {isEN ? "Need an expert?" : "Besoin d’un expert ?"}
          </h3>
          <p className="mt-2 text-slate-600">
            {isEN
              ? "The tool gives a first view. A consultant validates complex cases (VAT, DDP, compliance)."
              : "L’outil vous donne un premier aperçu. La consultante confirme les cas complexes (TVA, DDP, conformité)."}
          </p>

          <div className="mt-6 flex flex-wrap justify-center gap-4">
            <Link
              to="/import/check-invoice"
              className="rounded-full bg-[#1E3A8A] px-6 py-3 text-xs font-semibold uppercase tracking-[0.4em] text-white transition hover:bg-[#162864]"
            >
              {isEN ? "Check an invoice" : "Vérifier une facture"}
            </Link>
            <Link
              to="/contact"
              className="rounded-full border border-[#1E3A8A]/60 px-6 py-3 text-xs font-semibold uppercase tracking-[0.4em] text-[#1E3A8A] transition hover:border-[#1E3A8A]"
            >
              {isEN ? "Talk to a consultant" : "Parler à la consultante"}
            </Link>
            <a
              href={`tel:0676435551`}
              className="rounded-full border border-slate-300 bg-white px-6 py-3 text-xs font-semibold uppercase tracking-[0.4em] text-slate-800 transition hover:border-slate-500"
            >
              {isEN ? "Call" : "Appeler"} {phonePretty}
            </a>
          </div>

          <div className="mt-6 text-xs text-slate-500">
            Email direct :{" "}
            <a className="underline" href={`mailto:${emailMain}`}>
              {emailMain}
            </a>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
