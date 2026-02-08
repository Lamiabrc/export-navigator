import { Link, useParams } from "react-router-dom";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/contexts/LanguageContext";

type LangText = { fr: string; en: string };
type SourceLink = { label: string; href: string };

type InfoContent = {
  title: LangText;
  subtitle: LangText;
  impactTitle: LangText;
  impactBullets: LangText[];
  checklistTitle: LangText;
  checklistBullets: LangText[];
  questionsTitle: LangText;
  questions: LangText[];
  sourcesTitle: LangText;
  sources: SourceLink[];
  related: string[];
};

const CONTENT: Record<string, InfoContent> = {
  produit: {
    title: { fr: "Produit : HS code, conformite et risques", en: "Product: HS code, compliance and risks" },
    subtitle: {
      fr: "Le produit determine les droits, les controles et les obligations techniques.",
      en: "The product drives duties, controls and technical obligations.",
    },
    impactTitle: { fr: "Impact sur la decision", en: "Decision impact" },
    impactBullets: [
      {
        fr: "HS code = niveau de droits, taxes et controles.",
        en: "HS code = duties, taxes and controls level.",
      },
      {
        fr: "Normes et etiquetage peuvent bloquer l'entree.",
        en: "Standards and labeling can block entry.",
      },
      {
        fr: "Origine peut ouvrir ou fermer des accords preferentiels.",
        en: "Origin can open or block preferential agreements.",
      },
    ],
    checklistTitle: { fr: "A preciser", en: "What to confirm" },
    checklistBullets: [
      { fr: "HS code a 6-10 chiffres", en: "HS code (6-10 digits)" },
      { fr: "Fiches techniques et normes applicables", en: "Technical sheets and applicable standards" },
      { fr: "Pays d'origine et preuves", en: "Country of origin and proofs" },
    ],
    questionsTitle: { fr: "Questions cle", en: "Key questions" },
    questions: [
      { fr: "Le produit est-il reglemente ?", en: "Is the product regulated?" },
      { fr: "Quelles preuves d'origine ?", en: "Which origin proofs are required?" },
      { fr: "Quel HS code officiel retenu ?", en: "Which official HS code is used?" },
    ],
    sourcesTitle: { fr: "Sources officielles", en: "Official sources" },
    sources: [
      { label: "Access2Markets (UE)", href: "https://trade.ec.europa.eu/access-to-markets/en/home" },
      {
        label: "Product requirements - Your Europe",
        href: "https://europa.eu/youreurope/business/product-requirements/compliance/identifying-product-requirements/index_en.htm",
      },
    ],
    related: ["destination", "incoterm", "transport", "douane-taxes"],
  },
  destination: {
    title: { fr: "Destination : droits, taxes et contraintes pays", en: "Destination: duties, taxes and local constraints" },
    subtitle: {
      fr: "Le pays cible impacte les couts, les delais et les risques.",
      en: "The target country impacts costs, lead times and risks.",
    },
    impactTitle: { fr: "Impact sur la decision", en: "Decision impact" },
    impactBullets: [
      { fr: "Droits et taxes varient selon le pays.", en: "Duties and taxes differ by country." },
      { fr: "Sanctions et restrictions peuvent bloquer une vente.", en: "Sanctions and restrictions can block a sale." },
      { fr: "Delais et couts logistiques changent selon la zone.", en: "Lead times and logistics costs vary by region." },
    ],
    checklistTitle: { fr: "A preciser", en: "What to confirm" },
    checklistBullets: [
      { fr: "Pays de destination exact", en: "Exact destination country" },
      { fr: "Regles d'origine et accords", en: "Origin rules and agreements" },
      { fr: "Contraintes locales (licences, normes)", en: "Local constraints (licenses, standards)" },
    ],
    questionsTitle: { fr: "Questions cle", en: "Key questions" },
    questions: [
      { fr: "Existe-t-il un accord preferentiel ?", en: "Is there a preferential agreement?" },
      { fr: "Quels risques pays / sanctions ?", en: "Any country or sanctions risk?" },
      { fr: "Qui gere le dedouanement local ?", en: "Who handles local clearance?" },
    ],
    sourcesTitle: { fr: "Sources officielles", en: "Official sources" },
    sources: [
      { label: "Access2Markets (UE)", href: "https://trade.ec.europa.eu/access-to-markets/en/home" },
      { label: "EU Trade policy", href: "https://trade.ec.europa.eu/" },
    ],
    related: ["produit", "incoterm", "transport", "douane-taxes"],
  },
  incoterm: {
    title: { fr: "Incoterm : responsabilites et litiges", en: "Incoterm: responsibilities and disputes" },
    subtitle: {
      fr: "L'incoterm fixe qui paie quoi et ou le risque bascule.",
      en: "Incoterms define who pays what and where risk transfers.",
    },
    impactTitle: { fr: "Impact sur la decision", en: "Decision impact" },
    impactBullets: [
      { fr: "Responsabilites = couts + risques.", en: "Responsibilities drive costs and risks." },
      { fr: "Lieu de livraison = litiges potentiels.", en: "Delivery place can create disputes." },
      { fr: "Assurance et transport doivent etre alignes.", en: "Insurance and transport must align." },
    ],
    checklistTitle: { fr: "A preciser", en: "What to confirm" },
    checklistBullets: [
      { fr: "Incoterm exact + lieu nomme", en: "Exact Incoterm + named place" },
      { fr: "Qui gere export / import", en: "Who handles export / import" },
      { fr: "Assurance incluse ou non", en: "Insurance included or not" },
    ],
    questionsTitle: { fr: "Questions cle", en: "Key questions" },
    questions: [
      { fr: "Qui paie le transport principal ?", en: "Who pays main transport?" },
      { fr: "Ou le risque est transfere ?", en: "Where does risk transfer?" },
      { fr: "Qui supporte droits/TVA ?", en: "Who pays duties/VAT?" },
    ],
    sourcesTitle: { fr: "Sources officielles", en: "Official sources" },
    sources: [
      { label: "ICC - Incoterms 2020", href: "https://iccwbo.org/business-solutions/incoterms-rules/incoterms-2020/" },
      { label: "CISG (UN) - Sale of goods", href: "https://uncitral.un.org/en/texts/salegoods/conventions/sale_of_goods/cisg" },
    ],
    related: ["produit", "destination", "transport", "douane-taxes"],
  },
  transport: {
    title: { fr: "Transport : couts et delais", en: "Transport: costs and lead times" },
    subtitle: {
      fr: "Le mode de transport impacte prix, delais et risques.",
      en: "Transport mode affects price, lead time and risk.",
    },
    impactTitle: { fr: "Impact sur la decision", en: "Decision impact" },
    impactBullets: [
      { fr: "Air = rapide mais cher.", en: "Air = fast but expensive." },
      { fr: "Mer = economique mais plus long.", en: "Sea = cheaper but slower." },
      { fr: "Route = flexible mais depend des frontieres.", en: "Road = flexible but border dependent." },
    ],
    checklistTitle: { fr: "A preciser", en: "What to confirm" },
    checklistBullets: [
      { fr: "Mode (air/mer/route) et incoterm", en: "Mode (air/sea/road) and incoterm" },
      { fr: "Delais, surcharges et capacites", en: "Lead time, surcharges and capacity" },
      { fr: "Document de transport requis", en: "Required transport document" },
    ],
    questionsTitle: { fr: "Questions cle", en: "Key questions" },
    questions: [
      { fr: "Quel impact sur la marge ?", en: "Impact on margin?" },
      { fr: "Quel niveau d'assurance ?", en: "Required insurance level?" },
      { fr: "Qui gere le suivi et le delivery ?", en: "Who manages tracking and delivery?" },
    ],
    sourcesTitle: { fr: "Sources officielles", en: "Official sources" },
    sources: [
      { label: "IATA - Cargo toolkit", href: "https://www.iata.org/en/publications/manuals/cargo-xml-toolkit/" },
      { label: "FIATA - Bill of Lading", href: "https://fiata.org/digital-bill-of-lading/" },
    ],
    related: ["incoterm", "destination", "douane-taxes", "produit"],
  },
  "douane-taxes": {
    title: { fr: "Douane & taxes : cash et conformite", en: "Customs & taxes: cash and compliance" },
    subtitle: {
      fr: "La douane influence le cash, la marge et les delais.",
      en: "Customs affects cash flow, margin and lead time.",
    },
    impactTitle: { fr: "Impact sur la decision", en: "Decision impact" },
    impactBullets: [
      { fr: "Droits + TVA = impact direct sur la marge.", en: "Duties + VAT directly impact margin." },
      { fr: "Erreurs de declaration = retards et sanctions.", en: "Declaration errors cause delays and penalties." },
      { fr: "Valeur en douane = base de calcul.", en: "Customs value is the calculation base." },
    ],
    checklistTitle: { fr: "A preciser", en: "What to confirm" },
    checklistBullets: [
      { fr: "Code HS et valeur declaree", en: "HS code and declared value" },
      { fr: "Regime TVA / droits", en: "VAT and duty regime" },
      { fr: "Documents de preuve (facture, origine)", en: "Proof documents (invoice, origin)" },
    ],
    questionsTitle: { fr: "Questions cle", en: "Key questions" },
    questions: [
      { fr: "Qui paie droits/TVA ?", en: "Who pays duties/VAT?" },
      { fr: "Quelles preuves d'origine ?", en: "Which origin proofs?" },
      { fr: "Quel regime douanier utiliser ?", en: "Which customs regime to use?" },
    ],
    sourcesTitle: { fr: "Sources officielles", en: "Official sources" },
    sources: [
      { label: "Douane.fr - Declaration", href: "https://www.douane.gouv.fr/demarche/deposer-une-declaration-en-douane-import-export" },
      {
        label: "EU Customs Declaration",
        href: "https://taxation-customs.ec.europa.eu/customs/customs-procedures-import-and-export/customs-operations/customs-declaration_en",
      },
    ],
    related: ["incoterm", "produit", "destination", "transport"],
  },
};

const ORDER = ["produit", "destination", "incoterm", "transport", "douane-taxes"];

function pickText(text: LangText, lang: "fr" | "en") {
  return lang === "fr" ? text.fr : text.en;
}

export default function InfoParameter() {
  const params = useParams();
  const slug = params.slug || "";
  const { lang } = useI18n();
  const isFr = lang === "fr";

  const content = CONTENT[slug];

  if (!content) {
    return (
      <PublicLayout>
        <div className="space-y-6">
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle>{isFr ? "Page introuvable" : "Page not found"}</CardTitle>
              <CardDescription>
                {isFr ? "Cette page d'information n'existe pas." : "This info page does not exist."}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Button asChild>
                <Link to="/tool">{isFr ? "Retour a l'outil" : "Back to tool"}</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/contact">{isFr ? "Nous contacter" : "Contact us"}</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </PublicLayout>
    );
  }

  const other = ORDER.filter((k) => k !== slug);

  return (
    <PublicLayout>
      <div className="space-y-8">
        <section className="space-y-3">
          <Badge variant="outline">{isFr ? "Info decision" : "Decision info"}</Badge>
          <h1 className="text-3xl font-semibold text-slate-900">{pickText(content.title, lang)}</h1>
          <p className="text-slate-600">{pickText(content.subtitle, lang)}</p>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle>{pickText(content.impactTitle, lang)}</CardTitle>
              <CardDescription>
                {isFr
                  ? "Pourquoi ce parametre change la marge, les risques et les delais."
                  : "How this parameter changes margin, risk and lead time."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-slate-600">
                {content.impactBullets.map((b) => (
                  <li key={b.fr} className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-slate-400" />
                    <span>{pickText(b, lang)}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle>{pickText(content.questionsTitle, lang)}</CardTitle>
              <CardDescription>
                {isFr ? "Questions a trancher avant devis." : "Questions to settle before quoting."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-slate-600">
                {content.questions.map((q) => (
                  <li key={q.fr} className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-blue-500" />
                    <span>{pickText(q, lang)}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle>{pickText(content.checklistTitle, lang)}</CardTitle>
              <CardDescription>
                {isFr ? "Elements a clarifier pour decider vite." : "Items to clarify for fast decisions."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-slate-600">
                {content.checklistBullets.map((b) => (
                  <li key={b.fr} className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    <span>{pickText(b, lang)}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle>{pickText(content.sourcesTitle, lang)}</CardTitle>
              <CardDescription>
                {isFr
                  ? "Liens externes officiels pour aller plus loin."
                  : "Official external links for deeper research."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {content.sources.map((s) => (
                <a
                  key={s.href}
                  href={s.href}
                  target="_blank"
                  rel="noreferrer"
                  className="block text-blue-700 hover:text-blue-900 hover:underline"
                >
                  {s.label}
                </a>
              ))}
            </CardContent>
          </Card>
        </section>

        <section className="flex flex-wrap items-center gap-3">
          <Button asChild>
            <Link to="/contact">{isFr ? "Nous contacter" : "Contact us"}</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/tool">{isFr ? "Revenir a l'outil" : "Back to tool"}</Link>
          </Button>
        </section>

        <section className="space-y-2">
          <p className="text-xs uppercase tracking-[0.35em] text-slate-400">
            {isFr ? "Autres parametres" : "Other parameters"}
          </p>
          <div className="flex flex-wrap gap-2">
            {other.map((k) => (
              <Button key={k} variant="ghost" asChild>
                <Link to={`/infos/${k}`}>{pickText(CONTENT[k].title, lang)}</Link>
              </Button>
            ))}
          </div>
        </section>
      </div>
    </PublicLayout>
  );
}
