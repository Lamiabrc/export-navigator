import * as React from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, ChevronLeft, ChevronRight, CircleHelp, MessageCircleWarning } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/contexts/LanguageContext";
import {
  COUNTRIES,
  CURRENCIES,
  DISTRIBUTION_CHANNELS,
  HS_OPTIONS,
  INCOTERMS,
  NEED_OPTIONS,
  OFFICIAL_LINKS,
  OPERATION_TYPES,
  PAYMENT_TERMS,
  PRODUCTS,
  TRANSPORT_MODES,
  VALUE_BANDS,
  VOLUME_BANDS,
  WEIGHT_BANDS,
  YES_NO_OPTIONS,
  getCountryLabel,
  getLocalizedLabel,
  getProductByCode,
  type LocalizedOption,
  type UiLang,
} from "@/lib/constants";
import { sanitizeOptionalComment } from "@/lib/textSanitizer";

type NeedValue = "guide" | "watch" | "invoice" | "landed_cost" | "tower" | "advisory";
type FeedbackValue = "yes" | "no" | null;

type WizardState = {
  operationType: string;
  need: NeedValue | "";
  destination: string;
  transitCountry: string;
  productCode: string;
  hs6: string;
  incoterm: string;
  transportMode: string;
  currency: string;
  paymentTerm: string;
  distributionChannel: string;
  weightBand: string;
  volumeBand: string;
  valueBand: string;
  insurance: string;
  optionalComment: string;
};

type QuestionKey =
  | "destination"
  | "transitCountry"
  | "productCode"
  | "hs6"
  | "incoterm"
  | "transportMode"
  | "currency"
  | "paymentTerm"
  | "distributionChannel"
  | "weightBand"
  | "volumeBand"
  | "valueBand"
  | "insurance";

type QuestionConfig = {
  key: QuestionKey;
  title_fr: string;
  title_en: string;
  helper_fr: string;
  helper_en: string;
};

const INITIAL_STATE: WizardState = {
  operationType: "",
  need: "",
  destination: "",
  transitCountry: "none",
  productCode: "",
  hs6: "",
  incoterm: "",
  transportMode: "",
  currency: "",
  paymentTerm: "",
  distributionChannel: "",
  weightBand: "",
  volumeBand: "",
  valueBand: "",
  insurance: "",
  optionalComment: "",
};

const QUESTION_BANK: Record<QuestionKey, QuestionConfig> = {
  destination: {
    key: "destination",
    title_fr: "Pays de destination",
    title_en: "Destination country",
    helper_fr: "Choisissez le pays principal de vente/livraison.",
    helper_en: "Choose the main destination market.",
  },
  transitCountry: {
    key: "transitCountry",
    title_fr: "Pays de transit",
    title_en: "Transit country",
    helper_fr: "Optionnel en pratique, mais utile pour la conformité transport.",
    helper_en: "Optional in practice, useful for transport compliance.",
  },
  productCode: {
    key: "productCode",
    title_fr: "Produit",
    title_en: "Product",
    helper_fr: "Choisissez un produit type de votre opération.",
    helper_en: "Select the product for this operation.",
  },
  hs6: {
    key: "hs6",
    title_fr: "Code HS",
    title_en: "HS code",
    helper_fr: "Confirmez le HS 6 chiffres le plus proche.",
    helper_en: "Confirm the closest 6-digit HS code.",
  },
  incoterm: {
    key: "incoterm",
    title_fr: "Incoterm",
    title_en: "Incoterm",
    helper_fr: "Choisissez l'Incoterm contractuel cible.",
    helper_en: "Select your target contractual Incoterm.",
  },
  transportMode: {
    key: "transportMode",
    title_fr: "Mode de transport",
    title_en: "Transport mode",
    helper_fr: "Selectionnez le mode principal.",
    helper_en: "Select the primary transport mode.",
  },
  currency: {
    key: "currency",
    title_fr: "Devise",
    title_en: "Currency",
    helper_fr: "Devise de facturation principale.",
    helper_en: "Main invoicing currency.",
  },
  paymentTerm: {
    key: "paymentTerm",
    title_fr: "Moyen de paiement",
    title_en: "Payment method",
    helper_fr: "Choisissez un mode de paiement controlable.",
    helper_en: "Select a controlled payment method.",
  },
  distributionChannel: {
    key: "distributionChannel",
    title_fr: "Canal de distribution",
    title_en: "Distribution channel",
    helper_fr: "Canal principal de vente.",
    helper_en: "Main sales channel.",
  },
  weightBand: {
    key: "weightBand",
    title_fr: "Poids par envoi",
    title_en: "Weight band",
    helper_fr: "Choisissez une tranche de poids.",
    helper_en: "Select a weight band.",
  },
  volumeBand: {
    key: "volumeBand",
    title_fr: "Volume par envoi",
    title_en: "Volume band",
    helper_fr: "Choisissez une tranche de volume.",
    helper_en: "Select a volume band.",
  },
  valueBand: {
    key: "valueBand",
    title_fr: "Valeur de l'operation",
    title_en: "Operation value",
    helper_fr: "Choisissez une tranche de valeur.",
    helper_en: "Select a value band.",
  },
  insurance: {
    key: "insurance",
    title_fr: "Assurance transport",
    title_en: "Transport insurance",
    helper_fr: "Indiquez si l'assurance est prevue.",
    helper_en: "State whether insurance is planned.",
  },
};

function getFlowByNeed(need: NeedValue | ""): QuestionKey[] {
  if (need === "guide") {
    return ["destination", "productCode", "hs6", "incoterm", "paymentTerm", "currency"];
  }
  if (need === "watch") {
    return ["destination", "transitCountry", "productCode", "hs6", "incoterm"];
  }
  if (need === "invoice") {
    return ["destination", "incoterm", "currency", "paymentTerm", "distributionChannel"];
  }
  if (need === "landed_cost") {
    return [
      "destination",
      "productCode",
      "hs6",
      "incoterm",
      "transportMode",
      "currency",
      "paymentTerm",
      "weightBand",
      "volumeBand",
      "valueBand",
      "insurance",
    ];
  }
  if (need === "tower") {
    return ["destination", "productCode", "currency", "distributionChannel", "transportMode"];
  }
  if (need === "advisory") {
    return ["destination", "productCode", "hs6", "incoterm", "paymentTerm", "transportMode"];
  }
  return [];
}

function localizeOption(option: LocalizedOption, lang: UiLang) {
  return lang === "en" ? option.label_en : option.label_fr;
}

function getNeedLabel(need: NeedValue | "", lang: UiLang) {
  const found = NEED_OPTIONS.find((item) => item.value === need);
  return found ? localizeOption(found, lang) : "-";
}

function getOperationLabel(operation: string, lang: UiLang) {
  const found = OPERATION_TYPES.find((item) => item.value === operation);
  return found ? localizeOption(found, lang) : "-";
}

function getValueLabel(key: QuestionKey, value: string, lang: UiLang) {
  if (!value) return "-";

  if (key === "destination" || key === "transitCountry") {
    if (value === "none") return lang === "en" ? "None" : "Aucun";
    return getCountryLabel(value, lang);
  }

  if (key === "productCode") {
    const product = getProductByCode(value);
    if (!product) return value;
    return lang === "en" ? product.label_en : product.label_fr;
  }

  if (key === "hs6") {
    const item = HS_OPTIONS.find((opt) => opt.value === value);
    return item ? localizeOption(item, lang) : value;
  }

  const lookup: Record<QuestionKey, LocalizedOption[] | null> = {
    destination: null,
    transitCountry: null,
    productCode: null,
    hs6: HS_OPTIONS,
    incoterm: INCOTERMS,
    transportMode: TRANSPORT_MODES,
    currency: CURRENCIES,
    paymentTerm: PAYMENT_TERMS,
    distributionChannel: DISTRIBUTION_CHANNELS,
    weightBand: WEIGHT_BANDS,
    volumeBand: VOLUME_BANDS,
    valueBand: VALUE_BANDS,
    insurance: YES_NO_OPTIONS,
  };

  const list = lookup[key];
  const found = list?.find((item) => item.value === value);
  return found ? localizeOption(found, lang) : value;
}

function getFieldOptions(key: QuestionKey, lang: UiLang) {
  if (key === "destination") {
    return COUNTRIES.map((country) => ({ value: country.iso2, label: lang === "en" ? country.label_en : country.label_fr }));
  }
  if (key === "transitCountry") {
    return [
      { value: "none", label: lang === "en" ? "No transit" : "Sans transit" },
      ...COUNTRIES.map((country) => ({
        value: country.iso2,
        label: lang === "en" ? country.label_en : country.label_fr,
      })),
    ];
  }
  if (key === "productCode") {
    return PRODUCTS.map((product) => ({
      value: product.code,
      label: lang === "en" ? `${product.label_en} (${product.hs6})` : `${product.label_fr} (${product.hs6})`,
    }));
  }

  const lists: Record<QuestionKey, LocalizedOption[] | null> = {
    destination: null,
    transitCountry: null,
    productCode: null,
    hs6: HS_OPTIONS,
    incoterm: INCOTERMS,
    transportMode: TRANSPORT_MODES,
    currency: CURRENCIES,
    paymentTerm: PAYMENT_TERMS,
    distributionChannel: DISTRIBUTION_CHANNELS,
    weightBand: WEIGHT_BANDS,
    volumeBand: VOLUME_BANDS,
    valueBand: VALUE_BANDS,
    insurance: YES_NO_OPTIONS,
  };

  const list = lists[key] || [];
  return list.map((option) => ({ value: option.value, label: localizeOption(option, lang) }));
}

function buildResponseSections(state: WizardState, lang: UiLang) {
  const product = getProductByCode(state.productCode);
  const productLabel = product ? (lang === "en" ? product.label_en : product.label_fr) : state.productCode;
  const destinationLabel = getCountryLabel(state.destination, lang);
  const need = state.need;

  const common = {
    summary:
      lang === "en"
        ? `Scope confirmed for ${state.operationType} to ${destinationLabel} on ${productLabel || "selected product"}.`
        : `Demande validee pour ${state.operationType} vers ${destinationLabel} sur ${productLabel || "le produit selectionne"}.`,
    thanks:
      lang === "en"
        ? "Thank you. Here is your structured action plan."
        : "Merci. Voici votre plan d'action structure.",
  };

  if (need === "invoice") {
    return {
      ...common,
      sections: [
        {
          title: lang === "en" ? "Invoice checks" : "Controles facture",
          items: lang === "en"
            ? [
                "Validate invoice number, date, seller and buyer identity.",
                `Confirm Incoterm ${state.incoterm || "-"} and currency ${state.currency || "-"}.`,
                "Check line totals, tax consistency and payment term alignment.",
              ]
            : [
                "Verifier numero facture, date, identite vendeur et acheteur.",
                `Confirmer l'Incoterm ${state.incoterm || "-"} et la devise ${state.currency || "-"}.`,
                "Controler la coherence des lignes, totaux et mode de paiement.",
              ],
        },
        {
          title: lang === "en" ? "Recommended documents" : "Documents recommandes",
          items: lang === "en"
            ? ["Commercial invoice", "Packing list", "Transport document (BL/AWB/CMR)", "Certificate of origin when required"]
            : ["Facture commerciale", "Packing list", "Document de transport (BL/AWB/CMR)", "Certificat d'origine si requis"],
        },
      ],
      links: [
        { label: "Access2Markets", url: OFFICIAL_LINKS.access2markets },
        { label: "TARIC", url: OFFICIAL_LINKS.taric },
      ],
      ctaPath: "/verifier-facture",
    };
  }

  if (need === "watch") {
    return {
      ...common,
      sections: [
        {
          title: lang === "en" ? "Sanctions and compliance watch" : "Veille sanctions et conformite",
          items: lang === "en"
            ? [
                `Run sanctions screening for destination ${destinationLabel}.`,
                "Verify product-specific restrictions and licensing obligations.",
                "Track legal updates before shipment confirmation.",
              ]
            : [
                `Lancer un screening sanctions pour la destination ${destinationLabel}.`,
                "Verifier les restrictions produit et obligations de licence.",
                "Suivre les mises a jour reglementaires avant expédition.",
              ],
        },
        {
          title: lang === "en" ? "Priority controls" : "Points de controle prioritaires",
          items: lang === "en"
            ? ["Restricted parties", "Dual-use exposure", "Contract compliance clause"]
            : ["Parties restreintes", "Exposition dual-use", "Clause contractuelle de conformite"],
        },
      ],
      links: [
        { label: "EU Sanctions", url: OFFICIAL_LINKS.eu_sanctions },
        { label: "OFAC", url: OFFICIAL_LINKS.ofac },
        { label: "UN Sanctions", url: OFFICIAL_LINKS.un_sanctions },
      ],
      ctaPath: "/veille",
    };
  }

  if (need === "landed_cost") {
    return {
      ...common,
      sections: [
        {
          title: lang === "en" ? "Landed cost framing" : "Cadrage prix rendu",
          items: lang === "en"
            ? [
                "Start from EXW and add pre-carriage, main transport, insurance and import costs.",
                `Use ${state.transportMode || "selected"} transport assumptions and update duties/ VAT estimate.`,
                "Confirm final Incoterm responsibility split before quotation.",
              ]
            : [
                "Partir de l'EXW puis ajouter pre-acheminement, transport principal, assurance et import.",
                `Appliquer des hypotheses ${state.transportMode || "transport"} puis ajuster droits/TVA estimatifs.`,
                "Valider la repartition des responsabilites selon l'Incoterm final.",
              ],
        },
        {
          title: lang === "en" ? "Optimization levers" : "Leviers d'optimisation",
          items: lang === "en"
            ? ["Consolidate shipments", "Negotiate freight by weight bands", "Review DAP vs DDP based on local setup"]
            : ["Consolider les envois", "Negocier le fret par tranches de poids", "Comparer DAP vs DDP selon votre organisation locale"],
        },
      ],
      links: [
        { label: "Access2Markets", url: OFFICIAL_LINKS.access2markets },
        { label: "ICC Incoterms", url: OFFICIAL_LINKS.incoterms_icc },
      ],
      ctaPath: "/taxes-om",
    };
  }

  if (need === "tower") {
    return {
      ...common,
      sections: [
        {
          title: lang === "en" ? "Control Tower setup" : "Mise en place Control Tower",
          items: lang === "en"
            ? [
                "Upload CSV/XLSX and map columns (country/product/amount/currency/channel).",
                "Track top products by country and profitability after logistics assumptions.",
                "Add manual lines to complete missing activity data.",
              ]
            : [
                "Importer un CSV/XLSX et mapper les colonnes (pays/produit/montant/devise/canal).",
                "Suivre les top produits par pays et la rentabilite apres hypotheses logistiques.",
                "Ajouter des lignes manuelles pour completer l'activite.",
              ],
        },
        {
          title: lang === "en" ? "Suggested KPIs" : "KPI recommandes",
          items: lang === "en"
            ? ["Top products per destination", "Most profitable countries", "Best-performing channels"]
            : ["Produits les plus vendus par destination", "Pays les plus rentables", "Canaux les plus performants"],
        },
      ],
      links: [{ label: "MPL Guide", url: OFFICIAL_LINKS.access2markets }],
      ctaPath: "/control-tower",
    };
  }

  if (need === "advisory") {
    return {
      ...common,
      sections: [
        {
          title: lang === "en" ? "Advisory scope" : "Perimetre conseil",
          items: lang === "en"
            ? [
                "Export compliance audit and process hardening.",
                "Contract clauses review (risk transfer, payment, sanctions, governing law).",
                "Cost and Incoterm optimization with action plan.",
              ]
            : [
                "Audit conformite export et fiabilisation des process.",
                "Revue des clauses contractuelles (risque, paiement, sanctions, droit applicable).",
                "Optimisation couts et Incoterms avec plan d'action.",
              ],
        },
      ],
      links: [{ label: lang === "en" ? "Contact form" : "Formulaire contact", url: "/contact?offer=audit" }],
      ctaPath: "/services",
    };
  }

  return {
    ...common,
    sections: [
      {
        title: lang === "en" ? "Export guide" : "Guide export",
        items: lang === "en"
          ? [
              "Validate destination and HS code before committing the quote.",
              "Align Incoterm and payment method with risk tolerance.",
              "Prepare documents and compliance checks early.",
            ]
          : [
              "Valider destination et HS avant d'engager le devis.",
              "Aligner Incoterm et mode de paiement avec le risque accepte.",
              "Preparer les documents et controles conformite en amont.",
            ],
      },
      {
        title: lang === "en" ? "Useful links" : "Liens utiles",
        items: [OFFICIAL_LINKS.access2markets, OFFICIAL_LINKS.taric, OFFICIAL_LINKS.douane_fr],
      },
    ],
    links: [
      { label: "Access2Markets", url: OFFICIAL_LINKS.access2markets },
      { label: "TARIC", url: OFFICIAL_LINKS.taric },
      { label: "Douane", url: OFFICIAL_LINKS.douane_fr },
    ],
    ctaPath: "/guides",
  };
}

export function GuidedAssistantWizard({ inApp = false }: { inApp?: boolean }) {
  const navigate = useNavigate();
  const { lang } = useI18n();
  const isEn = lang === "en";

  const [state, setState] = React.useState<WizardState>(INITIAL_STATE);
  const [step, setStep] = React.useState<1 | 2 | 3 | 4 | 5>(1);
  const [questionIndex, setQuestionIndex] = React.useState(0);
  const [feedback, setFeedback] = React.useState<FeedbackValue>(null);

  const questionFlow = React.useMemo(() => getFlowByNeed(state.need), [state.need]);
  const currentKey = questionFlow[questionIndex] || null;
  const currentConfig = currentKey ? QUESTION_BANK[currentKey] : null;

  const resultPayload = React.useMemo(() => {
    if (step < 5) return null;
    return buildResponseSections(state, lang);
  }, [lang, state, step]);

  const nextDisabled = React.useMemo(() => {
    if (!currentKey) return true;
    return !state[currentKey];
  }, [currentKey, state]);

  const updateState = React.useCallback((patch: Partial<WizardState>) => {
    setState((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleRoleSelection = (value: string) => {
    updateState({ operationType: value });
    setStep(2);
  };

  const handleNeedSelection = (value: NeedValue) => {
    updateState({ need: value });
    setQuestionIndex(0);
    setStep(3);
  };

  const handleAnswer = (value: string) => {
    if (!currentKey) return;

    if (currentKey === "productCode") {
      const product = getProductByCode(value);
      updateState({ productCode: value, hs6: product?.hs6 || state.hs6 });
      return;
    }

    updateState({ [currentKey]: value } as Partial<WizardState>);
  };

  const goNextQuestion = () => {
    if (questionIndex + 1 < questionFlow.length) {
      setQuestionIndex((prev) => prev + 1);
      return;
    }
    setStep(4);
  };

  const goPreviousQuestion = () => {
    if (questionIndex > 0) {
      setQuestionIndex((prev) => prev - 1);
      return;
    }
    setStep(2);
  };

  const resetWizard = () => {
    setState(INITIAL_STATE);
    setStep(1);
    setQuestionIndex(0);
    setFeedback(null);
  };

  const launchStructuredAnswer = () => {
    updateState({ optionalComment: sanitizeOptionalComment(state.optionalComment) });
    setStep(5);
    setFeedback(null);
  };

  const jumpToCorrection = (key: QuestionKey) => {
    const target = questionFlow.findIndex((field) => field === key);
    if (target >= 0) {
      setQuestionIndex(target);
      setStep(3);
      setFeedback(null);
    }
  };

  const wrapperClassName = inApp ? "space-y-5" : "space-y-4";

  return (
    <Card className={wrapperClassName}>
      <CardHeader>
        <CardTitle>
          {isEn
            ? "Hello, I help you secure your import/export decisions"
            : "Bonjour, je vous aide a securiser une decision export/import"}
        </CardTitle>
        <CardDescription>
          {isEn
            ? "Guided assistant: one question at a time, controlled options only."
            : "Assistant guide: une question a la fois, avec options controlees uniquement."}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="flex flex-wrap gap-2">
          <Badge variant={step >= 1 ? "default" : "outline"}>1. {isEn ? "Operation" : "Operation"}</Badge>
          <Badge variant={step >= 2 ? "default" : "outline"}>2. {isEn ? "Need" : "Besoin"}</Badge>
          <Badge variant={step >= 3 ? "default" : "outline"}>3. {isEn ? "Questions" : "Questions"}</Badge>
          <Badge variant={step >= 4 ? "default" : "outline"}>4. {isEn ? "Summary" : "Synthese"}</Badge>
          <Badge variant={step >= 5 ? "default" : "outline"}>5. {isEn ? "Answer" : "Reponse"}</Badge>
        </div>

        {step === 1 ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {isEn ? "You are mainly:" : "Vous etes plutot :"}
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {OPERATION_TYPES.map((option) => (
                <Button
                  key={option.value}
                  variant={state.operationType === option.value ? "default" : "outline"}
                  onClick={() => handleRoleSelection(option.value)}
                >
                  {getLocalizedLabel(option, lang)}
                </Button>
              ))}
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {isEn ? "What is your main need?" : "Quel est votre besoin principal ?"}
            </p>
            <Select value={state.need} onValueChange={(value) => handleNeedSelection(value as NeedValue)}>
              <SelectTrigger>
                <SelectValue placeholder={isEn ? "Select one need" : "Selectionnez un besoin"} />
              </SelectTrigger>
              <SelectContent>
                {NEED_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {getLocalizedLabel(option, lang)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => setStep(1)}>
              <ChevronLeft className="mr-1 h-4 w-4" />
              {isEn ? "Back" : "Retour"}
            </Button>
          </div>
        ) : null}

        {step === 3 && currentConfig && currentKey ? (
          <div className="space-y-4">
            <div className="rounded-xl border bg-muted/30 p-3">
              <div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                {isEn
                  ? `Question ${questionIndex + 1} of ${questionFlow.length}`
                  : `Question ${questionIndex + 1} sur ${questionFlow.length}`}
              </div>
              <div className="mt-1 text-sm font-semibold">
                {lang === "en" ? currentConfig.title_en : currentConfig.title_fr}
              </div>
              <div className="text-xs text-muted-foreground">
                {lang === "en" ? currentConfig.helper_en : currentConfig.helper_fr}
              </div>
            </div>

            <Select value={state[currentKey]} onValueChange={handleAnswer}>
              <SelectTrigger>
                <SelectValue placeholder={isEn ? "Choose one option" : "Choisissez une option"} />
              </SelectTrigger>
              <SelectContent>
                {getFieldOptions(currentKey, lang).map((option) => (
                  <SelectItem key={`${currentKey}-${option.value}`} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex flex-wrap justify-between gap-2">
              <Button variant="outline" onClick={goPreviousQuestion}>
                <ChevronLeft className="mr-1 h-4 w-4" />
                {isEn ? "Back" : "Retour"}
              </Button>
              <Button onClick={goNextQuestion} disabled={nextDisabled}>
                {questionIndex + 1 < questionFlow.length ? (isEn ? "Next" : "Suivant") : isEn ? "Review" : "Voir la synthese"}
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="space-y-4">
            <div className="rounded-xl border bg-muted/20 p-4">
              <p className="text-sm font-semibold">{isEn ? "Your request summary" : "Votre demande"}</p>
              <div className="mt-3 grid gap-2 text-sm md:grid-cols-2">
                <div>{isEn ? "Operation" : "Operation"}: <b>{getOperationLabel(state.operationType, lang)}</b></div>
                <div>{isEn ? "Need" : "Besoin"}: <b>{getNeedLabel(state.need, lang)}</b></div>
                {questionFlow.map((fieldKey) => (
                  <div key={`summary-${fieldKey}`}>
                    {lang === "en" ? QUESTION_BANK[fieldKey].title_en : QUESTION_BANK[fieldKey].title_fr}: <b>{getValueLabel(fieldKey, state[fieldKey], lang)}</b>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                {isEn ? "Optional precision (free text, optional)" : "Precision optionnelle (texte libre, optionnel)"}
              </p>
              <Textarea
                rows={3}
                value={state.optionalComment}
                onChange={(event) => updateState({ optionalComment: event.target.value })}
                placeholder={isEn ? "Any specific context you want to add" : "Contexte complementaire a ajouter"}
              />
            </div>

            <div className="flex flex-wrap justify-between gap-2">
              <Button variant="outline" onClick={() => setStep(3)}>
                <ChevronLeft className="mr-1 h-4 w-4" />
                {isEn ? "Edit answers" : "Modifier les reponses"}
              </Button>
              <Button onClick={launchStructuredAnswer}>
                {isEn ? "Generate structured answer" : "Generer la reponse structuree"}
              </Button>
            </div>
          </div>
        ) : null}

        {step === 5 && resultPayload ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <CheckCircle2 className="h-4 w-4" />
                {resultPayload.thanks}
              </p>
              <p className="mt-1 text-sm">{resultPayload.summary}</p>
            </div>

            {resultPayload.sections.map((section) => (
              <div key={section.title} className="rounded-xl border p-4">
                <p className="text-sm font-semibold">{section.title}</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {section.items.map((item) => (
                    <li key={`${section.title}-${item}`}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}

            <div className="rounded-xl border bg-muted/20 p-4">
              <p className="text-sm font-semibold">{isEn ? "Official links" : "Liens officiels"}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {resultPayload.links.map((link) => (
                  <a
                    key={link.url}
                    href={link.url}
                    target={link.url.startsWith("/") ? undefined : "_blank"}
                    rel={link.url.startsWith("/") ? undefined : "noreferrer"}
                    className="rounded-full border px-3 py-1 text-xs hover:bg-muted"
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            </div>

            <div className="rounded-xl border bg-card p-4">
              <p className="text-sm font-semibold">
                {isEn ? "Did this answer help you?" : "Ces reponses vous ont aide ?"}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button variant={feedback === "yes" ? "default" : "outline"} onClick={() => setFeedback("yes")}>Oui</Button>
                <Button variant={feedback === "no" ? "default" : "outline"} onClick={() => setFeedback("no")}>Non</Button>
              </div>

              {feedback === "yes" ? (
                <p className="mt-3 text-sm text-emerald-700">
                  {isEn
                    ? "Perfect. Thank you, your next step is available below."
                    : "Parfait. Merci, vous pouvez passer a l'etape suivante ci-dessous."}
                </p>
              ) : null}

              {feedback === "no" ? (
                <div className="mt-3 space-y-2">
                  <p className="text-sm text-amber-700">
                    {isEn ? "Let's correct the key parameters:" : "Corrigeons les parametres cles :"}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => jumpToCorrection("destination")}>
                      {isEn ? "Change country" : "Changer le pays"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => jumpToCorrection("productCode")}>
                      {isEn ? "Refine product" : "Preciser le produit"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => jumpToCorrection("incoterm")}>
                      {isEn ? "Choose Incoterm" : "Choisir l'Incoterm"}
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>

            <Separator />

            <div className="rounded-xl border bg-muted/20 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <CircleHelp className="h-4 w-4" />
                {isEn ? "Need an audit or quote?" : "Besoin d'un audit ou d'un devis ?"}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button onClick={() => navigate(resultPayload.ctaPath)}>
                  {isEn ? "Open related tool" : "Ouvrir l'outil associe"}
                </Button>
                <Button variant="outline" onClick={() => navigate("/contact?offer=audit")}>Contact / Devis</Button>
                <Button variant="ghost" onClick={resetWizard}>
                  <MessageCircleWarning className="mr-1 h-4 w-4" />
                  {isEn ? "Start again" : "Recommencer"}
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function WizardEntry() {
  return <GuidedAssistantWizard inApp={false} />;
}
