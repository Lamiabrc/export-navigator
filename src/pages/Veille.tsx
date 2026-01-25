import { useNavigate } from "react-router-dom";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/button";

const sections = [
  {
    title: "Reglementation",
    description: "Sanctions, documents requis et mises a jour douane par zone.",
  },
  {
    title: "Maritime",
    description: "Alertes transport, assurances et contraintes logistiques.",
  },
  {
    title: "Taxes & droits",
    description: "Impact des taxes additionnelles, TVA et droits specifiques.",
  },
];

export default function Veille() {
  const navigate = useNavigate();

  return (
    <PublicLayout>
      <div className="space-y-10">
        <section className="space-y-4">
          <p className="text-xs uppercase tracking-[0.35em] text-blue-200">Centre veille</p>
          <h1 className="text-4xl font-semibold text-white">Veille reglementaire premium, sans bruit.</h1>
          <p className="text-lg text-slate-200">
            Les alertes sont classees par gravite et zone pour gagner du temps. Accedez au centre veille apres connexion.
          </p>
          <div className="flex gap-3">
            <Button onClick={() => navigate("/app/centre-veille")}>Ouvrir le centre veille</Button>
            <Button
              variant="outline"
              className="border-white text-white hover:bg-white/10"
              onClick={() => navigate("/contact")}
            >
              Parler a un expert
            </Button>
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-3">
          {sections.map((s) => (
            <div
              key={s.title}
              className="rounded-2xl border border-white/15 bg-white/10 p-6 text-white shadow-lg backdrop-blur"
            >
              <div className="text-sm font-semibold">{s.title}</div>
              <p className="mt-2 text-sm text-slate-200">{s.description}</p>
            </div>
          ))}
        </section>
      </div>
    </PublicLayout>
  );
}
