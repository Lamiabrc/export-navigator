import * as React from "react";
import { useNavigate } from "react-router-dom";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { postLead, postPdf } from "@/lib/leadMagnetApi";
import { useToast } from "@/hooks/use-toast";

const GUIDES = [
  {
    title: "Guide export 2025",
    description: "Les etapes pour exporter sans blocage: HS, incoterms, documents et TVA.",
    tag: "Basics",
    action: "Lire",
  },
  {
    title: "Incoterms en pratique",
    description: "Choisir le bon incoterm selon le pays, le risque et la responsabilite.",
    tag: "Incoterms",
    action: "Lire",
  },
  {
    title: "Controle des sanctions",
    description: "Verifier les restrictions et signaux sensibles avant expédition.",
    tag: "Sanctions",
    action: "Lire",
  },
  {
    title: "TVA & droits",
    description: "Comprendre les droits de douane, TVA a l'import et regles locales.",
    tag: "Taxes",
    action: "Lire",
  },
];

const TEMPLATES = [
  {
    title: "Checklist export",
    description: "Checklist operationnelle pour ne rien oublier avant l'expedition.",
    tag: "Documents",
    action: "Telecharger",
  },
  {
    title: "Facture commerciale",
    description: "Modele de facture commerciale conforme (avec mentions critiques).",
    tag: "Facturation",
    action: "Telecharger",
  },
  {
    title: "Packing list",
    description: "Modele de packing list pour faciliter le dedouanement.",
    tag: "Logistique",
    action: "Telecharger",
  },
];

const OFFICIAL_LINKS = [
  {
    title: "EU TARIC",
    description: "Base officielle des droits de douane et restrictions UE.",
    tag: "Douanes",
    action: "Lire",
  },
  {
    title: "OFAC Sanctions",
    description: "Sanctions US a jour et listes de personnes/entites.",
    tag: "Sanctions",
    action: "Lire",
  },
  {
    title: "ICC Incoterms",
    description: "Reference officielle ICC sur les incoterms.",
    tag: "Incoterms",
    action: "Lire",
  },
  {
    title: "UN Comtrade",
    description: "Statistiques douanieres mondiales par HS.",
    tag: "Data",
    action: "Lire",
  },
];

export default function Resources() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [email, setEmail] = React.useState("");
  const [consent, setConsent] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  const requestKit = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      toast({ title: "Email requis", description: "Ajoute un email pour recevoir le kit." });
      return;
    }
    if (!consent) {
      toast({ title: "Consentement requis", description: "Coche la case RGPD pour continuer." });
      return;
    }

    try {
      setLoading(true);
      await postLead({
        email: trimmedEmail,
        consent: true,
        metadata: { source: "resources_kit" },
      });

      const pdfBlob = await postPdf({
        title: "Kit Export - Checklist & Modeles",
        email: trimmedEmail,
      });
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `mpl-kit-export-${Date.now()}.pdf`;
      link.click();
      URL.revokeObjectURL(url);

      toast({ title: "Kit envoye", description: "Le kit export est telecharge." });
    } catch (err: any) {
      toast({ title: "Erreur", description: err?.message || "Impossible de generer le kit." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <PublicLayout>
      <div className="mx-auto max-w-6xl space-y-10">
        <div className="space-y-3 text-white">
          <p className="text-xs uppercase tracking-[0.35em] text-blue-200">Centre de ressources</p>
          <h1 className="text-4xl font-semibold">Ressources Export Premium</h1>
          <p className="text-lg text-slate-200">
            Guides, modeles et liens officiels pour securiser chaque expédition.
          </p>
          <div>
            <Button onClick={() => navigate("/contact?offer=express")}>Validation express</Button>
          </div>
        </div>

        <Card className="border border-white/15 bg-white/10 text-white shadow-2xl backdrop-blur-xl">
          <CardContent className="space-y-5 p-7 md:p-8">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.25em] text-blue-200">Kit export</div>
                <div className="text-2xl font-semibold">Telecharger le Kit Export (PDF)</div>
                <p className="text-sm text-slate-200">
                  Checklist complete + modeles indispensables (facture commerciale, packing list, incoterms).
                </p>
              </div>
              <div className="text-xs text-white/70">Gratuit, reserve aux exportateurs.</div>
            </div>

            <div className="grid gap-3 md:grid-cols-[1.2fr_1fr]">
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email professionnel"
                className="border-white/20 bg-white/90 text-slate-900 placeholder:text-slate-500"
              />
              <Button onClick={requestKit} disabled={loading}>
                {loading ? "Generation..." : "Recevoir le kit"}
              </Button>
            </div>
            <label className="flex items-start gap-2 text-xs text-slate-200">
              <Checkbox checked={consent} onCheckedChange={(v) => setConsent(Boolean(v))} />
              <span>J'accepte de recevoir la veille MPL (RGPD).</span>
            </label>
          </CardContent>
        </Card>

        <section className="grid gap-6 md:grid-cols-2">
          <Card className="border border-white/15 bg-white/10 text-white backdrop-blur-xl">
            <CardContent className="space-y-4 p-6">
              <div className="text-lg font-semibold">Guides</div>
              <div className="space-y-3">
                {GUIDES.map((item) => (
                  <div key={item.title} className="rounded-xl border border-white/15 bg-white/5 p-4">
                    <div className="text-xs uppercase text-blue-200">{item.tag}</div>
                    <div className="text-base font-semibold">{item.title}</div>
                    <div className="text-sm text-slate-200">{item.description}</div>
                    <Button size="sm" variant="outline" className="mt-3 border-white text-white hover:bg-white/10">
                      {item.action}
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border border-white/15 bg-white/10 text-white backdrop-blur-xl">
            <CardContent className="space-y-4 p-6">
              <div className="text-lg font-semibold">Modeles</div>
              <div className="space-y-3">
                {TEMPLATES.map((item) => (
                  <div key={item.title} className="rounded-xl border border-white/15 bg-white/5 p-4">
                    <div className="text-xs uppercase text-blue-200">{item.tag}</div>
                    <div className="text-base font-semibold">{item.title}</div>
                    <div className="text-sm text-slate-200">{item.description}</div>
                    <Button size="sm" variant="outline" className="mt-3 border-white text-white hover:bg-white/10">
                      {item.action}
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>

        <Card className="border border-white/15 bg-white/10 text-white backdrop-blur-xl">
          <CardContent className="space-y-4 p-6">
            <div className="text-lg font-semibold">Liens officiels</div>
            <div className="grid gap-4 md:grid-cols-2">
              {OFFICIAL_LINKS.map((item) => (
                <div key={item.title} className="rounded-xl border border-white/15 bg-white/5 p-4">
                  <div className="text-xs uppercase text-blue-200">{item.tag}</div>
                  <div className="text-base font-semibold">{item.title}</div>
                  <div className="text-sm text-slate-200">{item.description}</div>
                  <Button size="sm" variant="outline" className="mt-3 border-white text-white hover:bg-white/10">
                    {item.action}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </PublicLayout>
  );
}
