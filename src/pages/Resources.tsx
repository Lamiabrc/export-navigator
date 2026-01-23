import { PublicLayout } from "@/components/layout/PublicLayout";

const steps = [
  "Verifier VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY",
  "Executer la migration SQL 000_init_mpl.sql",
  "Lancer le seed demo pour alimenter les ecrans",
  "Verifier Control Tower + Centre veille + Produits",
];

export default function Resources() {
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

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="text-sm font-semibold">Migration Supabase</div>
          <p className="mt-2 text-sm text-slate-600">
            Le fichier SQL est fourni dans <code className="rounded bg-slate-100 px-2 py-0.5">supabase/migrations/000_init_mpl.sql</code>.
            Il cree les tables minimales et insere des donnees demo.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
          <div className="text-sm font-semibold">Checklist d'initialisation</div>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            {steps.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        </div>
      </div>
    </PublicLayout>
  );
}
