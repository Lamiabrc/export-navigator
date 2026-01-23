import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/BrandLogo";

const audience = [
  "PME/ETI qui exportent ou veulent exporter",
  "ADV, Supply, Douane, Finance, Direction",
  "Entreprises exposees aux litiges, retards, surcouts",
];

const objectives = [
  "Fiabiliser les flux export",
  "Reduire les risques douane et conformite",
  "Maitriser les couts et incoterms",
  "Gagner en visibilite marche et concurrence",
];

const methodology = [
  "Cadrage (30-45 min) : perimetre, pays, enjeux",
  "Collecte : docs, expeditions, couts, process",
  "Analyse : risques, causes, priorites",
  "Restitution : plan d'action + outils",
];

export default function Welcome() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <div className="h-2 bg-gradient-to-r from-blue-600 via-white to-red-600" />
      <div className="absolute inset-x-0 top-0 h-[320px] bg-gradient-to-br from-white via-blue-50 to-red-50" />
      <div className="relative z-10 max-w-6xl mx-auto px-6 pt-10 pb-16 space-y-16">
        <header className="flex items-center justify-between">
          <BrandLogo
            className="flex items-center gap-3"
            imageClassName="h-9"
            titleClassName="text-sm font-semibold uppercase tracking-[0.2em] text-slate-900"
            subtitleClassName="text-xs text-slate-500"
          />
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => navigate("/login")}>
              Se connecter
            </Button>
            <Button onClick={() => navigate("/register")}>Creer un compte</Button>
          </div>
        </header>

        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-10 items-start"
        >
          <div className="space-y-6">
            <div className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-4 py-1 text-xs uppercase tracking-[0.35em] text-blue-700">
              Offre de services MPL Conseil Export
            </div>
            <h1 className="text-4xl md:text-5xl font-semibold leading-tight text-slate-900">
              Conseil et securisation des operations Export
            </h1>
            <p className="text-lg text-slate-600 leading-relaxed">
              Un accompagnement clair et methodique pour exporter depuis la France en toute conformite,
              avec des couts maitrises et une vision marche solide.
            </p>

            <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600">
              <span className="font-semibold text-slate-900">Rendez-vous gratuit (20-30 min)</span>
              <a className="text-slate-900 hover:underline" href="tel:+33676435551">
                06 76 43 55 51
              </a>
              <span className="text-slate-400">Email: lamia.brechet@outlook.fr</span>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">A qui s'adresse MPL Conseil Export ?</h3>
              <ul className="mt-3 space-y-2 text-sm text-slate-600">
                {audience.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Objectifs</h3>
              <ul className="mt-3 space-y-2 text-sm text-slate-600">
                {objectives.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </motion.section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">Prestations principales</h3>
            <div className="mt-4 grid grid-cols-1 gap-4 text-sm text-slate-600">
              <div>
                <div className="font-semibold text-slate-900">Verification des flux Export</div>
                <div>Cartographie du flux, controle documents, incoterms, checklist zero oubli.</div>
              </div>
              <div>
                <div className="font-semibold text-slate-900">Veille reglementaire Export</div>
                <div>Alertes, sanctions, exigences documentaires, mise a jour des process.</div>
              </div>
              <div>
                <div className="font-semibold text-slate-900">Optimisation des couts</div>
                <div>Analyse transport, assurances, ecarts de facturation, quick wins.</div>
              </div>
              <div>
                <div className="font-semibold text-slate-900">Etude concurrentielle</div>
                <div>Benchmark, positionnement, opportunites pays et segments.</div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">Formules et tarifs (a partir de)</h3>
            <div className="mt-4 space-y-4 text-sm text-slate-600">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="font-semibold text-slate-900">Pack Diagnostic Flash (1-2 jours)</div>
                  <div>Entretien + revue rapide + 10 actions immediates</div>
                </div>
                <div className="font-semibold text-slate-900">650 EUR HT</div>
              </div>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="font-semibold text-slate-900">Pack Audit Complet (3-7 jours)</div>
                  <div>Cartographie + controle + plan d'action complet</div>
                </div>
                <div className="font-semibold text-slate-900">1 950 EUR HT</div>
              </div>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="font-semibold text-slate-900">Pilotage & Veille (mensuel)</div>
                  <div>Veille + point mensuel + mise a jour checklists</div>
                </div>
                <div className="font-semibold text-slate-900">290 EUR HT / mois</div>
              </div>
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                Options : optimisation couts, etude concurrentielle, kit export, TJM 450-650 EUR HT/jour.
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">Methodologie</h3>
          <ol className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-slate-600">
            {methodology.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="text-sm text-slate-600">
            MPL Conseil Export - Lamia Brechet - Email: lamia.brechet@outlook.fr - Telephone: 06 76 43 55 51
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => navigate("/login")}>
              Se connecter
            </Button>
            <Button onClick={() => navigate("/register")}>Creer un compte</Button>
          </div>
        </section>
      </div>
    </div>
  );
}
