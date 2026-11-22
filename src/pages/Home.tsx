import * as React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check, ChevronDown, Mail, Phone, X } from "lucide-react";

import { PublicLayout } from "@/components/layout/PublicLayout";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useI18n } from "@/contexts/LanguageContext";

const NAVY = "#08285A";
const RED = "#E2141E";
const PHONE_RAW = "+33676435551";
const PHONE_PRETTY = "06 76 43 55 51";
const EMAIL = "contact@exportfrancefacile.com";

const COPY = {
  fr: {
    eyebrow: "MPL Export Conseil · IA & Export",
    title: "Récupérez un mois de travail par personne. Sans recruter.",
    lead:
      "J'aide les équipes export des PME à intégrer l'IA dans leur quotidien : un agent configuré sur vos produits, vos marchés et vos règles, et une équipe formée pour s'en servir sans se perdre.",
    ctaMain: "Demander mon diagnostic",
    ctaSecond: "Faire le test (2 min)",
    trust: "Terrain export depuis 2018 · CNAM · Licence de droit",
    portraitAlt: "Lamia Bréchet, MPL Export Conseil",
    calcEyebrow: "Le calcul",
    calcTitle: "Ce que la paperasse coûte à votre équipe export",
    stats: [
      { value: "7 h", label: "par semaine de tâches administratives", note: "Salariés en France, étude Adobe" },
      { value: "≈ 30 €", label: "de l'heure pour une assistante export", note: "Salaire médian Hays 2026, charges ≈ 42 % (Urssaf)" },
      { value: "3 h 30", label: "rendues chaque semaine par l'IA", note: "Hypothèse : la moitié du temps administratif" },
      { value: "160 h", label: "par an, soit un mois de travail", note: "3 h 30 × 45 semaines travaillées" },
    ],
    calcFoot: "Estimation indicative, à affiner lors du diagnostic avec vos propres chiffres.",
    calcCtaTitle: "Et chez vous ?",
    calcCtaBody: "Faites le test en 2 minutes : heures récupérables par votre équipe, tâches à traiter en premier et niveau de maturité IA.",
    calcCta: "Faire le test",
    agentEyebrow: "Votre agent IA sur mesure",
    agentTitle: "Un agent à vous, pas un outil de plus",
    agentLead:
      "Chaque entreprise a ses produits, ses clients et ses habitudes. L'agent est configuré sur les vôtres, dans un espace dédié à votre entreprise.",
    sources: ["Catalogue", "Tarifs", "Clients", "Incoterms", "Règles pays", "E-mails"],
    steps: [
      { title: "Il lit", body: "Demandes de prix, commandes, e-mails entrants." },
      { title: "Il prépare", body: "Devis, liste des documents, brouillons de relance." },
      { title: "Il vérifie", body: "Cohérence facture, colisage et exigences du pays de destination." },
      { title: "Vous validez", body: "Rien ne part sans votre équipe." },
    ],
    changeEyebrow: "Ce qui change",
    changeTitle: "L'IA ne remplace pas votre équipe. Elle la rend plus forte.",
    roles: [
      { who: "Assistante export", before: ["Saisir", "Recopier", "Relancer"], after: ["Contrôler", "Sécuriser", "Conseiller"] },
      { who: "Responsable export", before: ["Tableaux", "Reporting", "E-mails"], after: ["Terrain", "Négociation", "Clients"] },
    ],
    beforeLabel: "Avant",
    afterLabel: "Avec l'IA",
    offerEyebrow: "L'offre",
    offerTitle: "Trois temps, à partir de votre réalité",
    offer: [
      { n: "1", title: "Diagnostic et devis", body: "J'étudie vos produits, vos marchés et la réglementation qui les concerne, puis je vous propose un plan adapté." },
      { n: "2", title: "Atelier sur mesure", body: "Une demi-journée ou une journée sur vos dossiers réels, avec l'équipe déjà en place." },
      { n: "3", title: "Suivi", body: "Des demi-journées pour ancrer les usages et faire évoluer votre agent." },
    ],
    offerLink: "Détail de l'atelier",
    meEyebrow: "Qui vous accompagne",
    meTitle: "Lamia Bréchet",
    meBody: [
      "Depuis mon diplôme en import-export à Rennes en 2018, je travaille au plus près des process export des PME comme des grands groupes.",
      "Certificat CNAM « Environnement international des entreprises », licence de droit, et aujourd'hui l'IA au service des équipes export.",
    ],
    meLink: "Mon parcours",
    videoTitle: "En 38 secondes",
    videoLabel: "Vidéo : comment l'IA transforme les métiers d'assistante et de responsable export",
    faqTitle: "Vos questions",
    faq: [
      {
        q: "Mes données restent-elles confidentielles ?",
        a: "L'agent est configuré dans un espace dédié à votre entreprise. Nous choisissons ensemble les informations à lui confier, et ce qui est sensible peut rester en dehors de l'IA.",
      },
      {
        q: "Combien ça coûte ?",
        a: "Le prix dépend de votre équipe et de vos besoins. Le diagnostic permet de vous remettre un devis clair avant tout engagement.",
      },
      {
        q: "Combien de temps faut-il ?",
        a: "Une demi-journée ou une journée d'atelier, puis des demi-journées de suivi selon le rythme de votre équipe.",
      },
      {
        q: "Faut-il des compétences techniques ?",
        a: "Non. L'atelier part des tâches quotidiennes de votre équipe, avec ses outils habituels.",
      },
      {
        q: "L'IA remplace-t-elle mon équipe ?",
        a: "Non. Elle prépare le travail ; votre équipe contrôle, décide et garde la relation client. Les points sensibles (douane, normes, fiscalité) se vérifient toujours auprès de sources officielles.",
      },
    ],
    endTitle: "Parlons de votre équipe export",
    endBody: "Un premier échange suffit pour savoir où l'IA vous ferait gagner du temps.",
  },
  en: {
    eyebrow: "MPL Export Conseil · AI & Export",
    title: "Win back a month of work per person. Without hiring.",
    lead:
      "I help SME export teams bring AI into their daily work: an agent set up on your products, markets and rules, and a team trained to use it without getting lost.",
    ctaMain: "Request my diagnostic",
    ctaSecond: "Take the 2-min test",
    trust: "Export field work since 2018 · CNAM · Law degree",
    portraitAlt: "Lamia Bréchet, MPL Export Conseil",
    calcEyebrow: "The math",
    calcTitle: "What paperwork costs your export team",
    stats: [
      { value: "7 h", label: "per week of admin tasks", note: "Employees in France, Adobe study" },
      { value: "≈ €30", label: "per hour for an export assistant", note: "Hays 2026 median salary, ≈ 42% employer costs (Urssaf)" },
      { value: "3.5 h", label: "given back each week by AI", note: "Assumption: half of admin time" },
      { value: "160 h", label: "per year, one month of work", note: "3.5 h × 45 working weeks" },
    ],
    calcFoot: "Indicative estimate, refined with your own figures during the diagnostic.",
    calcCtaTitle: "What about your team?",
    calcCtaBody: "Take the 2-minute test (in French): hours your team could get back, tasks to tackle first and AI maturity level.",
    calcCta: "Take the test",
    agentEyebrow: "Your tailored AI agent",
    agentTitle: "An agent of your own, not one more tool",
    agentLead: "Every company has its own products, clients and habits. The agent is set up on yours, in a space dedicated to your company.",
    sources: ["Catalogue", "Prices", "Clients", "Incoterms", "Country rules", "E-mails"],
    steps: [
      { title: "It reads", body: "Price requests, orders, incoming e-mails." },
      { title: "It prepares", body: "Quotes, document lists, follow-up drafts." },
      { title: "It checks", body: "Invoice, packing list and destination-country requirements." },
      { title: "You approve", body: "Nothing goes out without your team." },
    ],
    changeEyebrow: "What changes",
    changeTitle: "AI does not replace your team. It makes it stronger.",
    roles: [
      { who: "Export assistant", before: ["Typing", "Copying", "Chasing"], after: ["Checking", "Securing", "Advising"] },
      { who: "Export manager", before: ["Spreadsheets", "Reporting", "E-mails"], after: ["Field work", "Negotiation", "Clients"] },
    ],
    beforeLabel: "Before",
    afterLabel: "With AI",
    offerEyebrow: "The offer",
    offerTitle: "Three steps, starting from your reality",
    offer: [
      { n: "1", title: "Diagnostic and quote", body: "I study your products, markets and the regulations that apply, then propose a tailored plan." },
      { n: "2", title: "Tailored workshop", body: "Half a day or a full day on your real files, with the team already in place." },
      { n: "3", title: "Follow-up", body: "Half-day sessions to anchor new habits and improve your agent." },
    ],
    offerLink: "Workshop details",
    meEyebrow: "Who supports you",
    meTitle: "Lamia Bréchet",
    meBody: [
      "Since my import-export degree in Rennes in 2018, I have worked closely with the export processes of SMEs and large groups.",
      "CNAM certificate in international business environment, law degree, and today AI for export teams.",
    ],
    meLink: "My background",
    videoTitle: "In 38 seconds",
    videoLabel: "Video: how AI transforms export assistant and export manager roles",
    faqTitle: "Your questions",
    faq: [
      { q: "Does my data stay confidential?", a: "The agent is set up in a space dedicated to your company. We choose together what it can access; sensitive information can stay outside the AI." },
      { q: "How much does it cost?", a: "It depends on your team and needs. The diagnostic gives you a clear quote before any commitment." },
      { q: "How long does it take?", a: "Half a day or a full day of workshop, then follow-up half days at your team's pace." },
      { q: "Do we need technical skills?", a: "No. The workshop starts from your team's daily tasks and usual tools." },
      { q: "Does AI replace my team?", a: "No. It prepares the work; your team checks, decides and keeps the client relationship. Sensitive points are always checked against official sources." },
    ],
    endTitle: "Let's talk about your export team",
    endBody: "One first conversation is enough to see where AI would save you time.",
  },
} as const;

function Eyebrow({ children, light = false }: { children: React.ReactNode; light?: boolean }) {
  return (
    <p className={`text-xs font-bold uppercase tracking-[0.2em] ${light ? "text-red-300" : "text-[#E2141E]"}`}>{children}</p>
  );
}

export default function Home() {
  const { lang } = useI18n();
  const c = lang === "en" ? COPY.en : COPY.fr;
  const [openFaq, setOpenFaq] = React.useState<number | null>(0);

  usePageMeta("meta.home.title", "meta.home.description", {
    brandSuffix: "MPL Export Conseil",
    canonicalUrl: "https://www.exportfrancefacile.com/",
    socialImageUrl: "https://www.exportfrancefacile.com/images/og-home.jpg",
    socialImageAlt: "MPL Export Conseil, IA & Export",
  });

  return (
    <PublicLayout>
      <main className="w-full overflow-x-clip bg-white text-slate-900">
        {/* Promesse */}
        <section style={{ backgroundColor: NAVY }} className="text-white">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-12 sm:px-8 md:grid-cols-[1.25fr_0.75fr] md:py-20">
            <div className="space-y-6">
              <Eyebrow light>{c.eyebrow}</Eyebrow>
              <h1 className="text-[2.1rem] font-extrabold leading-[1.1] tracking-tight sm:text-5xl">{c.title}</h1>
              <p className="max-w-xl text-lg leading-relaxed text-blue-100">{c.lead}</p>
              <div className="flex flex-wrap gap-3">
                <Link
                  to="/contact?offer=atelier"
                  style={{ backgroundColor: RED }}
                  className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold text-white shadow-lg shadow-black/20 hover:brightness-110"
                >
                  {c.ctaMain} <ArrowRight className="h-4 w-4" />
                </Link>
                <Link to="/test-export-ia" className="inline-flex items-center rounded-full border border-white/40 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10">
                  {c.ctaSecond}
                </Link>
              </div>
              <p className="text-sm text-blue-200">{c.trust}</p>
            </div>
            <div className="mx-auto w-56 sm:w-64 md:w-full md:max-w-xs">
              <img
                src="/images/lamia-brechet.webp"
                alt={c.portraitAlt}
                width={640}
                height={640}
                fetchPriority="high"
                className="aspect-square w-full rounded-[2rem] object-cover shadow-2xl shadow-black/30 ring-4 ring-white/10"
              />
            </div>
          </div>
        </section>

        {/* Le calcul */}
        <section className="mx-auto max-w-6xl px-5 py-14 sm:px-8 md:py-20">
          <Eyebrow>{c.calcEyebrow}</Eyebrow>
          <h2 className="mt-2 max-w-2xl text-3xl font-bold tracking-tight" style={{ color: NAVY }}>
            {c.calcTitle}
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {c.stats.map((s, i) => (
              <div key={s.value} className={`rounded-2xl p-6 ${i === 3 ? "text-white" : "border border-slate-200 bg-slate-50"}`} style={i === 3 ? { backgroundColor: RED } : undefined}>
                <div className="text-4xl font-extrabold" style={i === 3 ? undefined : { color: NAVY }}>
                  {s.value}
                </div>
                <div className={`mt-2 font-semibold ${i === 3 ? "text-white" : "text-slate-800"}`}>{s.label}</div>
                <div className={`mt-3 text-xs ${i === 3 ? "text-red-100" : "text-slate-500"}`}>{s.note}</div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-slate-500">{c.calcFoot}</p>
          <div className="mt-8 flex flex-col gap-4 rounded-2xl border-2 p-6 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: NAVY }}>
            <div>
              <p className="text-lg font-bold" style={{ color: NAVY }}>{c.calcCtaTitle}</p>
              <p className="mt-1 text-sm text-slate-600">{c.calcCtaBody}</p>
            </div>
            <Link to="/test-export-ia" style={{ backgroundColor: RED }} className="inline-flex shrink-0 items-center gap-2 self-start rounded-full px-6 py-3 text-sm font-bold text-white hover:brightness-110 sm:self-auto">
              {c.calcCta} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        {/* L'agent */}
        <section className="bg-slate-50">
          <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:px-8 md:grid-cols-2 md:py-20">
            <div className="space-y-4">
              <Eyebrow>{c.agentEyebrow}</Eyebrow>
              <h2 className="text-3xl font-bold tracking-tight" style={{ color: NAVY }}>
                {c.agentTitle}
              </h2>
              <p className="text-slate-600">{c.agentLead}</p>
              <div className="flex flex-wrap gap-2 pt-2">
                {c.sources.map((s) => (
                  <span key={s} className="rounded-full px-4 py-2 text-sm font-semibold text-white" style={{ backgroundColor: NAVY }}>
                    {s}
                  </span>
                ))}
              </div>
            </div>
            <ol className="space-y-4">
              {c.steps.map((s, i) => (
                <li key={s.title} className="flex gap-4 rounded-2xl border border-slate-200 bg-white p-5">
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg font-extrabold text-white"
                    style={{ backgroundColor: i === 3 ? RED : NAVY }}
                  >
                    {i + 1}
                  </span>
                  <div>
                    <div className="font-bold" style={{ color: i === 3 ? RED : NAVY }}>
                      {s.title}
                    </div>
                    <div className="text-sm text-slate-600">{s.body}</div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Ce qui change */}
        <section className="mx-auto max-w-6xl px-5 py-14 sm:px-8 md:py-20">
          <Eyebrow>{c.changeEyebrow}</Eyebrow>
          <h2 className="mt-2 max-w-3xl text-3xl font-bold tracking-tight" style={{ color: NAVY }}>
            {c.changeTitle}
          </h2>
          <div className="mt-8 grid gap-5 md:grid-cols-2">
            {c.roles.map((r) => (
              <div key={r.who} className="rounded-2xl border border-slate-200 p-6">
                <h3 className="text-xl font-bold" style={{ color: NAVY }}>
                  {r.who}
                </h3>
                <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-400">{c.beforeLabel}</div>
                    <ul className="space-y-2">
                      {r.before.map((b) => (
                        <li key={b} className="flex items-center gap-2 text-slate-400 line-through">
                          <X className="h-4 w-4 shrink-0" />
                          {b}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <div className="mb-2 text-xs font-bold uppercase tracking-widest" style={{ color: RED }}>
                      {c.afterLabel}
                    </div>
                    <ul className="space-y-2">
                      {r.after.map((a) => (
                        <li key={a} className="flex items-center gap-2 font-semibold text-slate-900">
                          <Check className="h-4 w-4 shrink-0" style={{ color: RED }} />
                          {a}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* L'offre */}
        <section style={{ backgroundColor: NAVY }} className="text-white">
          <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8 md:py-20">
            <Eyebrow light>{c.offerEyebrow}</Eyebrow>
            <h2 className="mt-2 text-3xl font-bold tracking-tight">{c.offerTitle}</h2>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {c.offer.map((o) => (
                <div key={o.n} className="rounded-2xl bg-white/5 p-6 ring-1 ring-white/10">
                  <div className="text-3xl font-extrabold text-red-300">{o.n}</div>
                  <div className="mt-2 text-lg font-bold">{o.title}</div>
                  <p className="mt-2 text-sm leading-relaxed text-blue-100">{o.body}</p>
                </div>
              ))}
            </div>
            <Link to="/pricing" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-white underline underline-offset-4">
              {c.offerLink} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        {/* Qui vous accompagne + vidéo */}
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-14 sm:px-8 md:grid-cols-2 md:py-20">
          <div className="space-y-4">
            <Eyebrow>{c.meEyebrow}</Eyebrow>
            <h2 className="text-3xl font-bold tracking-tight" style={{ color: NAVY }}>
              {c.meTitle}
            </h2>
            {c.meBody.map((p) => (
              <p key={p} className="text-slate-600">
                {p}
              </p>
            ))}
            <Link to="/about" className="inline-flex items-center gap-2 text-sm font-semibold underline underline-offset-4" style={{ color: NAVY }}>
              {c.meLink} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <figure className="mx-auto w-full max-w-sm">
            <video
              className="aspect-[4/5] w-full rounded-2xl bg-slate-900 shadow-xl"
              controls
              playsInline
              preload="none"
              poster="/videos/ia-metier-export.webp"
              aria-label={c.videoLabel}
            >
              <source src="/videos/ia-metier-export.mp4" type="video/mp4" />
            </video>
            <figcaption className="mt-2 text-center text-sm text-slate-500">{c.videoTitle}</figcaption>
          </figure>
        </section>

        {/* FAQ */}
        <section className="bg-slate-50">
          <div className="mx-auto max-w-3xl px-5 py-14 sm:px-8 md:py-20">
            <h2 className="text-3xl font-bold tracking-tight" style={{ color: NAVY }}>
              {c.faqTitle}
            </h2>
            <div className="mt-6 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white">
              {c.faq.map((f, i) => {
                const open = openFaq === i;
                return (
                  <div key={f.q}>
                    <button
                      type="button"
                      onClick={() => setOpenFaq(open ? null : i)}
                      aria-expanded={open}
                      className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left font-semibold text-slate-900"
                    >
                      {f.q}
                      <ChevronDown className={`h-5 w-5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
                    </button>
                    {open ? <p className="px-5 pb-5 text-sm leading-relaxed text-slate-600">{f.a}</p> : null}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Contact */}
        <section className="mx-auto max-w-6xl px-5 py-14 sm:px-8 md:py-20">
          <div className="rounded-[2rem] p-8 text-white sm:p-12" style={{ backgroundColor: NAVY }}>
            <h2 className="text-3xl font-bold tracking-tight">{c.endTitle}</h2>
            <p className="mt-3 max-w-xl text-blue-100">{c.endBody}</p>
            <div className="mt-6 flex flex-wrap gap-3 text-sm">
              <Link to="/contact?offer=atelier" style={{ backgroundColor: RED }} className="inline-flex items-center gap-2 rounded-full px-6 py-3 font-bold text-white hover:brightness-110">
                {c.ctaMain} <ArrowRight className="h-4 w-4" />
              </Link>
              <a href={`tel:${PHONE_RAW}`} className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 font-semibold" style={{ color: NAVY }}>
                <Phone className="h-4 w-4" />
                {PHONE_PRETTY}
              </a>
              <a href={`mailto:${EMAIL}`} className="inline-flex items-center gap-2 rounded-full border border-white/40 px-5 py-3 font-semibold text-white">
                <Mail className="h-4 w-4" />
                {EMAIL}
              </a>
            </div>
          </div>
        </section>
      </main>
    </PublicLayout>
  );
}
