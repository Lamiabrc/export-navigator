import * as React from "react";
import { Link, useNavigate } from "react-router-dom";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, Lock, Sparkles } from "lucide-react";

const COUNTRIES = [
  { code: "FR", name: "France" },
  { code: "DE", name: "Allemagne" },
  { code: "ES", name: "Espagne" },
  { code: "IT", name: "Italie" },
  { code: "BE", name: "Belgique" },
  { code: "NL", name: "Pays-Bas" },
  { code: "CH", name: "Suisse" },
  { code: "GB", name: "Royaume-Uni" },
  { code: "US", name: "États-Unis" },
  { code: "CA", name: "Canada" },
  { code: "MA", name: "Maroc" },
  { code: "DZ", name: "Algérie" },
  { code: "TN", name: "Tunisie" },
  { code: "TR", name: "Turquie" },
  { code: "CN", name: "Chine" },
  { code: "IN", name: "Inde" },
  { code: "AE", name: "Émirats arabes unis" },
];

const INCOTERMS = ["EXW", "FCA", "FOB", "CFR", "CIF", "CPT", "CIP", "DAP", "DPU", "DDP"] as const;

type Precheck = {
  destination_country: string;
  origin_country: string;
  hs_code: string;
  product_label: string;
  incoterm: string;
  currency: string;
  goods_value: string; // string for inputs
  freight_cost: string;
  insurance_cost: string;
  email: string;
  company: string;
  consent: boolean;
};

const STORAGE_KEY = "mpl_precheck_invoice_v1";

const INFO_BLOCKS = [
  {
    id: "produit",
    infoSlug: "produit",
    title: "Produit",
    subtitle: "HS code, conformite et exigences techniques.",
    bullets: [
      "Identifier le HS code avec precision.",
      "Verifier les exigences produit (normes, securite, etiquetage).",
      "Confirmer l'origine et les restrictions eventuelles.",
    ],
    links: [
      {
        label: "Access2Markets (Portail officiel UE)",
        href: "https://trade.ec.europa.eu/access-to-markets/en/home",
      },
      {
        label: "Exigences produit - Your Europe",
        href: "https://europa.eu/youreurope/business/product-requirements/compliance/identifying-product-requirements/index_en.htm",
      },
    ],
  },
  {
    id: "destination",
    infoSlug: "destination",
    title: "Destination",
    subtitle: "Accords commerciaux, droits, taxes et regles pays.",
    bullets: [
      "Verifier les droits de douane et taxes applicables.",
      "Consulter les accords commerciaux et regles d'origine.",
      "Anticiper les contraintes locales (licences, restrictions).",
    ],
    links: [
      {
        label: "Access2Markets (duty, taxes, procedures)",
        href: "https://trade.ec.europa.eu/access-to-markets/en/home",
      },
      {
        label: "UE - Acces aux marches",
        href: "https://policy.trade.ec.europa.eu/help-exporters-and-importers/accessing-markets_en",
      },
    ],
  },
  {
    id: "client-contrat",
    infoSlug: "incoterm",
    title: "Client & contrat",
    subtitle: "Incoterms, obligations et clauses contractuelles.",
    bullets: [
      "Choisir un Incoterm adapte au mode de transport.",
      "Clarifier responsabilites, risques et transfert des frais.",
      "Verifier la loi applicable et les conditions de vente.",
    ],
    links: [
      {
        label: "ICC - Incoterms 2020",
        href: "https://iccwbo.org/business-solutions/incoterms-rules/incoterms-2020/",
      },
      {
        label: "CISG (ONU) - Convention vente internationale",
        href: "https://uncitral.un.org/en/texts/salegoods/conventions/sale_of_goods/cisg",
      },
    ],
  },
  {
    id: "logistique",
    infoSlug: "transport",
    title: "Logistique",
    subtitle: "Documents transport, assurance et suivi.",
    bullets: [
      "Prevoir le document de transport (air waybill / bill of lading).",
      "Verifier la couverture assurance transport.",
      "Organiser les delais et le suivi logistique.",
    ],
    links: [
      {
        label: "FIATA - Bill of Lading (FBL)",
        href: "https://fiata.org/digital-bill-of-lading/",
      },
      {
        label: "IATA - Cargo XML Toolkit (AWB)",
        href: "https://www.iata.org/en/publications/manuals/cargo-xml-toolkit/",
      },
    ],
  },
  {
    id: "douane-facture",
    infoSlug: "douane-taxes",
    title: "Douane & facture",
    subtitle: "Declaration, facture commerciale et obligations.",
    bullets: [
      "Preparer la declaration en douane (export/import).",
      "Verifier les mentions obligatoires de la facture.",
      "S'assurer des justificatifs requis en cas de controle.",
    ],
    links: [
      {
        label: "Douane.fr - Declaration en douane",
        href: "https://www.douane.gouv.fr/demarche/deposer-une-declaration-en-douane-import-export",
      },
      {
        label: "Commission UE - Declaration en douane",
        href: "https://taxation-customs.ec.europa.eu/customs/customs-procedures-import-and-export/customs-operations/customs-declaration_en",
      },
    ],
  },
];

function normalizeHs(v: string) {
  return String(v || "").replace(/[^0-9]/g, "").slice(0, 10);
}

function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

function buildTeaserChecklist(pre: Precheck) {
  const items: { label: string; ok: boolean; hint?: string }[] = [
    { label: "Destination renseignée", ok: !!pre.destination_country, hint: "Indispensable pour les obligations et taxes." },
    { label: "HS code renseigné", ok: !!normalizeHs(pre.hs_code), hint: "Utile pour les droits, restrictions et documents." },
    { label: "Incoterm défini", ok: !!pre.incoterm, hint: "Détermine qui paie quoi (transport/assurance/douane)." },
    { label: "Valeur marchandise", ok: !!pre.goods_value, hint: "Base de calcul pour la valeur en douane / marge." },
  ];

  const risks: string[] = [];
  if (!normalizeHs(pre.hs_code)) risks.push("HS code manquant → risque de droits/taxes erronés.");
  if (!pre.origin_country) risks.push("Origine non précisée → règles d’origine & conformité difficiles à valider.");
  if (!pre.incoterm) risks.push("Incoterm absent → risque de litiges sur frais et responsabilités.");
  if (!pre.goods_value) risks.push("Valeur marchandise manquante → impossible d’estimer correctement la marge.");
  if (!pre.destination_country) risks.push("Destination manquante → impossible de cadrer les obligations.");

  return { items, risks };
}

export default function Tool() {
  const navigate = useNavigate();

  const [pre, setPre] = React.useState<Precheck>({
    destination_country: "DE",
    origin_country: "FR",
    hs_code: "",
    product_label: "",
    incoterm: "DAP",
    currency: "EUR",
    goods_value: "",
    freight_cost: "",
    insurance_cost: "",
    email: "",
    company: "",
    consent: false,
  });

  const [error, setError] = React.useState<string | null>(null);
  const [submitted, setSubmitted] = React.useState(false);

  React.useEffect(() => {
    // si l'utilisateur revient, on restaure
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        setPre((p) => ({ ...p, ...parsed }));
      }
    } catch {
      // ignore
    }
  }, []);

  const teaser = React.useMemo(() => buildTeaserChecklist(pre), [pre]);

  const update = (key: keyof Precheck) => (value: string | boolean) => {
    setPre((p) => ({ ...p, [key]: value as any }));
  };

  const handlePrimaryCta = () => {
    setSubmitted(true);
    setError(null);

    if (!pre.consent) {
      setError("Merci de cocher le consentement pour traiter vos données et générer l’analyse.");
      return;
    }
    if (!pre.email || !isEmail(pre.email)) {
      setError("Merci d’indiquer un email valide pour créer votre compte gratuit.");
      return;
    }

    // On stocke le “pré-check” pour l’utiliser après inscription (et le sauvegarder ensuite dans Supabase côté app).
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          destination_country: pre.destination_country,
          origin_country: pre.origin_country,
          hs_code: normalizeHs(pre.hs_code),
          product_label: pre.product_label,
          incoterm: pre.incoterm,
          currency: pre.currency,
          goods_value: pre.goods_value,
          freight_cost: pre.freight_cost,
          insurance_cost: pre.insurance_cost,
          email: pre.email,
          company: pre.company,
          consent: pre.consent,
        })
      );
    } catch {
      // ignore
    }

    // Redirige vers inscription gratuite. (Tu peux ensuite lire STORAGE_KEY dans Register/Login pour pré-remplir.)
    navigate(`/register?next=${encodeURIComponent("/app/invoice-check")}`);
  };

  return (
    <PublicLayout>
      <div className="space-y-10">
        {/* HERO */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-center">
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.35em] text-blue-600">Vérification facture</p>
            <h1 className="text-4xl font-semibold text-slate-900">
              Vérifiez votre facture import/export{" "}
              <span className="text-blue-700">avant envoi</span>.
            </h1>
            <p className="text-slate-600">
              En 2 minutes : une checklist claire, les risques à corriger, et une base de simulation
              coûts/marge. Résultats complets via <b>compte gratuit</b>.
            </p>

            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> Checklist export
              </Badge>
              <Badge variant="outline" className="gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> Points de vigilance
              </Badge>
              <Badge variant="outline" className="gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> Pré-simulation
              </Badge>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <Button onClick={() => document.getElementById("precheck")?.scrollIntoView({ behavior: "smooth" })} className="gap-2">
                <Sparkles className="h-4 w-4" />
                Démarrer le contrôle
              </Button>
              <Button variant="outline" onClick={() => navigate("/login")}>
                J’ai déjà un compte
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              Respect des données : consentement requis. Politique :{" "}
              <a className="underline" href="/confidentialite">
                confidentialité
              </a>
              .
            </p>
          </div>

          {/* TEASER */}
          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle className="text-base">Ce que vous obtiendrez</CardTitle>
              <CardDescription>
                Diagnostic complet après inscription gratuite (et sauvegarde de vos contrôles).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                  <div className="font-medium">Checklist documents</div>
                  <div className="text-xs text-slate-600">Facture, packing list, preuves, transport…</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                  <div className="font-medium">Risques & corrections</div>
                  <div className="text-xs text-slate-600">Champs manquants, incohérences, alertes…</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                  <div className="font-medium">Simulation marge</div>
                  <div className="text-xs text-slate-600">Valeur marchandise + frais = base claire</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                  <div className="font-medium">Historique</div>
                  <div className="text-xs text-slate-600">Retrouvez vos contrôles dans l’app</div>
                </div>
              </div>

              <Separator />

              <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
                <b>Astuce :</b> vous pouvez démarrer ici, puis continuer dans l’application (Control Tower, simulateur, veille).
              </div>
            </CardContent>
          </Card>
        </section>

        {/* PRECHECK FORM */}
        <section id="precheck" className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Contrôle express</CardTitle>
              <CardDescription>
                Renseignez le minimum. Vos réponses complètes seront débloquées après création de compte gratuit.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {error ? (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {error}
                </div>
              ) : null}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>Destination (pays)</Label>
                  <Select value={pre.destination_country} onValueChange={(v) => update("destination_country")(v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choisir" />
                    </SelectTrigger>
                    <SelectContent>
                      {COUNTRIES.map((c) => (
                        <SelectItem key={c.code} value={c.code}>
                          {c.name} ({c.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label>Origine (pays)</Label>
                  <Select value={pre.origin_country} onValueChange={(v) => update("origin_country")(v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choisir" />
                    </SelectTrigger>
                    <SelectContent>
                      {COUNTRIES.map((c) => (
                        <SelectItem key={c.code} value={c.code}>
                          {c.name} ({c.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label>HS code (recommandé)</Label>
                  <Input
                    value={pre.hs_code}
                    onChange={(e) => update("hs_code")(normalizeHs(e.target.value))}
                    placeholder="ex: 94036090"
                  />
                </div>

                <div className="space-y-1">
                  <Label>Produit (libellé)</Label>
                  <Input
                    value={pre.product_label}
                    onChange={(e) => update("product_label")(e.target.value)}
                    placeholder="ex: mobilier en bois, pièces industrielles…"
                  />
                </div>

                <div className="space-y-1">
                  <Label>Incoterm</Label>
                  <Select value={pre.incoterm} onValueChange={(v) => update("incoterm")(v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choisir" />
                    </SelectTrigger>
                    <SelectContent>
                      {INCOTERMS.map((i) => (
                        <SelectItem key={i} value={i}>
                          {i}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label>Devise</Label>
                  <Input value={pre.currency} onChange={(e) => update("currency")(e.target.value.toUpperCase())} placeholder="EUR" />
                </div>

                <div className="space-y-1">
                  <Label>Valeur marchandise (HT)</Label>
                  <Input value={pre.goods_value} onChange={(e) => update("goods_value")(e.target.value)} placeholder="ex: 12500" />
                </div>

                <div className="space-y-1">
                  <Label>Frais transport (si connus)</Label>
                  <Input value={pre.freight_cost} onChange={(e) => update("freight_cost")(e.target.value)} placeholder="ex: 250" />
                </div>

                <div className="space-y-1">
                  <Label>Assurance (si connue)</Label>
                  <Input value={pre.insurance_cost} onChange={(e) => update("insurance_cost")(e.target.value)} placeholder="ex: 45" />
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>Email (création compte gratuit)</Label>
                  <Input
                    value={pre.email}
                    onChange={(e) => update("email")(e.target.value)}
                    placeholder="vous@entreprise.fr"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Société (optionnel)</Label>
                  <Input value={pre.company} onChange={(e) => update("company")(e.target.value)} placeholder="Nom de l’entreprise" />
                </div>

                <div className="sm:col-span-2 flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <input
                    type="checkbox"
                    checked={pre.consent}
                    onChange={(e) => update("consent")(e.target.checked)}
                    className="mt-1 h-4 w-4"
                  />
                  <div className="text-sm text-slate-700">
                    <div className="font-medium">
                      Consentement requis pour traiter ces informations et générer l’analyse.
                    </div>
                    <div className="text-xs text-slate-500">
                      Vous pouvez demander la suppression de vos données depuis votre compte. Voir{" "}
                      <a className="underline" href="/confidentialite">
                        confidentialité
                      </a>
                      .
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button className="gap-2" onClick={handlePrimaryCta}>
                  <Sparkles className="h-4 w-4" />
                  Créer mon compte gratuit et obtenir mon diagnostic
                </Button>
                <Button variant="outline" onClick={() => navigate("/login")}>
                  Se connecter
                </Button>
              </div>

              {submitted ? (
                <p className="text-xs text-muted-foreground">
                  Les résultats complets sont débloqués après inscription (et sauvegardés ensuite dans l’application).
                </p>
              ) : null}
            </CardContent>
          </Card>

          {/* TEASER RESULTS (LOCKED) */}
          <Card className="relative overflow-hidden">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-slate-500" />
                Aperçu des résultats
              </CardTitle>
              <CardDescription>Un aperçu immédiat. Débloquez l’analyse complète via compte gratuit.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="text-sm font-semibold text-slate-900">Checklist (aperçu)</div>
                {teaser.items.slice(0, 4).map((it) => (
                  <div key={it.label} className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white p-2">
                    <div className={`mt-0.5 h-2.5 w-2.5 rounded-full ${it.ok ? "bg-emerald-500" : "bg-amber-400"}`} />
                    <div className="min-w-0">
                      <div className="text-sm text-slate-900">{it.label}</div>
                      <div className="text-xs text-slate-500">{it.hint}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <div className="text-sm font-semibold text-slate-900">Risques (aperçu)</div>
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                  {teaser.risks.length ? (
                    <ul className="list-disc space-y-1 pl-4">
                      {teaser.risks.slice(0, 3).map((r) => (
                        <li key={r}>{r}</li>
                      ))}
                    </ul>
                  ) : (
                    <div>Renseignez le formulaire pour voir les points de vigilance.</div>
                  )}
                </div>
              </div>

              <Separator />

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                <div className="font-medium">Débloqué après inscription</div>
                <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-slate-600">
                  <li>Checklist complète + documents recommandés</li>
                  <li>Simulation plus précise (valeur, frais, cohérence)</li>
                  <li>Historique + export PDF (dans l’app)</li>
                </ul>
              </div>
            </CardContent>

            {/* Overlay lock */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-white/70 via-transparent to-transparent" />
          </Card>
        </section>

        {/* INFOS ESSENTIELLES */}
        <section id="infos-export" className="space-y-4">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.35em] text-blue-600">Infos export</p>
            <h2 className="text-2xl font-semibold text-slate-900">De quoi j'ai besoin pour exporter ?</h2>
            <p className="text-sm text-slate-600">
              Chaque bloc reprend une etape cle et des sources externes officielles pour aller plus loin.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {INFO_BLOCKS.map((block) => (
              <Card key={block.id} id={block.id} className="border-slate-200">
                <CardHeader>
                  <CardTitle className="text-base">{block.title}</CardTitle>
                  <CardDescription>{block.subtitle}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-slate-600">
                  <ul className="space-y-2">
                    {block.bullets.map((b) => (
                      <li key={b} className="flex items-start gap-2">
                        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-slate-400" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                      Sources utiles
                    </div>
                    <div className="mt-2 flex flex-col gap-2 text-sm">
                      {block.links.map((link) => (
                        <a
                          key={link.href}
                          href={link.href}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-700 hover:text-blue-900 hover:underline"
                        >
                          {link.label}
                        </a>
                      ))}
                    </div>
                  </div>
                  <Link
                    to={`/infos/${block.infoSlug}`}
                    className="inline-flex text-sm font-semibold text-blue-700 hover:text-blue-900 hover:underline"
                  >
                    Voir l'impact sur la decision
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Homogénéité : pont vers l’app */}
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Control Tower</CardTitle>
              <CardDescription>Pilotage par destination et HS (CSV).</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-slate-600">
              Visualisez vos flux, marges, et priorités par pays/produit. Accès via compte.
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Simulateur export</CardTitle>
              <CardDescription>Coûts & rentabilité selon Incoterm.</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-slate-600">
              Estimez la rentabilité avant de signer. Accès via compte.
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Centre de veille</CardTitle>
              <CardDescription>Réglementation + secteurs.</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-slate-600">
              Suivez les évolutions utiles pour vos destinations. Accès via compte.
            </CardContent>
          </Card>
        </section>
      </div>
    </PublicLayout>
  );
}
