import { useNavigate } from "react-router-dom";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/button";

const solutions = [
  {
    title: "Validation express",
    description: "Contrôle rapide : HS, documents, taxes, sanctions — avant expédition.",
    cta: "Demander une validation",
    action: (navigate: (path: string) => void) => navigate("/contact?offer=express"),
    badge: "Rapide",
  },
  {
    title: "Centre veille",
    description: "Alertes réglementaires & douanes sur vos pays/produits prioritaires.",
    cta: "Découvrir la veille",
    action: (navigate: (path: string) => void) => navigate("/veille"),
    badge: "Récurrent",
  },
  {
    title: "Control Tower",
    description: "Pilotage des flux export, risques et priorités marché (SaaS).",
    cta: "Accéder à l’app",
    action: (navigate: (path: string) => void) => navigate("/login"),
    badge: "SaaS",
  },
];

const benefits = [
  "Gain de temps sur les checks export",
  "Vision claire des risques par pays / HS",
  "Rapports PDF prêts à partager",
  "Alertes de veille personnalisées",
];

const forWho = [
  { label: "PME export", text: "Sécuriser rapidement une expédition et éviter les mauvaises surprises." },
  { label: "Responsable export", text: "Standardiser les contrôles et centraliser les décisions." },
  { label: "Dirigeant", text: "Avoir une vision simple : coûts, risques, documents, points de vigilance." },
];

export default function Solutions() {
  const navigate = useNavigate();

  return (
    <PublicLayout>
      <div className="space-y-10">
        {/* Hero lisible */}
        <section className="force-white rounded-3xl border border-white/10 bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 p-6 text-white md:p-10">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-4">
              <p className="text-xs uppercase tracking-[0.35em] text-blue-200">Solutions MPL Export Conseil</p>
              <h1 className="text-4xl font-semibold leading-tight md:text-5xl">
                La plateforme export claire, actionnable, et orientée décisions.
              </h1>
              <p className="text-lg text-slate-200">
                Un parcours simple : vous saisissez un produit (ou un HS) + un pays, et vous obtenez immédiatement
                estimation, documents, risques et options d’accompagnement.
              </p>

              <div className="flex flex-wrap gap-3">
                <Button onClick={() => navigate("/contact?offer=express")}>Validation express</Button>
                <Button
                  variant="outline"
                  className="border-white text-white hover:bg-white/10"
                  onClick={() => navigate("/login")}
                >
                  Connexion
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => navigate("/")}
                >
                  Tester gratuitement (30 sec)
                </Button>
              </div>

              <div className="text-xs text-white/70">
                Besoin d’un accompagnement ?{" "}
                <button
                  type="button"
                  className="underline hover:opacity-90"
                  onClick={() => navigate("/contact")}
                >
                  Parler à un expert
                </button>
                .
              </div>
            </div>

            <div className="rounded-2xl border border-white/15 bg-white/10 p-6 shadow-sm backdrop-blur-xl">
              <div className="text-xs uppercase tracking-[0.25em] text-blue-200">Bénéfices</div>
              <ul className="mt-4 space-y-2 text-sm text-slate-200">
                {benefits.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="opacity-70">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-6 rounded-xl border border-white/15 bg-white/5 p-4">
                <div className="text-xs uppercase tracking-[0.25em] text-slate-200">Pour qui ?</div>
                <div className="mt-3 space-y-3 text-sm text-slate-200">
                  {forWho.map((x) => (
                    <div key={x.label}>
                      <div className="font-semibold text-white">{x.label}</div>
                      <div className="text-slate-200">{x.text}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Cards */}
        <section className="grid gap-6 md:grid-cols-3">
          {solutions.map((s) => (
            <div
              key={s.title}
              className="rounded-2xl border border-white/15 bg-white/10 p-6 text-white shadow-sm backdrop-blur-xl"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold">{s.title}</div>
                <span className="rounded-full border border-white/20 bg-white/10 px-2 py-1 text-[11px] text-white/90">
                  {s.badge}
                </span>
              </div>

              <p className="mt-2 text-sm text-slate-200">{s.description}</p>

              <div className="mt-4">
                <Button
                  variant="outline"
                  className="w-full border-white text-white hover:bg-white/10"
                  onClick={() => s.action(navigate)}
                >
                  {s.cta}
                </Button>
              </div>
            </div>
          ))}
        </section>

        {/* CTA final */}
        <section className="force-white rounded-2xl border border-slate-200 bg-gradient-to-r from-blue-700 via-blue-900 to-red-600 p-6 text-white">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.25em] text-white/70">Prêt à sécuriser vos expéditions ?</div>
              <div className="text-2xl font-semibold">Demandez une validation express ou un audit complet.</div>
              <div className="mt-1 text-sm text-white/80">
                Pour éviter les blocages, surcoûts, retours ou risques conformité.
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button variant="secondary" onClick={() => navigate("/contact?offer=express")}>
                Validation express
              </Button>
              <Button
                variant="outline"
                className="border-white text-white hover:bg-white/10"
                onClick={() => navigate("/contact?offer=audit")}
              >
                Audit complet
              </Button>
            </div>
          </div>
        </section>
      </div>
    </PublicLayout>
  );
}
