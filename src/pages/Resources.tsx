import * as React from "react";
import { Link } from "react-router-dom";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { postLead, postPdf } from "@/lib/leadMagnetApi";
import { useToast } from "@/hooks/use-toast";

const GUIDES = [
  {
    title: "Incoterm DDP",
    description: "Coûts, risques et points de vigilance avant expédition.",
    tag: "Incoterms",
    action: "Lire",
    href: "/guides/incoterms-ddp",
  },
  {
    title: "TVA a l'import",
    description: "Impact cash, regimes et points a documenter.",
    tag: "Taxes",
    action: "Lire",
    href: "/guides/tva-import",
  },
  {
    title: "Documents export",
    description: "Checklist essentielle avant envoi.",
    tag: "Documents",
    action: "Lire",
    href: "/guides/documents-export",
  },
  {
    title: "Export control",
    description: "Sanctions, embargos, dual-use et alertes utiles.",
    tag: "Conformite",
    action: "Lire",
    href: "/guides/export-control",
  },
];

const TEMPLATES = [
  {
    title: "Checklist export",
    description: "Pour ne rien oublier avant l'expedition.",
    tag: "Documents",
    action: "Recevoir le kit",
  },
  {
    title: "Facture commerciale",
    description: "Modele conforme avec mentions critiques.",
    tag: "Facturation",
    action: "Recevoir le kit",
  },
  {
    title: "Packing list",
    description: "Modele simple pour faciliter le dedouanement.",
    tag: "Logistique",
    action: "Recevoir le kit",
  },
];

const OFFICIAL_LINKS = [
  {
    title: "EU TARIC",
    description: "Base officielle des droits de douane et restrictions UE.",
    tag: "Douanes",
    action: "Ouvrir",
    href: "https://ec.europa.eu/taxation_customs/dds2/taric/taric_consultation.jsp?Lang=fr",
  },
  {
    title: "OFAC Sanctions",
    description: "Listes US a jour et programmes de sanctions.",
    tag: "Sanctions",
    action: "Ouvrir",
    href: "https://home.treasury.gov/policy-issues/financial-sanctions/sanctions-programs-and-country-information",
  },
  {
    title: "ICC Incoterms",
    description: "Reference officielle ICC sur les Incoterms 2020.",
    tag: "Incoterms",
    action: "Ouvrir",
    href: "https://iccwbo.org/resources-for-business/incoterms-rules/incoterms-2020/",
  },
  {
    title: "UN Comtrade",
    description: "Statistiques douanieres mondiales par HS.",
    tag: "Data",
    action: "Ouvrir",
    href: "https://comtradeplus.un.org/",
  },
];

export default function Resources() {
  const { toast } = useToast();
  const [email, setEmail] = React.useState("");
  const [consent, setConsent] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const kitRef = React.useRef<HTMLDivElement | null>(null);

  const scrollToKit = () => {
    kitRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

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

        toast({ title: "Kit envoyé", description: "Le kit export est téléchargé." });
      } catch (err: any) {
        toast({ title: "Erreur", description: err?.message || "Impossible de générer le kit." });
      } finally {
        setLoading(false);
    }
  };

  return (
    <PublicLayout>
      <div className="mx-auto max-w-6xl space-y-10">
        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl border border-border bg-gradient-to-br from-blue-50 via-white to-slate-50 p-6 shadow-sm">
            <p className="text-xs tracking-[0.2em] font-semibold text-blue-700">Centre de ressources</p>
            <h1 className="mt-2 text-3xl font-semibold font-display text-slate-900">
              Guides, modeles et liens officiels pour exporter sans friction.
            </h1>
            <p className="mt-3 text-sm text-slate-600">
              Un kit clair pour securiser HS, Incoterms, documents et TVA. Simple, actionnable, a jour.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button asChild>
                <Link to="/guides/incoterms-ddp">Voir les guides</Link>
              </Button>
              <Button variant="outline" onClick={scrollToKit}>
                Telecharger le kit
              </Button>
              <Button asChild variant="secondary">
                <Link to="/contact?offer=express">Validation express</Link>
              </Button>
            </div>
          </div>

          <div ref={kitRef}>
            <Card className="border border-border shadow-sm">
              <CardHeader>
              <CardTitle>Kit export PDF</CardTitle>
              <CardDescription>Checklist + modeles indispensables en un seul PDF.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email professionnel"
              />
              <label className="flex items-start gap-2 text-xs text-muted-foreground">
                <Checkbox checked={consent} onCheckedChange={(v) => setConsent(Boolean(v))} />
                <span>J'accepte de recevoir les emails MPL (RGPD).</span>
              </label>
              <Button onClick={requestKit} disabled={loading} className="w-full">
                {loading ? "Génération..." : "Recevoir le kit"}
              </Button>
              <div className="text-xs text-muted-foreground">
                Gratuit. Ideal pour demarrer rapidement.
              </div>
            </CardContent>
            </Card>
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-2">
          <Card className="border border-border">
            <CardHeader>
              <CardTitle>Guides</CardTitle>
              <CardDescription>Lecture rapide, cas d'usage et erreurs classiques.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {GUIDES.map((item) => (
                <div key={item.title} className="rounded-xl border border-border bg-card p-4">
                  <div className="text-xs tracking-[0.2em] font-semibold text-blue-700">{item.tag}</div>
                  <div className="text-base font-semibold">{item.title}</div>
                  <div className="text-sm text-muted-foreground">{item.description}</div>
                  <Button asChild size="sm" variant="outline" className="mt-3">
                    <Link to={item.href}>{item.action}</Link>
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border border-border">
            <CardHeader>
              <CardTitle>Modeles</CardTitle>
              <CardDescription>Acces via le kit PDF (checklist + documents).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {TEMPLATES.map((item) => (
                <div key={item.title} className="rounded-xl border border-border bg-card p-4">
                  <div className="text-xs tracking-[0.2em] font-semibold text-blue-700">{item.tag}</div>
                  <div className="text-base font-semibold">{item.title}</div>
                  <div className="text-sm text-muted-foreground">{item.description}</div>
                  <Button size="sm" variant="outline" className="mt-3" onClick={scrollToKit}>
                    {item.action}
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <Card className="border border-border">
          <CardHeader>
            <CardTitle>Liens officiels</CardTitle>
            <CardDescription>Sources fiables pour verifier droits, sanctions et references.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {OFFICIAL_LINKS.map((item) => (
              <div key={item.title} className="rounded-xl border border-border bg-card p-4">
                <div className="text-xs tracking-[0.2em] font-semibold text-blue-700">{item.tag}</div>
                <div className="text-base font-semibold">{item.title}</div>
                <div className="text-sm text-muted-foreground">{item.description}</div>
                <Button asChild size="sm" variant="outline" className="mt-3">
                  <a href={item.href} target="_blank" rel="noreferrer">
                    {item.action}
                  </a>
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </PublicLayout>
  );
}
