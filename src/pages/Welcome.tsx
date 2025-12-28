import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";

export default function Welcome() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen relative overflow-hidden bg-slate-950 text-slate-50">
      <div className="absolute inset-0">
        <img
          src="/assets/drom-hero.jpg"
          alt="DROM hero"
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/50 to-slate-950/80" />
      </div>

      <div className="absolute top-6 inset-x-0 flex justify-center">
        <div className="flex items-center gap-3 px-6 py-2 rounded-full bg-white/10 backdrop-blur-lg border border-white/15 shadow-2xl">
          <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center text-white font-semibold">
            OR
          </div>
          <span className="text-sm uppercase tracking-[0.25em] text-slate-100">Export Navigator</span>
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
            <p className="text-lg text-slate-200/80 leading-relaxed">
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
              className="flex items-center gap-4"
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
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
