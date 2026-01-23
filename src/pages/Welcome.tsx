import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/BrandLogo";

const bullets = [
  "Verification des flux export (documents, incoterms, preuves).",
  "Veille reglementaire et alertes ciblées par pays.",
  "Optimisation des couts logistiques et fiscaux.",
  "Etude concurrentielle et opportunites de marche.",
];

export default function Welcome() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="absolute inset-x-0 top-0 h-[380px] bg-gradient-to-br from-amber-50 via-white to-cyan-50" />
      <div className="absolute inset-x-0 top-0 h-[380px] opacity-50">
        <div className="h-full w-full bg-[radial-gradient(circle_at_20%_30%,rgba(251,146,60,0.12),transparent_45%),radial-gradient(circle_at_80%_20%,rgba(56,189,248,0.16),transparent_40%)]" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-6 pt-10 pb-16 space-y-14">
        <div className="flex items-center justify-between">
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
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-10 items-start"
        >
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-1 text-xs uppercase tracking-[0.35em] text-amber-700">
              Offre de services MPL Conseil Export
            </div>
            <h1 className="text-4xl md:text-5xl font-semibold leading-tight text-slate-900">
              Conseil et securisation des operations Export
            </h1>
            <p className="text-lg text-slate-600 leading-relaxed">
              Un accompagnement clair et methodique pour les PME/ETI qui veulent exporter depuis la France
              en toute conformite, avec des couts maitrisés et une vision marché solide.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {bullets.map((item) => (
                <div key={item} className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm">
                  {item}
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600">
              <span className="font-semibold text-slate-900">Rendez-vous gratuit (20-30 min)</span>
              <a className="text-slate-900 hover:underline" href="tel:+33676435551">
                06 76 43 55 51
              </a>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">A qui s'adresse MPL Conseil Export ?</h3>
              <ul className="mt-3 space-y-2 text-sm text-slate-600">
                <li>PME/ETI qui exportent ou veulent exporter</li>
                <li>ADV, Supply, Douane, Finance, Direction</li>
                <li>Entreprises exposees aux litiges, retards, surcouts</li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-slate-900">Objectifs</h3>
              <ul className="mt-3 space-y-2 text-sm text-slate-600">
                <li>Fiabiliser les flux export</li>
                <li>Reduire les risques douane et conformite</li>
                <li>Maitriser les couts et incoterms</li>
                <li>Gagner en visibilite marche et concurrence</li>
              </ul>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">Prestations principales</h3>
            <div className="mt-4 space-y-4 text-sm text-slate-600">
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
              <div>
                <div className="font-semibold text-slate-900">Pack Diagnostic Flash (1-2 jours)</div>
                <div>A partir de 650 EUR HT</div>
              </div>
              <div>
                <div className="font-semibold text-slate-900">Pack Audit Complet (3-7 jours)</div>
                <div>A partir de 1 950 EUR HT</div>
              </div>
              <div>
                <div className="font-semibold text-slate-900">Pilotage & Veille (mensuel)</div>
                <div>A partir de 290 EUR HT / mois</div>
              </div>
              <div>
                <div className="font-semibold text-slate-900">Options</div>
                <div>Optimisation couts, etude concurrentielle, kit export, TJM 450-650 EUR HT/jour.</div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">Methodologie</h3>
            <ol className="mt-4 space-y-3 text-sm text-slate-600">
              <li>1. Cadrage (30-45 min) : perimetre, pays, enjeux</li>
              <li>2. Collecte : docs, expeditions, couts, process</li>
              <li>3. Analyse : risques, causes, priorites</li>
              <li>4. Restitution : plan d'action + outils</li>
            </ol>
            <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Prochaine etape : rendez-vous de cadrage gratuit pour definir la formule.
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="text-sm text-slate-600">
            MPL Conseil Export - Lamia Brechet - Email: [ton email] - Telephone: 06 76 43 55 51
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => navigate("/login")}>
              Se connecter
            </Button>
            <Button onClick={() => navigate("/register")}>Creer un compte</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
