import { COUNTRIES } from "@/lib/constants";
import { resolveCountryIso2 } from "@/lib/copilot/officialLinks";

export type DealCheckLang = "fr" | "en";
export type DealDecision = "GO" | "SOUS_CONDITIONS" | "NO_GO";
export type CheckState = "OK" | "A_CONFIRMER" | "MANQUANT" | "KO";

export type DealComplianceInput = {
  lang: DealCheckLang;
  flow?: "import" | "export" | "unknown";
  fromCountry?: string | null;
  toCountry?: string | null;
  productText?: string | null;
  value?: number | null;
  currency?: string | null;
  incoterm?: string | null;
};

export type HsProposal = {
  hs6: string;
  label: string;
  confidence: number;
  reason: string;
};

export type DealComplianceCheckItem = {
  id: string;
  label: string;
  status: CheckState;
  explanation: string;
};

export type DealComplianceOutput = {
  decision: DealDecision;
  summary: string;
  checklist: DealComplianceCheckItem[];
  risks: string[];
  actions: string[];
  priority_question: string;
  hs_suggestions: HsProposal[];
  country_rules: string[];
};

const EU_ISO2 = new Set([
  "AT",
  "BE",
  "BG",
  "HR",
  "CY",
  "CZ",
  "DK",
  "EE",
  "FI",
  "FR",
  "DE",
  "GR",
  "HU",
  "IE",
  "IT",
  "LV",
  "LT",
  "LU",
  "MT",
  "NL",
  "PL",
  "PT",
  "RO",
  "SK",
  "SI",
  "ES",
  "SE",
]);

const HARD_STOP_COUNTRIES = new Set(["RU", "IR", "KP", "SY"]);
const WARN_COUNTRIES = new Set(["BY", "CU"]);

const COUNTRY_RULES: Record<string, { fr: string[]; en: string[] }> = {
  CN: {
    fr: ["Verifier etiquetage local, certificat d'origine et exigences de conformity selon categorie produit."],
    en: ["Check local labeling, certificate of origin, and conformity requirements for the product category."],
  },
  US: {
    fr: ["Verifier exigences FDA/CBP selon produit et confirmer responsabilite importateur sous Incoterm."],
    en: ["Check FDA/CBP requirements by product and confirm importer responsibility under selected Incoterm."],
  },
  JP: {
    fr: ["Verifier normes techniques japonaises et documents de dedouanement avant expedition."],
    en: ["Check Japanese technical standards and customs documents before shipment."],
  },
  GB: {
    fr: ["Post-Brexit: verifier UK customs declarations et marquage/regles produit applicables."],
    en: ["Post-Brexit: verify UK customs declarations and applicable product marking/rules."],
  },
  CA: {
    fr: ["Verifier exigences d'importation canadiennes et taxes provinciales selon destination finale."],
    en: ["Check Canadian import requirements and provincial taxes based on final destination."],
  },
};

const HS_KEYWORDS: Array<{ hs6: string; fr: string; en: string; keywords: string[] }> = [
  { hs6: "080390", fr: "Bananes fraiches ou sechees", en: "Fresh or dried bananas", keywords: ["banane", "banana"] },
  { hs6: "070200", fr: "Tomates fraiches", en: "Fresh tomatoes", keywords: ["tomate", "tomato"] },
  { hs6: "640399", fr: "Chaussures", en: "Footwear", keywords: ["chaussure", "shoe", "sandal"] },
  { hs6: "870899", fr: "Pieces et accessoires automobiles", en: "Motor vehicle parts and accessories", keywords: ["piece auto", "brake", "frein", "automobile", "car part"] },
  { hs6: "330499", fr: "Produits de beaute et soins", en: "Beauty and skin-care products", keywords: ["cosmetique", "beauty", "cream", "skin"] },
  { hs6: "847130", fr: "Ordinateurs portables", en: "Laptop computers", keywords: ["laptop", "ordinateur", "pc"] },
  { hs6: "852349", fr: "Supports logiciels et donnees", en: "Software and data media", keywords: ["logiciel", "software", "saas"] },
];

function n(value: string) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function text(lang: DealCheckLang, fr: string, en: string) {
  return lang === "en" ? en : fr;
}

function inferCountry(value: string | null | undefined) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const asIso = raw.toUpperCase();
  if (/^[A-Z]{2}$/.test(asIso)) return asIso;
  return resolveCountryIso2(raw);
}

function countryName(iso2: string | null, lang: DealCheckLang) {
  if (!iso2) return null;
  const found = COUNTRIES.find((country) => country.iso2 === iso2);
  if (!found) return iso2;
  return lang === "en" ? found.label_en : found.label_fr;
}

function inferFlow(input: DealComplianceInput, fromIso: string | null, toIso: string | null) {
  if (input.flow && input.flow !== "unknown") return input.flow;
  if (fromIso === "FR" && toIso && toIso !== "FR") return "export";
  if (toIso === "FR" && fromIso && fromIso !== "FR") return "import";
  return "unknown";
}

function hsAssist(productText: string, lang: DealCheckLang): HsProposal[] {
  const normalized = n(productText);
  if (!normalized) return [];

  const hits = HS_KEYWORDS.filter((entry) => entry.keywords.some((keyword) => normalized.includes(n(keyword))));
  if (!hits.length) {
    return [
      {
        hs6: "000000",
        label: text(lang, "Produit a preciser pour classification HS", "Product must be specified before HS classification"),
        confidence: 0.25,
        reason: text(lang, "Description trop generale", "Description too generic"),
      },
    ];
  }

  return hits.slice(0, 3).map((entry, index) => ({
    hs6: entry.hs6,
    label: lang === "en" ? entry.en : entry.fr,
    confidence: Number((0.82 - index * 0.16).toFixed(2)),
    reason: text(lang, "Correspondance mots-cle produit", "Product keyword match"),
  }));
}

function sameZoneEu(fromIso: string | null, toIso: string | null) {
  return Boolean(fromIso && toIso && EU_ISO2.has(fromIso) && EU_ISO2.has(toIso));
}

export function dealComplianceCheck(input: DealComplianceInput): DealComplianceOutput {
  const lang = input.lang || "fr";
  const toIso = inferCountry(input.toCountry);
  const fromIso = inferCountry(input.fromCountry) || "FR";
  const flow = inferFlow(input, fromIso, toIso);
  const product = String(input.productText || "").trim();
  const incoterm = String(input.incoterm || "").trim().toUpperCase();
  const value = Number(input.value || 0);
  const hsSuggestions = hsAssist(product, lang);
  const isWithinEu = sameZoneEu(fromIso, toIso);
  const toLabel = countryName(toIso, lang);

  let decision: DealDecision = "GO";
  const checklist: DealComplianceCheckItem[] = [];
  const risks: string[] = [];
  const actions: string[] = [];

  if (!toIso) {
    decision = "SOUS_CONDITIONS";
  }
  if (!product) {
    decision = "SOUS_CONDITIONS";
  }
  if (toIso && HARD_STOP_COUNTRIES.has(toIso)) {
    decision = "NO_GO";
  }

  checklist.push({
    id: "destination",
    label: text(lang, "Pays destination", "Destination country"),
    status: toIso ? "OK" : "MANQUANT",
    explanation: toIso
      ? text(lang, `Destination detectee: ${toLabel || toIso}.`, `Destination detected: ${toLabel || toIso}.`)
      : text(lang, "Pays destination manquant.", "Missing destination country."),
  });

  checklist.push({
    id: "product",
    label: text(lang, "Produit + usage", "Product + end use"),
    status: product ? "OK" : "MANQUANT",
    explanation: product
      ? text(lang, "Description produit fournie.", "Product description provided.")
      : text(lang, "Description produit manquante pour classifier HS.", "Missing product description for HS classification."),
  });

  checklist.push({
    id: "incoterm",
    label: "Incoterm",
    status: incoterm ? "OK" : "A_CONFIRMER",
    explanation: incoterm
      ? text(lang, `Incoterm renseigne: ${incoterm}.`, `Incoterm provided: ${incoterm}.`)
      : text(lang, "Incoterm non renseigne.", "Incoterm not provided."),
  });

  checklist.push({
    id: "value",
    label: text(lang, "Valeur commerciale", "Commercial value"),
    status: value > 0 ? "OK" : "A_CONFIRMER",
    explanation: value > 0 ? text(lang, "Valeur exploitable fournie.", "Usable commercial value provided.") : text(lang, "Valeur manquante ou nulle.", "Value missing or zero."),
  });

  if (flow !== "unknown") {
    checklist.push({
      id: "flow",
      label: text(lang, "Flux import/export", "Import/export flow"),
      status: "OK",
      explanation: text(
        lang,
        `Flux detecte: ${flow === "export" ? "export" : "import"}.`,
        `Flow detected: ${flow === "export" ? "export" : "import"}.`
      ),
    });
  }

  const countryRules = toIso ? COUNTRY_RULES[toIso]?.[lang] || [] : [];

  if (toIso && HARD_STOP_COUNTRIES.has(toIso)) {
    risks.push(text(lang, "Risque sanctions majeur sur pays destination.", "Major sanctions risk on destination country."));
    actions.push(
      text(lang, "Suspendre le deal et lancer une revue compliance complete.", "Hold the deal and run a full compliance review.")
    );
  }
  if (!incoterm) {
    risks.push(text(lang, "Risque litige couts/risques sans Incoterm.", "Cost/risk dispute exposure without Incoterm."));
    actions.push(text(lang, "Definir Incoterm + lieu (ex: FCA Lyon).", "Set Incoterm + place (e.g. FCA Lyon)."));
  }
  if (hsSuggestions[0]?.hs6 === "000000") {
    risks.push(text(lang, "Droits et taxes incertains sans HS fiable.", "Duties and taxes uncertain without reliable HS."));
    actions.push(text(lang, "Confirmer produit/usage pour classer HS6.", "Confirm product/use to classify HS6."));
  }
  if (toIso && WARN_COUNTRIES.has(toIso)) {
    risks.push(text(lang, "Pays sensible: screening parties et banques renforce.", "Sensitive country: reinforced party and bank screening."));
  }
  if (isWithinEu) {
    actions.push(
      text(
        lang,
        "Verifier regime TVA intracommunautaire (B2B/B2C) et preuve de transport.",
        "Check intra-EU VAT regime (B2B/B2C) and transport proof."
      )
    );
  } else if (flow === "export") {
    actions.push(
      text(
        lang,
        "Verifier formalites export, documents douane et exigences import du pays cible.",
        "Validate export formalities, customs docs, and import requirements in destination country."
      )
    );
  } else if (flow === "import") {
    actions.push(
      text(
        lang,
        "Verifier droits a l'import, TVA import et responsabilite declarative.",
        "Check import duties, import VAT, and declarative responsibility."
      )
    );
  }

  const priorityQuestion = !product
    ? text(
        lang,
        "Quel est le produit exact (nom commercial + composition + usage) ?",
        "What is the exact product (commercial name + composition + end use)?"
      )
    : !toIso
      ? text(lang, "Quel est le pays destination exact (ISO2 ou nom) ?", "What is the exact destination country (ISO2 or country name)?")
      : !incoterm
        ? text(lang, "Quel Incoterm est prevu (EXW/FCA/FOB/CIF/DAP/DDP) ?", "Which Incoterm is planned (EXW/FCA/FOB/CIF/DAP/DDP)?")
        : hsSuggestions[0]?.hs6 === "000000"
          ? text(lang, "Pouvez-vous preciser l'usage du produit pour fiabiliser le HS ?", "Can you clarify product end use to improve HS classification?")
          : text(lang, "Quel est le mode de transport principal ?", "What is the main transport mode?");

  const summary =
    decision === "NO_GO"
      ? text(lang, "NO-GO provisoire: risque sanctions eleve.", "Provisional NO-GO: high sanctions risk.")
      : decision === "SOUS_CONDITIONS"
        ? text(lang, "Sous conditions: infos critiques manquantes avant engagement.", "Conditional: critical data is missing before commitment.")
        : text(lang, "GO provisoire: deal exploitable avec controles standards.", "Provisional GO: deal can move with standard controls.");

  return {
    decision,
    summary,
    checklist: checklist.slice(0, 5),
    risks: risks.slice(0, 3),
    actions: actions.slice(0, 3),
    priority_question: priorityQuestion,
    hs_suggestions: hsSuggestions.slice(0, 3),
    country_rules: countryRules.slice(0, 2),
  };
}

