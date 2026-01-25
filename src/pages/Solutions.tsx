import { useNavigate } from "react-router-dom";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/button";

const solutions = [
  {
    title: "Validation express",
    description: "Controle rapide HS, documents, taxes, sanctions avant expedition.",
  },
  {
    title: "Centre veille",
    description: "Alertes reglementaires et douane pour vos zones prioritaires.",
  },
  {
    title: "Control Tower",
    description: "Pilotage des flux export, risques et priorites marche.",
  },
];

const benefits = [
  "Gain de temps sur les checks export",
  "Vision claire des risques par pays/HS",
  "Rapports PDF prets a partager",
  "Alertes veille personnalisees",
];

export default function Solutions() {
  const navigate = useNavigate();

  return (
    <PublicLayout>
      <div className="space-y-10">
        <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4 text-white">
            <p className="text-xs uppercase tracking-[0.35em] text-blue-200">Solutions MPL Export</p>
            <h1 className="text-4xl font-semibold">La plateforme export premium, claire et actionnable.</h1>
            <p className="text-lg text-slate-200">
              Separer la vitrine et l'app, clarifier l'acquisition et offrir une experience SaaS coherente pour les equipes export.
            </p>
            <div className="flex gap-3">
              <Button onClick={() => navigate("/contact?offer=express")}>Validation express</Button>
              <Button variant="outline" className="border-white text-white hover:bg-white/10" onClick={() => navigate("/login")}
              >
                Connexion
              </Button>
            </div>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/10 p-6 text-white shadow-sm backdrop-blur-xl">
            <div className="text-xs uppercase tracking-[0.25em] text-blue-200">Benefices</div>
            <ul className="mt-4 space-y-2 text-sm text-slate-200">
              {benefits.map((item) => (
                <li key={item}>- {item}</li>
              ))}
            </ul>
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-3">
          {solutions.map((s) => (
            <div
              key={s.title}
              className="rounded-2xl border border-white/15 bg-white/10 p-6 text-white shadow-sm backdrop-blur-xl"
            >
              <div className="text-sm font-semibold">{s.title}</div>
              <p className="mt-2 text-sm text-slate-200">{s.description}</p>
            </div>
          ))}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-gradient-to-r from-blue-700 via-blue-900 to-red-600 p-6 text-white">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.25em] text-white/70">Pret a tester ?</div>
              <div className="text-2xl font-semibold">Demandez une validation express ou un audit complet.</div>
            </div>
            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => navigate("/contact?offer=express")}>Validation express</Button>
              <Button variant="outline" className="border-white text-white hover:bg-white/10" onClick={() => navigate("/contact")}
              >
                Parler a un expert
              </Button>
            </div>
          </div>
        </section>
      </div>
    </PublicLayout>
  );
}
