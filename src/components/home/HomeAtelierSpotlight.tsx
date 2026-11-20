import { Link } from "react-router-dom";
import { ArrowRight, BrainCircuit, CheckCircle2, Globe2, Handshake, ShieldCheck } from "lucide-react";

type HomeAtelierSpotlightProps = { isEn: boolean };

const OFFERS = [
  {
    icon: Globe2,
    fr: { tag: "Développement international", title: "Préparer et structurer votre export", body: "Choix des marchés, préparation des démarches, documents et risques à anticiper. Un plan adapté à votre entreprise, sans jargon.", cta: "Parler de mon projet export", slug: "export" },
    en: { tag: "International growth", title: "Plan your next export steps", body: "Market selection, operational preparation, documentation and risks. A clear action plan adapted to your business.", cta: "Discuss my export project", slug: "export" },
  },
  {
    icon: BrainCircuit,
    fr: { tag: "Ateliers pratiques", title: "Utiliser l'IA dans vos tâches réelles", body: "Prospection, devis, recherche documentaire et suivi client : découvrez des usages concrets, avec vérification humaine.", cta: "Demander un atelier IA", slug: "atelier" },
    en: { tag: "Practical workshops", title: "Put AI to work on real tasks", body: "Prospecting, quotations, research and customer follow-up: practical workflows with human verification.", cta: "Ask about an AI workshop", slug: "atelier" },
  },
  {
    icon: Handshake,
    fr: { tag: "Conseil opérationnel", title: "Avancer avec un accompagnement sur mesure", body: "Un diagnostic de votre situation, des priorités réalistes et un suivi pour passer de l'idée à l'action.", cta: "Demander un échange", slug: "accompagnement" },
    en: { tag: "Hands-on consulting", title: "Move forward with tailored support", body: "A review of your situation, realistic priorities and follow-up to turn plans into action.", cta: "Request a conversation", slug: "accompagnement" },
  },
] as const;

export function HomeAtelierSpotlight({ isEn }: HomeAtelierSpotlightProps) {
  return (
    <section aria-labelledby="mpl-offers" className="relative overflow-hidden rounded-[28px] border border-slate-200 bg-white px-5 py-10 shadow-sm sm:px-9 sm:py-12">
      <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-36 h-80 w-80 rounded-full bg-emerald-100/60 blur-3xl" />
      <div className="relative max-w-3xl">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">
          {isEn ? "MPL Export Conseil · AI & Export" : "MPL Export Conseil · IA & Export"}
        </p>
        <h2 id="mpl-offers" className="mt-4 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
          {isEn ? "Clear solutions for your business, not another complicated tool." : "Des solutions concrètes pour développer votre entreprise."}
        </h2>
        <p className="mt-4 text-base leading-relaxed text-slate-600 sm:text-lg">
          {isEn
            ? "Whether you want to export, save time with AI or organise your operations, we start from your goals and available resources."
            : "Vous voulez exporter, gagner du temps avec l'IA ou structurer votre activité ? Nous partons de vos besoins, de vos moyens et de vos objectifs."}
        </p>
      </div>
      <div className="relative mt-8 grid gap-4 lg:grid-cols-3">
        {OFFERS.map((offer) => {
          const Icon = offer.icon;
          const copy = isEn ? offer.en : offer.fr;
          return (
            <article key={copy.slug} className="group flex flex-col rounded-2xl border border-slate-200 bg-slate-50/70 p-6 transition-colors hover:border-emerald-300 hover:bg-emerald-50/40">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800"><Icon className="h-5 w-5" aria-hidden="true" /></div>
              <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-emerald-700">{copy.tag}</p>
              <h3 className="mt-2 text-xl font-semibold leading-snug text-slate-900">{copy.title}</h3>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-slate-600">{copy.body}</p>
              <Link to={`/contact?offer=${copy.slug}`} className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-emerald-800 underline-offset-4 hover:underline">
                {copy.cta}<ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </article>
          );
        })}
      </div>
      <div className="relative mt-8 flex flex-col gap-5 rounded-2xl bg-slate-900 px-6 py-7 text-white md:flex-row md:items-center md:justify-between">
        <div className="max-w-xl">
          <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-300"><CheckCircle2 className="h-4 w-4" />{isEn ? "Start with a conversation" : "Commencez par un échange"}</p>
          <h3 className="mt-2 text-xl font-semibold">{isEn ? "Not sure where to begin?" : "Vous ne savez pas par où commencer ?"}</h3>
          <p className="mt-2 text-sm text-slate-300">{isEn ? "Tell us your challenge. We'll assess the next practical step with you, without an automatic commitment." : "Décrivez-nous votre activité et votre besoin. Nous identifierons ensemble une première piste d'action, sans engagement automatique."}</p>
        </div>
        <Link to="/contact?offer=diagnostic" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-emerald-400 px-6 py-3 text-sm font-bold text-slate-950 transition-colors hover:bg-emerald-300">
          {isEn ? "Describe my project" : "Décrire mon projet"}<ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
      <p className="relative mt-5 flex items-start gap-2 text-xs leading-relaxed text-slate-500">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        {isEn ? "AI-generated suggestions and regulatory information require verification using official sources and qualified professionals." : "Les suggestions de l'IA et les informations réglementaires doivent être vérifiées auprès des sources officielles et des professionnels compétents."}
      </p>
    </section>
  );
}
