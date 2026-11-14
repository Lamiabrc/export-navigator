import { Link } from "react-router-dom";
import { ArrowRight, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";

type HomeAtelierSpotlightProps = {
  isEn: boolean;
};

const STEPS = {
  fr: [
    {
      title: "Devis et cadrage",
      body: "Vos produits, vos marchés et la réglementation qui les concerne.",
    },
    {
      title: "Atelier sur mesure",
      body: "Une demi-journée ou une journée, sur vos cas réels et vos outils.",
    },
    {
      title: "Ancrage",
      body: "Des demi-journées de suivi pour que les usages tiennent dans la durée.",
    },
  ],
  en: [
    {
      title: "Quote and scoping",
      body: "Your products, your markets and the regulations that apply to them.",
    },
    {
      title: "Tailored workshop",
      body: "Half a day or a full day, on your real cases and your tools.",
    },
    {
      title: "Follow-up",
      body: "Half-day sessions so the new habits last.",
    },
  ],
} as const;

export function HomeAtelierSpotlight({ isEn }: HomeAtelierSpotlightProps) {
  const steps = isEn ? STEPS.en : STEPS.fr;

  return (
    <section className="overflow-hidden rounded-[28px] border border-emerald-100 bg-[linear-gradient(135deg,#f0fdf4_0%,#ffffff_48%,#eff6ff_100%)] p-6 shadow-sm sm:p-8">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-emerald-800">
            <Sparkles className="h-3.5 w-3.5" />
            {isEn ? "AI & Export workshop" : "Atelier IA & Export"}
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
              {isEn
                ? "Give purpose to the assistants and teams you already have."
                : "Donner du sens aux assistants et aux équipes déjà en place."}
            </h2>
            <p className="text-sm text-slate-700 sm:text-base">
              {isEn
                ? "AI does not replace your export assistant, your sales rep or your forwarder. It gives them time back, provided everyone knows what it is for."
                : "L'IA ne remplace ni votre assistante export, ni votre commercial, ni votre transitaire. Elle leur redonne du temps, à condition que chacun sache à quoi elle sert."}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild className="h-11 rounded-full px-5">
            <Link to="/pricing">
              {isEn ? "See the workshop" : "Voir l'atelier"}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-11 rounded-full border-slate-300 bg-white px-5">
            <Link to="/contact?offer=atelier">{isEn ? "Request a quote" : "Demander un devis"}</Link>
          </Button>
        </div>
      </div>

      <ol className="mt-6 grid gap-4 lg:grid-cols-3">
        {steps.map((step, index) => (
          <li key={step.title} className="rounded-3xl border border-slate-200 bg-white/95 p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-800">
              {String(index + 1).padStart(2, "0")}
            </p>
            <h3 className="mt-3 text-lg font-semibold text-slate-950">{step.title}</h3>
            <p className="mt-2 text-sm text-slate-600">{step.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
