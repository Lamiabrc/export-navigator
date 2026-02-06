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

  // ✅ Robust i18n fallback (si la clé renvoie "heroLanding.title", on prend le fallback)
  const tt = (key: string, frFallback: string, enFallback: string) => {
    try {
      const v = t(key as any) as any;
      if (!v || typeof v !== "string" || v === key) return isEN ? enFallback : frFallback;
      return v;
    } catch {
      return isEN ? enFallback : frFallback;
    }
  };

  const heroTitle = tt(
    "heroLanding.title",
    "Votre tour de controle export, prete en 24 h.",
    "Your export control tower, ready in 24 hours."
  );

  const heroSubtitle = tt(
    "heroLanding.subtitle",
    "Cockpit regle sur vos produits et destinations : couts, taxes, documents, risques. Vous decidez vite.",
    "Cockpit tuned to your products and destinations: costs, taxes, documents, risks. Decide faster."
  );

  const heroPrimary = tt("heroLanding.ctaPrimary", "Voir le cockpit", "View the cockpit");
  const heroSecondary = tt("heroLanding.ctaSecondary", "Offre en ligne 65 EUR/mois", "Online plan EUR 65/mo");

  // Bullets (fallback si i18n vide)
  const heroBulletsRaw = t("heroLanding.bullets");
  const heroBullets: string[] =
    Array.isArray(heroBulletsRaw) && heroBulletsRaw.length
      ? (heroBulletsRaw as string[])
      : isEN
        ? [
            "Profile set by country & HS",
            "Landed cost + DDP/Incoterms alerts",
            "Clear document checklist",
            "Targeted watch by destination",
          ]
        : [
            "Profil regle par pays & HS",
            "Cout rendu + alertes DDP/Incoterms",
            "Checklist documents claire",
            "Veille ciblee par destination",
          ];

  // Feature cards (fallback si i18n vide)
  const featureCardsRaw = t("heroLanding.featureCards");
  const featureCardsFromI18n: FeatureCard[] = Array.isArray(featureCardsRaw)
    ? (featureCardsRaw as unknown as FeatureCard[])
    : [];

  const featureCards: FeatureCard[] =
    featureCardsFromI18n?.length > 0
      ? featureCardsFromI18n
      : isEN
        ? [
            {
              title: "Costs & margins",
              description: "Fast scenarios: VAT, duties, transport, margin impact.",
            },
            {
              title: "Documents & compliance",
              description: "Clear checklist, required docs, anomalies to fix.",
            },
            {
              title: "Destination steering",
              description: "Read by country/HS, risks and obligations per market.",
            },
          ]
        : [
            {
              title: "Couts & marges",
              description: "Scenarios rapides : TVA, droits, transport, impact marge.",
            },
            {
              title: "Documents & conformite",
              description: "Checklist claire, pieces a fournir, anomalies a corriger.",
            },
            {
              title: "Pilotage par destination",
              description: "Lecture par pays/HS, risques et obligations par marche.",
            },
          ];

  const proofTitle = tt(
    "heroLanding.proofTitle",
    "Ce que le cockpit automatise",
    "What the cockpit automates"
  );

  const proofDescription =
    (t("heroLanding.proofDescription") as string) && (t("heroLanding.proofDescription") as string) !== "heroLanding.proofDescription"
      ? (t("heroLanding.proofDescription") as string)
      : isEN
        ? "A cockpit that removes manual routines: costs, compliance, documents, watch."
        : "Un cockpit qui remplace les routines manuelles : couts, conformite, documents, veille.";

  const proofItemsRaw = t("heroLanding.proofItems");
  const proofItemsFromI18n: Array<{ title: string; description: string }> =
    Array.isArray(proofItemsRaw) && proofItemsRaw.length > 0 && typeof proofItemsRaw[0] === "object"
      ? (proofItemsRaw as unknown as Array<{ title: string; description: string }>)
      : [];

  const proofItems: Array<{ title: string; description: string }> =
    proofItemsFromI18n.length > 0
      ? proofItemsFromI18n
      : isEN
        ? [
            { title: "Landed cost", description: "Quick cost scenarios: destination, value, transport, fees." },
            { title: "DDP / Incoterms", description: "Flags hidden costs + responsibilities that create disputes." },
            { title: "Document checklist", description: "Invoice, packing list, origin, transport docs — what’s needed." },
            { title: "Watch signals", description: "Sanctions & regulatory signals to avoid last-minute surprises." },
          ]
        : [
            { title: "Coût rendu", description: "Scénarios rapides : destination, valeur, transport, frais." },
            { title: "DDP / Incoterms", description: "Alerte sur coûts cachés + responsabilités à risque." },
            { title: "Checklist documents", description: "Facture, packing list, origine, transport — indispensables." },
            { title: "Veille & signaux", description: "Sanctions & signaux réglementaires pour éviter la surprise." },
          ];

  // Contact direct
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
              style={{
                backgroundImage: "url(/videos/hero-export.jpg)",
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
              aria-hidden
            />
          )}

          {/* overlays */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#0B1220]/85 via-[#0B1220]/70 to-[#0B1220]/90" aria-hidden />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.10),transparent_55%)]" aria-hidden />
          <div
            className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[size:64px_64px] opacity-20"
            aria-hidden
          />
        </div>

        <div className="relative z-10 mx-auto flex min-h-[88vh] max-w-5xl flex-col items-center justify-center gap-6 px-6 text-center">
          <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs tracking-[0.2em] font-semibold text-white/70">
            MPL Export Navigator
            <span className="hidden rounded-full bg-white/10 px-2 py-1 text-[10px] tracking-[0.3em] text-white/70 sm:inline">
              {heroSecondary}
            </span>
          </p>

          <h1 className="text-4xl font-semibold font-display leading-tight text-white sm:text-5xl md:text-6xl lg:text-7xl">
            {heroTitle}
          </h1>

          <p className="max-w-3xl text-lg leading-relaxed text-white/80 md:text-xl">{heroSubtitle}</p>

          <div className="mt-2 max-w-3xl">
            <div className="rounded-3xl border border-white/15 bg-white/5 p-4 text-left">
              <p className="text-xs tracking-[0.2em] font-semibold text-white/60">
                {isEN ? "Simple promise" : "Promesse simple"}
              </p>
              <p className="mt-2 text-sm text-white/85">
                {isEN
                  ? "Less stress before shipping: you get a clear GO/NO GO and the exact fixes to apply."
                  : "Moins de stress avant expédition : un GO/NO GO clair + les corrections à appliquer."}
              </p>
            </div>
          </div>

          <div className="mt-4 grid w-full max-w-3xl grid-cols-1 gap-2 text-xs tracking-[0.2em] font-semibold text-white/80 md:grid-cols-2">
            {heroBullets.map((bullet) => (
              <div key={bullet} className="rounded-2xl border border-white/20 bg-white/10 px-3 py-2">
                {bullet}
              </div>
            ))}
          </div>

          <div className="flex flex-wrap justify-center gap-4 text-xs font-semibold tracking-[0.2em] md:text-sm">
            <Link to="/tool" className="rounded-full bg-[#DC2626] px-7 py-3 text-white transition hover:bg-[#b0231d]">
              {heroPrimary}
            </Link>
            <Link to="/pricing" className="rounded-full border border-white/80 px-7 py-3 text-white transition hover:border-white">
              {heroSecondary}
            </Link>
          </div>

          {/* PROOF BAR */}
          <div className="mt-6 grid w-full max-w-4xl grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-left">
              <p className="text-xs tracking-[0.2em] font-semibold text-white/60">
                {isEN ? "Costs" : "Coûts"}
              </p>
              <p className="mt-1 text-sm text-white/85">
                {isEN ? "Landed cost scenarios in minutes." : "Scénarios de coût rendu en quelques minutes."}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-left">
              <p className="text-xs tracking-[0.2em] font-semibold text-white/60">
                {isEN ? "Risks" : "Risques"}
              </p>
              <p className="mt-1 text-sm text-white/85">
                {isEN ? "DDP / VAT / compliance traps flagged." : "Pièges DDP / TVA / conformité détectés."}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-left">
              <p className="text-xs tracking-[0.2em] font-semibold text-white/60">
                {isEN ? "Action" : "Action"}
              </p>
              <p className="mt-1 text-sm text-white/85">
                {isEN ? "Checklist + GO/NO GO output." : "Checklist + sortie GO/NO GO."}
              </p>
            </div>
          </div>

          {/* CONTACT STRIP */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-xs tracking-[0.2em] font-semibold text-white/70">
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
              to="/contact?offer=diagnostic"
              className="rounded-full border border-white/20 px-4 py-2 text-white/80 transition hover:border-white/60"
            >
              {isEN ? "Express audit" : "Audit express"}
            </Link>
          </div>
        </div>
      </section>

      {/* AUTOMATION PROOF */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs tracking-[0.2em] font-semibold text-[#1E3A8A]">{proofTitle}</p>
              <p className="mt-2 text-sm text-slate-600">{proofDescription}</p>
            </div>
            <div className="mt-4 flex flex-wrap gap-3 md:mt-0">
              <Link
                to="/pricing"
                className="rounded-full bg-[#1E3A8A] px-6 py-3 text-xs font-semibold tracking-[0.2em] text-white transition hover:bg-[#162864]"
              >
                {isEN ? "See €65 plan" : "Voir l’offre 65€"}
              </Link>
              <Link
                to="/veille"
                className="rounded-full border border-[#1E3A8A]/30 px-6 py-3 text-xs font-semibold tracking-[0.2em] text-[#1E3A8A] transition hover:border-[#1E3A8A]"
              >
                {isEN ? "View watch" : "Voir la veille"}
              </Link>
            </div>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {proofItems.map((item) => (
              <article
                key={item.title}
                className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-6 shadow-sm"
              >
                <h3 className="text-lg font-semibold text-[#1E3A8A]">{item.title}</h3>
                <p className="text-sm text-slate-600">{item.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* FOCUS */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-xs tracking-[0.2em] font-semibold text-[#1E3A8A]">Focus</h2>
              <p className="mt-2 text-3xl font-semibold font-display text-[#0B1220]">
                {isEN ? "Clear view, fast decisions" : "Vue claire, décisions rapides"}
              </p>
              <p className="mt-2 max-w-2xl text-sm text-slate-600">
                {isEN
                  ? "Operational export view: costs, risk flags, and what to fix before shipment."
                  : "Une lecture export opérationnelle : coûts, alertes risques, et ce qu’il faut corriger avant expédition."}
              </p>
            </div>

            <div className="mt-4 flex flex-wrap gap-3 md:mt-0">
              <Link
                to="/import/check-invoice"
                className="rounded-full bg-[#1E3A8A] px-6 py-3 text-xs font-semibold tracking-[0.2em] text-white transition hover:bg-[#162864]"
              >
                {isEN ? "Check an invoice" : "Vérifier une facture"}
              </Link>
              <Link
                to="/tool"
                className="rounded-full border border-[#1E3A8A]/30 px-6 py-3 text-xs font-semibold tracking-[0.2em] text-[#1E3A8A] transition hover:border-[#1E3A8A]"
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
                <div className="mt-3 flex items-center gap-3">
                  <Link
                    to="/tool"
                    className="text-xs font-semibold tracking-[0.2em] text-[#0B1220]/70 transition group-hover:text-[#0B1220]"
                  >
                    {isEN ? "Try →" : "Essayer →"}
                  </Link>
                  <span className="text-xs text-slate-400">•</span>
                  <Link
                    to="/pricing"
                    className="text-xs font-semibold tracking-[0.2em] text-[#1E3A8A]/80 transition hover:text-[#1E3A8A]"
                  >
                    {isEN ? "€65/mo" : "65€/mois"}
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
          <h3 className="text-xs tracking-[0.2em] font-semibold text-slate-500">
            {isEN ? "How it works" : "Comment ça marche"}
          </h3>
          <p className="mt-2 text-3xl font-semibold font-display text-slate-900">
            {isEN ? "3 steps, no hassle" : "3 étapes, sans prise de tête"}
          </p>

          <div className="mt-10 grid gap-6 md:grid-cols-3">
            <div className="rounded-3xl border border-slate-200 bg-white p-6">
              <p className="text-xs tracking-[0.2em] font-semibold text-slate-500">{isEN ? "Step 1" : "Étape 1"}</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">
                {isEN ? "Choose destination & context" : "Choisir destination & contexte"}
              </p>
              <p className="mt-2 text-sm text-slate-600">
                {isEN ? "Country/territory + operation type." : "Pays/territoire + type d’opération."}
              </p>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6">
              <p className="text-xs tracking-[0.2em] font-semibold text-slate-500">{isEN ? "Step 2" : "Étape 2"}</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">
                {isEN ? "Import / check an invoice" : "Importer / vérifier une facture"}
              </p>
              <p className="mt-2 text-sm text-slate-600">
                {isEN ? "Quick checks + alerts on inconsistencies." : "Contrôles rapides + alertes si incohérences."}
              </p>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6">
              <p className="text-xs tracking-[0.2em] font-semibold text-slate-500">{isEN ? "Step 3" : "Étape 3"}</p>
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
              className="rounded-full bg-[#DC2626] px-6 py-3 text-xs font-semibold tracking-[0.2em] text-white transition hover:bg-[#b0231d]"
            >
              {isEN ? "Start now" : "Démarrer maintenant"}
            </Link>
            <Link
              to="/pricing"
              className="rounded-full border border-slate-300 bg-white px-6 py-3 text-xs font-semibold tracking-[0.2em] text-slate-800 transition hover:border-slate-500"
            >
              {isEN ? "Plans & limits" : "Offres & limites"}
            </Link>
          </div>
        </div>
      </section>

      {/* SOURCES / TRUST */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-6xl px-6">
          <h3 className="text-xs tracking-[0.2em] font-semibold text-[#1E3A8A]">{isEN ? "Trust" : "Confiance"}</h3>
          <p className="mt-2 text-3xl font-semibold font-display text-[#0B1220]">
            {isEN ? "Compliance & watch, at the right place" : "Conformité & veille, au bon endroit"}
          </p>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            {isEN
              ? "Goal: reliable, actionable references. For sensitive cases, an expert can validate."
              : "Objectif : des repères fiables et actionnables. Pour les cas sensibles, une experte peut valider."}
          </p>

          <div className="mt-10 grid gap-6 md:grid-cols-3">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
              <p className="text-xs tracking-[0.2em] font-semibold text-slate-500">{isEN ? "Customs / VAT" : "Douanes / TVA"}</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">{isEN ? "Rules & obligations" : "Règles & obligations"}</p>
              <p className="mt-2 text-sm text-slate-600">
                {isEN
                  ? "Spot risk areas (VAT, statements, proof, local rules)."
                  : "Repérez les zones à risque (TVA, mentions, justificatifs, règles locales)."}
              </p>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
              <p className="text-xs tracking-[0.2em] font-semibold text-slate-500">DDP / Incoterms</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">
                {isEN ? "Responsibilities & costs" : "Responsabilités & coûts"}
              </p>
              <p className="mt-2 text-sm text-slate-600">
                {isEN
                  ? "Clarifies who pays what and where hidden costs appear."
                  : "Clarifie qui paie quoi, et où se cachent les coûts classiques."}
              </p>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
              <p className="text-xs tracking-[0.2em] font-semibold text-slate-500">{isEN ? "Compliance" : "Conformité"}</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">{isEN ? "Sanctions / vigilance" : "Sanctions / vigilance"}</p>
              <p className="mt-2 text-sm text-slate-600">
                {isEN ? "Signals & control points before shipment." : "Signaux & points de contrôle avant expédition."}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-16">
        <div className="mx-auto max-w-5xl px-6 text-center">
          <p className="text-xs tracking-[0.2em] font-semibold text-slate-500">{isEN ? "Next steps" : "Étapes suivantes"}</p>
          <h3 className="mt-3 text-3xl font-semibold font-display text-slate-900">{isEN ? "Need an expert?" : "Besoin d’un expert ?"}</h3>
          <p className="mt-2 text-slate-600">
            {isEN
              ? "The tool gives a first view. For high-risk shipments (DDP, sanctions, sensitive goods), get an express validation."
              : "L’outil donne une première vue. Pour un envoi à risque (DDP, sanctions, produit sensible), demandez une validation express."}
          </p>

          <div className="mt-6 flex flex-wrap justify-center gap-4">
            <Link
              to="/tool"
              className="rounded-full bg-[#DC2626] px-6 py-3 text-xs font-semibold tracking-[0.2em] text-white transition hover:bg-[#b0231d]"
            >
              {isEN ? "Run the tool" : "Lancer l’outil"}
            </Link>
            <Link
              to="/pricing"
              className="rounded-full border border-[#1E3A8A]/60 px-6 py-3 text-xs font-semibold tracking-[0.2em] text-[#1E3A8A] transition hover:border-[#1E3A8A]"
            >
              {isEN ? "Online plan €65/mo" : "Offre en ligne 65€/mois"}
            </Link>
            <Link
              to="/contact?offer=diagnostic"
              className="rounded-full border border-slate-300 bg-white px-6 py-3 text-xs font-semibold tracking-[0.2em] text-slate-800 transition hover:border-slate-500"
            >
              {isEN ? "Express validation" : "Validation express"}
            </Link>
          </div>

          <div className="mt-6 text-xs text-slate-500">
            {isEN ? "Direct email:" : "Email direct :"}{" "}
            <a className="underline" href={`mailto:${emailMain}`}>
              {emailMain}
            </a>
            {" • "}
            <a className="underline" href={`tel:${phoneRaw}`}>
              {phonePretty}
            </a>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
