import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/BrandLogo";
import worldMap from "@/assets/world-map.svg";

export default function Welcome() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen relative overflow-hidden bg-slate-950 text-slate-50">
      <div className="absolute inset-0">
        <img
          src="/assets/drom-hero.jpg"
          alt="MPL Conseil Export"
          className="h-full w-full object-cover"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = "/assets/drom-hero.jpg";
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/55 to-slate-950/90" />
        <img
          src={worldMap}
          alt="Carte du monde"
          className="absolute inset-0 h-full w-full object-cover opacity-25 mix-blend-screen pointer-events-none"
        />
      </div>

      <div className="absolute top-6 inset-x-0 flex justify-center">
        <div className="flex items-center gap-3 px-6 py-2 rounded-full bg-white/10 backdrop-blur-lg border border-white/15 shadow-2xl">
          <BrandLogo
            className="text-white"
            titleClassName="text-sm font-semibold text-white uppercase tracking-[0.2em]"
            subtitleClassName="text-[11px] text-white/80"
            imageClassName="h-8 drop-shadow-lg"
          />
        </div>
      </div>

      <div className="relative z-10 flex min-h-screen items-center">
        <div className="max-w-6xl mx-auto px-6 py-16 space-y-10">
          <div className="max-w-4xl space-y-4">
            <p className="text-sm uppercase tracking-[0.35em] text-amber-200 font-semibold">
              Offre de services MPL Conseil Export
            </p>
            <h1 className="text-4xl md:text-5xl font-bold leading-tight text-white drop-shadow-xl">
              Conseil et securisation des operations Export
            </h1>
            <p className="text-lg text-slate-200/85 leading-relaxed">
              Verification des flux, veille reglementaire, optimisation des couts, etude concurrentielle.
              Un accompagnement concret pour exporter depuis la France vers tous les pays.
            </p>
          </div>

          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className="flex items-center gap-4 flex-wrap"
            >
              <Button
                size="lg"
                className="h-12 px-6 text-base font-semibold shadow-lg shadow-amber-500/30"
                onClick={() => navigate("/register")}
              >
                Creer un compte
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-12 px-6 text-base font-semibold border-white/20 text-white"
                onClick={() => navigate("/login")}
              >
                Se connecter
              </Button>
              <a
                className="text-sm text-slate-200/80 hover:underline"
                href="tel:+33676435551"
              >
                Rendez-vous gratuit: 06 76 43 55 51
              </a>
            </motion.div>
          </AnimatePresence>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-white/15 bg-white/5 px-5 py-4">
              <h3 className="text-sm font-semibold text-white">A qui s'adresse MPL Conseil Export ?</h3>
              <ul className="mt-2 text-sm text-slate-200/75 space-y-1">
                <li>PME/ETI qui exportent ou veulent exporter</li>
                <li>ADV, Supply, Douane, Finance, Direction</li>
                <li>Entreprises exposees aux litiges, retards, surcouts</li>
              </ul>
            </div>

            <div className="rounded-2xl border border-white/15 bg-white/5 px-5 py-4">
              <h3 className="text-sm font-semibold text-white">Objectifs</h3>
              <ul className="mt-2 text-sm text-slate-200/75 space-y-1">
                <li>Fiabiliser les flux export</li>
                <li>Reduire les risques douane et conformite</li>
                <li>Maitriser les couts et incoterms</li>
                <li>Gagner en visibilite marche et concurrence</li>
              </ul>
            </div>

            <div className="rounded-2xl border border-white/15 bg-white/5 px-5 py-4">
              <h3 className="text-sm font-semibold text-white">Methodologie</h3>
              <ul className="mt-2 text-sm text-slate-200/75 space-y-1">
                <li>Cadrage (30-45 min)</li>
                <li>Collecte docs et exemples</li>
                <li>Analyse risques et priorites</li>
                <li>Restitution + outils pratiques</li>
              </ul>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-white/15 bg-white/5 px-5 py-4">
              <h3 className="text-sm font-semibold text-white">Prestations principales</h3>
              <div className="mt-3 space-y-3 text-sm text-slate-200/80">
                <div>
                  <div className="font-semibold text-white">Verification des flux Export</div>
                  <div>Cartographie du flux, controle documents, incoterms, checklist zero oubli.</div>
                </div>
                <div>
                  <div className="font-semibold text-white">Veille reglementaire Export</div>
                  <div>Alertes, sanctions, exigences documentaires, mise a jour des process.</div>
                </div>
                <div>
                  <div className="font-semibold text-white">Verification et optimisation des couts</div>
                  <div>Analyse transport, assurances, ecarts de facturation, quick wins.</div>
                </div>
                <div>
                  <div className="font-semibold text-white">Etude concurrentielle Export</div>
                  <div>Benchmark, positionnement, opportunites pays et segments.</div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/15 bg-white/5 px-5 py-4">
              <h3 className="text-sm font-semibold text-white">Formules et tarifs (a partir de)</h3>
              <div className="mt-3 space-y-3 text-sm text-slate-200/80">
                <div>
                  <div className="font-semibold text-white">Pack Diagnostic Flash (1-2 jours)</div>
                  <div>A partir de 650 EUR HT</div>
                </div>
                <div>
                  <div className="font-semibold text-white">Pack Audit Complet (3-7 jours)</div>
                  <div>A partir de 1 950 EUR HT</div>
                </div>
                <div>
                  <div className="font-semibold text-white">Pilotage & Veille (mensuel)</div>
                  <div>A partir de 290 EUR HT / mois</div>
                </div>
                <div>
                  <div className="font-semibold text-white">Options</div>
                  <div>Optimisation couts, etude concurrentielle, kit export, TJM 450-650 EUR HT/jour.</div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/15 bg-white/5 px-5 py-4">
            <h3 className="text-sm font-semibold text-white">Prochaine etape</h3>
            <p className="mt-2 text-sm text-slate-200/80">
              Rendez-vous de cadrage gratuit (20-30 min) pour confirmer le perimetre et etablir un devis ferme.
            </p>
            <div className="mt-3 text-sm text-slate-200/80">
              MPL Conseil Export - Lamia Brechet - Email: [ton email] - Telephone: 06 76 43 55 51
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
