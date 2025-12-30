import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/BrandLogo";

export default function Welcome() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen relative overflow-hidden bg-slate-950 text-slate-50">
      <div className="absolute inset-0">
        <img
          src="/assets/orliman-beach.jpg"
          alt="Clinique Orliman en bord de plage"
          className="h-full w-full object-cover"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = "/assets/drom-hero.jpg";
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/55 to-slate-950/85" />
      </div>

      <div className="absolute top-6 inset-x-0 flex justify-center px-4">
        <div className="flex items-center gap-3 px-6 py-2 rounded-full bg-black/30 backdrop-blur-lg border border-white/20 shadow-2xl">
          <BrandLogo
            className="text-white"
            textClassName="leading-tight min-w-0"
            titleClassName="text-sm font-semibold text-white uppercase tracking-[0.2em]"
            subtitleClassName="text-xs text-white/80"
            locationClassName="text-[11px] text-white/70"
            imageClassName="h-8 drop-shadow-lg"
          />
        </div>
      </div>

      <div className="relative z-10 flex min-h-screen items-center">
        <div className="max-w-5xl mx-auto px-6 py-16 space-y-10">
          <div className="max-w-3xl space-y-4">
            <p className="text-sm uppercase tracking-[0.35em] text-cyan-200 font-semibold">
              Veille & Contrôle Facture Export
            </p>
            <h1 className="text-4xl md:text-5xl font-bold leading-tight text-white drop-shadow-xl">
              Bienvenue dans l’outil Orliman de suivi et de stratégie Export DROM
            </h1>
            <p className="text-lg text-slate-200/85 leading-relaxed">
              Contrôlez vos factures, calculez la marge réelle (HT + transport + OM/OMR par HS),
              surveillez la réglementation export et la concurrence, et accédez à l’IA spécialiste Export/DROM.
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
                className="h-12 px-6 text-base font-semibold shadow-lg shadow-cyan-500/30"
                onClick={() => navigate("/login")}
              >
                Se connecter
              </Button>
              <div className="text-sm text-slate-200/70">
                Accès sécurisé • Données Supabase • Aucune clé IA dans le front
              </div>
            </motion.div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-3xl pt-4">
              {[
                { label: "Contrôle facture", value: "OM/OMR + marge HT" },
                { label: "Veille export", value: "Reg, concurrents, prix" },
                { label: "IA Export", value: "Edge Function sécurisée" },
              ].map((item) => (
                <div key={item.label} className="rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm">
                  <p className="text-slate-200 font-semibold">{item.label}</p>
                  <p className="text-slate-200/70">{item.value}</p>
                </div>
              ))}
            </div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
