import * as React from "react";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase, SUPABASE_ENV_OK } from "@/integrations/supabase/client";
import { isMissingTableError } from "@/domain/calc/validators";

const steps = [
  "Verifier VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY",
  "Executer la migration SQL 000_init_mpl.sql",
  "Lancer le seed demo pour alimenter les ecrans",
  "Verifier Control Tower + Centre veille + Produits",
];

const REQUIRED_TABLES = ["products", "regulatory_feeds", "regulatory_items", "alerts", "leads", "simulations"];

type Status = "unknown" | "ok" | "missing" | "unavailable";

export default function Resources() {
  const { toast } = useToast();
  const [status, setStatus] = React.useState<Status>("unknown");
  const [missing, setMissing] = React.useState<string[]>([]);
  const [checking, setChecking] = React.useState(false);

  React.useEffect(() => {
    const flag = localStorage.getItem("mpl_db_initialized");
    if (flag === "true") setStatus("ok");
  }, []);

  const checkDatabase = async () => {
    if (!SUPABASE_ENV_OK) {
      setStatus("unavailable");
      setMissing([]);
      toast({ title: "Mode demo", description: "Connexion base indisponible. Configure Supabase pour activer la base." });
      return;
    }

    setChecking(true);
    setMissing([]);
    try {
      const missingTables: string[] = [];
      for (const table of REQUIRED_TABLES) {
        const { error } = await supabase.from(table).select("id", { head: true, count: "exact" }).limit(1);
        if (error) {
          if (isMissingTableError(error)) {
            missingTables.push(table);
            continue;
          }
          throw error;
        }
      }

      if (missingTables.length) {
        setStatus("missing");
        setMissing(missingTables);
        localStorage.setItem("mpl_db_initialized", "false");
        toast({
          title: "Tables manquantes",
          description: `Il manque: ${missingTables.join(", ")}`,
        });
        return;
      }

      setStatus("ok");
      setMissing([]);
      localStorage.setItem("mpl_db_initialized", "true");
      toast({ title: "Base initialisee", description: "Toutes les tables minimales sont presentes." });
    } catch (err: any) {
      setStatus("missing");
      localStorage.setItem("mpl_db_initialized", "false");
      toast({ title: "Verification impossible", description: "Impossible de verifier la base pour le moment." });
    } finally {
      setChecking(false);
    }
  };

  return (
    <PublicLayout>
      <div className="space-y-8">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-blue-700">Ressources</p>
          <h1 className="text-4xl font-semibold text-slate-900">Guides et documentation</h1>
          <p className="text-lg text-slate-600">
            Les ressources pour initialiser Supabase, activer le mode demo et garder une base propre.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <div>
            <div className="text-sm font-semibold">Migration Supabase</div>
            <p className="mt-2 text-sm text-slate-600">
              Le fichier SQL est fourni dans <code className="rounded bg-slate-100 px-2 py-0.5">supabase/migrations/000_init_mpl.sql</code>.
              Il cree les tables minimales et insere des donnees demo.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={checkDatabase} disabled={checking}>
              {checking ? "Verification..." : "Verifier la base"}
            </Button>
            {status === "ok" ? (
              <span className="text-sm text-emerald-600 font-semibold">Base initialisee</span>
            ) : null}
            {status === "missing" && missing.length ? (
              <span className="text-sm text-amber-700">Tables manquantes: {missing.join(", ")}</span>
            ) : null}
            {status === "unavailable" ? (
              <span className="text-sm text-slate-500">Connexion base indisponible</span>
            ) : null}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
          <div className="text-sm font-semibold">Checklist d'initialisation</div>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            {steps.map((item) => (
              <li key={item}>- {item}</li>
            ))}
          </ul>
        </div>
      </div>
    </PublicLayout>
  );
}
