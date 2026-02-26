import * as React from "react";
import { Link, useParams } from "react-router-dom";
import { ExternalLink, FileText, Printer } from "lucide-react";

import { PremiumMarketingLayout } from "@/components/marketing/PremiumMarketingLayout";
import { SectionPremium } from "@/components/marketing/SectionPremium";
import { CTAStripPremium } from "@/components/marketing/CTAStripPremium";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useI18n } from "@/contexts/LanguageContext";
import { COUNTRIES, INCOTERMS, OFFICIAL_LINKS, PRODUCTS, getCountryLabel } from "@/lib/constants";
import { exportAnswer } from "@/services/supabaseAI";
import { getFeaturedGuides, getGuideBySlug, GUIDES as guides } from "@/data/guides";
import { toFriendlyErrorMessage } from "@/lib/textSanitizer";

type GuideStructuredState = {
  destination: string;
  productCode: string;
  hs6: string;
  incoterm: string;
};

function buildPaymentAdvice(lang: "fr" | "en") {
  if (lang === "en") {
    return [
      "Use letter of credit or CAD for first transactions.",
      "Set payment milestones linked to shipping documents.",
      "Clarify FX risk allocation in the contract.",
    ];
  }

  return [
    "Privilegier credit documentaire ou CAD pour les premieres operations.",
    "Fixer des echeances de paiement liees aux documents de transport.",
    "Prevoir contractuellement la gestion du risque de change.",
  ];
}

function buildStandardDocuments(lang: "fr" | "en") {
  if (lang === "en") {
    return [
      "Commercial invoice",
      "Packing list",
      "Transport document (BL/AWB/CMR)",
      "Certificate of origin (when requested)",
      "Insurance certificate (depending on Incoterm)",
    ];
  }

  return [
    "Facture commerciale",
    "Liste de colisage",
    "Document de transport (BL/AWB/CMR)",
    "Certificat d'origine (si requis)",
    "Certificat d'assurance (selon Incoterm)",
  ];
}

export default function Guide() {
  const params = useParams();
  const slug = params.slug || "";

  if (slug) {
    return <GuideDetail slug={slug} />;
  }

  return <GuideListing />;
}

function GuideListing() {
  const { lang } = useI18n();
  const isEn = lang === "en";

  const [state, setState] = React.useState<GuideStructuredState>({
    destination: "",
    productCode: "",
    hs6: "",
    incoterm: "",
  });
  const [loading, setLoading] = React.useState(false);
  const [errorText, setErrorText] = React.useState("");
  const [result, setResult] = React.useState<{
    destination: string;
    productLabel: string;
    hs6: string;
    rules: string[];
    links: Array<{ label: string; url: string }>;
  } | null>(null);

  const updateState = (patch: Partial<GuideStructuredState>) => {
    setState((prev) => ({ ...prev, ...patch }));
  };

  const handleProductChange = (productCode: string) => {
    const product = PRODUCTS.find((item) => item.code === productCode);
    updateState({ productCode, hs6: product?.hs6 || "" });
  };

  const generateGuide = async () => {
    if (!state.destination || !state.productCode || !state.hs6) {
      setErrorText(
        isEn
          ? "Please select destination, product and HS code."
          : "Merci de selectionner destination, produit et code HS."
      );
      return;
    }

    setLoading(true);
    setErrorText("");

    try {
      const answer = await exportAnswer(state.destination, state.hs6, lang);
      const product = PRODUCTS.find((item) => item.code === state.productCode);

      const ruleSummaries = (answer.product_rules || [])
        .map((rule: any) => String(rule?.summary || rule?.title || rule?.name || "").trim())
        .filter(Boolean)
        .slice(0, 6);

      const sourceLinks = (answer.update_sources || [])
        .map((source) => ({ label: source?.label || source?.source_key || "Source", url: source?.url || "" }))
        .filter((source) => /^https?:\/\//i.test(source.url))
        .slice(0, 6);

      const officialLinks = [
        { label: "Access2Markets", url: OFFICIAL_LINKS.access2markets },
        { label: "TARIC", url: OFFICIAL_LINKS.taric },
        { label: "EU Sanctions", url: OFFICIAL_LINKS.eu_sanctions },
        { label: "OFAC", url: OFFICIAL_LINKS.ofac },
        { label: "UN Sanctions", url: OFFICIAL_LINKS.un_sanctions },
      ];

      setResult({
        destination: getCountryLabel(state.destination, lang),
        productLabel: product ? (isEn ? product.label_en : product.label_fr) : state.productCode,
        hs6: state.hs6,
        rules: ruleSummaries,
        links: [...sourceLinks, ...officialLinks].slice(0, 8),
      });
    } catch (error) {
      setErrorText(toFriendlyErrorMessage(error, lang));
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const checklist = React.useMemo(() => {
    if (isEn) {
      return [
        "Confirm destination and HS code with customs broker.",
        "Validate Incoterm and payment risk split.",
        "Screen parties against sanctions lists.",
        "Check documentary package before shipment.",
        "Recheck duties and VAT assumptions before final quote.",
      ];
    }

    return [
      "Confirmer destination et HS avec le declarant en douane.",
      "Valider la repartition des risques (Incoterm + paiement).",
      "Lancer un screening sanctions des parties.",
      "Verifier le package documentaire avant expedition.",
      "Confirmer droits et TVA avant devis final.",
    ];
  }, [isEn]);

  return (
    <PremiumMarketingLayout>
      <SectionPremium
        eyebrow={isEn ? "Guided export" : "Guide export guide"}
        title={isEn ? "Country + product + HS" : "Pays + produit + HS"}
      >
        <Card>
          <CardHeader>
            <CardTitle>{isEn ? "Guided input" : "Saisie guidee"}</CardTitle>
            <CardDescription>
              {isEn
                ? "Controlled dropdowns only, then structured result with official links."
                : "Menus deroulants controles uniquement, puis resultat structure avec liens officiels."}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">{isEn ? "Destination" : "Destination"}</p>
              <Select value={state.destination} onValueChange={(value) => updateState({ destination: value })}>
                <SelectTrigger><SelectValue placeholder="-" /></SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map((country) => (
                    <SelectItem key={`country-${country.iso2}`} value={country.iso2}>
                      {lang === "en" ? country.label_en : country.label_fr}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">{isEn ? "Product" : "Produit"}</p>
              <Select value={state.productCode} onValueChange={handleProductChange}>
                <SelectTrigger><SelectValue placeholder="-" /></SelectTrigger>
                <SelectContent>
                  {PRODUCTS.map((product) => (
                    <SelectItem key={`product-${product.code}`} value={product.code}>
                      {lang === "en" ? product.label_en : product.label_fr}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">HS</p>
              <Select value={state.hs6} onValueChange={(value) => updateState({ hs6: value })}>
                <SelectTrigger><SelectValue placeholder="-" /></SelectTrigger>
                <SelectContent>
                  {PRODUCTS.map((product) => (
                    <SelectItem key={`hs-${product.hs6}-${product.code}`} value={product.hs6}>
                      {product.hs6} - {lang === "en" ? product.label_en : product.label_fr}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Incoterm</p>
              <Select value={state.incoterm} onValueChange={(value) => updateState({ incoterm: value })}>
                <SelectTrigger><SelectValue placeholder="-" /></SelectTrigger>
                <SelectContent>
                  {INCOTERMS.map((incoterm) => (
                    <SelectItem key={`incoterm-${incoterm.value}`} value={incoterm.value}>
                      {incoterm.value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-4">
              <Button onClick={() => void generateGuide()} disabled={loading}>
                {loading ? (isEn ? "Generating..." : "Generation...") : isEn ? "Generate structured guide" : "Generer le guide structure"}
              </Button>
            </div>

            {errorText ? <p className="md:col-span-4 text-sm text-rose-700">{errorText}</p> : null}
          </CardContent>
        </Card>

        {result ? (
          <div className="mt-6 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>{isEn ? "Structured result" : "Resultat structure"}</CardTitle>
                <CardDescription>
                  {result.destination} | {result.productLabel} | HS {result.hs6}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div>
                  <p className="text-sm font-semibold">{isEn ? "Standard documents" : "Documents usuels"}</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                    {buildStandardDocuments(lang).map((item) => (
                      <li key={`doc-${item}`}>{item}</li>
                    ))}
                  </ul>
                </div>

                <div>
                  <p className="text-sm font-semibold">{isEn ? "Compliance watch points" : "Points de vigilance conformite"}</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                    {(result.rules.length ? result.rules : [isEn ? "No specific rule returned yet." : "Aucune regle specifique retournee pour l'instant."]).map((item) => (
                      <li key={`rule-${item}`}>{item}</li>
                    ))}
                  </ul>
                </div>

                <div>
                  <p className="text-sm font-semibold">{isEn ? "Payment recommendations" : "Paiement recommande"}</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                    {buildPaymentAdvice(lang).map((item) => (
                      <li key={`pay-${item}`}>{item}</li>
                    ))}
                  </ul>
                </div>

                <div>
                  <p className="text-sm font-semibold">{isEn ? "Official links" : "Liens officiels"}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {result.links.map((link) => (
                      <a
                        key={`${link.label}-${link.url}`}
                        href={link.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs hover:bg-muted"
                      >
                        {link.label}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border bg-muted/20 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">{isEn ? "Printable checklist" : "Check-list imprimable"}</p>
                    <Button variant="outline" size="sm" onClick={() => window.print()}>
                      <Printer className="mr-1 h-3.5 w-3.5" />
                      {isEn ? "Print" : "Imprimer"}
                    </Button>
                  </div>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                    {checklist.map((item) => (
                      <li key={`check-${item}`}>{item}</li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : null}
      </SectionPremium>

      <CTAStripPremium
        eyebrow={isEn ? "Need support" : "Besoin d'accompagnement"}
        title={isEn ? "Request an export audit quote" : "Demandez un devis d'audit export"}
        primaryCta={{ label: isEn ? "Contact" : "Contact", to: "/contact?offer=audit" }}
        secondaryCta={{ label: isEn ? "Open assistant" : "Ouvrir l'assistant", to: "/assistant" }}
      />
    </PremiumMarketingLayout>
  );
}

function GuideDetail({ slug }: { slug: string }) {
  const { lang } = useI18n();
  const isEn = lang === "en";

  const content = getGuideBySlug(slug);
  const suggestions = getFeaturedGuides(3, slug);

  if (!content) {
    return (
      <PremiumMarketingLayout>
        <SectionPremium eyebrow={isEn ? "Error" : "Erreur"} title={isEn ? "Guide not found" : "Guide introuvable"}>
          <p className="text-[hsl(var(--mkt-ink-muted))]">
            {isEn
              ? "This guide does not exist or has been moved."
              : "Ce guide n'existe pas ou a ete deplace."}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/guides" className="mkt-btn mkt-btn-primary">
              {isEn ? "Back to guides" : "Retour aux guides"}
            </Link>
            <Link to="/contact?offer=audit" className="mkt-btn mkt-btn-outline">
              {isEn ? "Contact" : "Contact"}
            </Link>
          </div>
        </SectionPremium>
      </PremiumMarketingLayout>
    );
  }

  return (
    <PremiumMarketingLayout>
      <SectionPremium eyebrow={isEn ? "Guide" : "Guide"} title={content.title}>
        <div className="space-y-4">
          <p className="text-[hsl(var(--mkt-ink-muted))]">{content.intro}</p>

          {Array.isArray(content.mistakes) && content.mistakes.length ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{isEn ? "Watch points" : "Points de vigilance"}</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {content.mistakes.map((mistake, index) => (
                    <li key={`mistake-${index}`}>{mistake}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{isEn ? "Action" : "Action"}</CardTitle>
              <CardDescription>{content.ctaLabel}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Link to="/guides" className="mkt-btn mkt-btn-outline">
                <FileText className="mr-1 inline h-4 w-4" />
                {isEn ? "Other guides" : "Autres guides"}
              </Link>
              <Link to="/contact?offer=audit" className="mkt-btn mkt-btn-primary">
                {isEn ? "Request advisory" : "Demander un accompagnement"}
              </Link>
            </CardContent>
          </Card>

          {suggestions.length ? (
            <div className="space-y-2">
              <p className="text-sm font-semibold">{isEn ? "Related guides" : "Guides associes"}</p>
              <div className="grid gap-3 md:grid-cols-3">
                {suggestions.map((guide) => (
                  <Link key={guide.slug} to={`/guides/${guide.slug}`} className="mkt-card p-4">
                    <p className="text-sm font-semibold text-[hsl(var(--mkt-ink))]">{guide.title}</p>
                    <p className="mt-1 text-xs text-[hsl(var(--mkt-ink-muted))]">{guide.intro}</p>
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </SectionPremium>
    </PremiumMarketingLayout>
  );
}
