import { useNavigate } from "react-router-dom";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/button";

const tiers = [
  {
    name: "Essentiel",
    price: "149 EUR / mois",
    items: ["Validation express", "Rapports PDF", "Centre veille standard"],
  },
  {
    name: "Equipe",
    price: "390 EUR / mois",
    items: ["Control Tower", "Veille avancee", "Assistance prioritaire"],
  },
  {
    name: "Enterprise",
    price: "Sur devis",
    items: ["Connecteurs sur mesure", "SLA", "Accompagnement audit"],
  },
];

export default function Tarifs() {
  const navigate = useNavigate();

  return (
    <PublicLayout>
      <div className="space-y-10">
        <section className="space-y-4">
          <p className="text-xs uppercase tracking-[0.35em] text-blue-700">Tarifs</p>
          <h1 className="text-4xl font-semibold text-slate-900">Des offres claires, sans surprise.</h1>
          <p className="text-lg text-slate-600">
            Choisis le plan qui correspond a ton volume d'export et a tes besoins de veille.
          </p>
        </section>

        <section className="grid gap-6 md:grid-cols-3">
          {tiers.map((tier) => (
            <div key={tier.name} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="text-sm uppercase tracking-[0.2em] text-slate-400">{tier.name}</div>
              <div className="mt-2 text-2xl font-semibold">{tier.price}</div>
              <ul className="mt-4 space-y-2 text-sm text-slate-600">
                {tier.items.map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
              <Button className="mt-6 w-full" onClick={() => navigate("/contact?offer=pricing")}>
                Demander une offre
              </Button>
            </div>
          ))}
        </section>
      </div>
    </PublicLayout>
  );
}
