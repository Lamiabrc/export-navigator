import { COUNTRIES } from "@/lib/constants";

import type { TransactionContext, VatResult, VatResultStatus } from "./types";

const EU_ISO2 = new Set([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT",
  "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE",
]);

const VIES_LINK = "https://ec.europa.eu/taxation_customs/vies/";

function normalizeIso2(value: string) {
  return String(value || "").trim().toUpperCase();
}

function isEuCountry(iso2: string) {
  return EU_ISO2.has(normalizeIso2(iso2));
}

function countryExists(iso2: string) {
  const target = normalizeIso2(iso2);
  return COUNTRIES.some((country) => country.iso2 === target);
}

function normalizeVat(value: string) {
  return String(value || "").replace(/\s+/g, "").toUpperCase();
}

function isValidVatFormat(vat: string, countryIso2?: string) {
  const value = normalizeVat(vat);
  if (!value) return false;
  if (!/^[A-Z]{2}[A-Z0-9]{2,12}$/.test(value)) return false;
  if (!countryIso2) return true;
  return value.startsWith(normalizeIso2(countryIso2));
}

function buildUnknown(reason: string, questions: string[]): VatResult {
  return {
    status: "UNKNOWN",
    reason,
    required_invoice_mentions: [],
    missing_questions: capMissingQuestions(questions),
    vies_validation: {
      seller_format_ok: false,
      buyer_format_ok: false,
      vies_link: VIES_LINK,
    },
  };
}

function capMissingQuestions(questions: string[]) {
  return Array.from(new Set(questions.filter(Boolean))).slice(0, 2);
}

function resolvedFlow(context: TransactionContext): "import" | "export" {
  if (context.flowDirection === "import" || context.flowDirection === "export") {
    return context.flowDirection;
  }

  const seller = normalizeIso2(context.sellerCountry);
  const buyer = normalizeIso2(context.buyerCountry);
  if (seller === "FR" && buyer !== "FR") return "export";
  if (buyer === "FR" && seller !== "FR") return "import";
  return "export";
}

export type VatEngineInput = Pick<
  TransactionContext,
  | "goodsOrServices"
  | "flowDirection"
  | "sellerCountry"
  | "buyerCountry"
  | "buyerIsTaxable"
  | "sellerVat"
  | "buyerVat"
  | "proofOfTransport"
> & { isEU?: boolean };

export function evaluateVat(input: VatEngineInput): VatResult {
  const sellerCountry = normalizeIso2(input.sellerCountry);
  const buyerCountry = normalizeIso2(input.buyerCountry);
  const goodsOrServices = input.goodsOrServices;

  if (!sellerCountry || !countryExists(sellerCountry)) {
    return buildUnknown("Pays vendeur manquant ou invalide.", ["Quel est le pays vendeur (ISO2) ?"]);
  }
  if (!buyerCountry || !countryExists(buyerCountry)) {
    return buildUnknown("Pays acheteur manquant ou invalide.", ["Quel est le pays acheteur (ISO2) ?"]);
  }

  const sellerInEu = isEuCountry(sellerCountry);
  const buyerInEu = isEuCountry(buyerCountry);
  const isEU = typeof input.isEU === "boolean" ? input.isEU : sellerInEu && buyerInEu;

  const sellerVatOk = isValidVatFormat(input.sellerVat, sellerCountry);
  const buyerVatOk = isValidVatFormat(input.buyerVat, buyerCountry);

  const flow = resolvedFlow({
    ...input,
    currency: "EUR",
    exchangeRate: null,
    incoterm: "",
    incotermPlace: "",
  } as TransactionContext);

  if (goodsOrServices === "goods") {
    if (sellerCountry === "FR" && buyerCountry === "FR") {
      return {
        status: "VAT_APPLIES",
        reason: "Vente de biens en France: TVA francaise applicable par defaut.",
        required_invoice_mentions: ["TVA francaise applicable (CGI art. 256)."],
        missing_questions: [],
        vies_validation: {
          seller_format_ok: sellerVatOk,
          buyer_format_ok: buyerVatOk,
          vies_link: VIES_LINK,
        },
      };
    }

    if (sellerCountry === "FR" && buyerInEu) {
      if (input.buyerIsTaxable && buyerVatOk && input.proofOfTransport) {
        return {
          status: "VAT_EXEMPT",
          reason: "Livraison intracommunautaire B2B avec numero TVA valide et preuve de transport.",
          required_invoice_mentions: [
            "Exoneration TVA, art. 262 ter-I du CGI.",
            "Numero TVA intracommunautaire du client.",
          ],
          missing_questions: [],
          vies_validation: {
            seller_format_ok: sellerVatOk,
            buyer_format_ok: buyerVatOk,
            vies_link: VIES_LINK,
          },
        };
      }

      const missingQuestions: string[] = [];
      if (!input.buyerIsTaxable) missingQuestions.push("Le client est-il assujetti TVA ?");
      if (!buyerVatOk) missingQuestions.push("Numero TVA acheteur manquant/invalide: verifier via VIES.");
      if (!input.proofOfTransport) missingQuestions.push("Disposez-vous d'une preuve de transport intra-UE ?");

      return {
        status: "VAT_APPLIES",
        reason: "Conditions d'exoneration intra-UE non completes; TVA applicable tant que les preuves manquent.",
        required_invoice_mentions: ["TVA francaise appliquee en attente des preuves d'exoneration."],
        missing_questions: capMissingQuestions(missingQuestions),
        vies_validation: {
          seller_format_ok: sellerVatOk,
          buyer_format_ok: buyerVatOk,
          vies_link: VIES_LINK,
        },
      };
    }

    if (sellerCountry === "FR" && !buyerInEu) {
      return {
        status: "VAT_EXEMPT",
        reason: "Export de biens hors UE: exoneration TVA sous reserve de preuve d'export.",
        required_invoice_mentions: ["Exoneration TVA - export hors UE (CGI art. 262-I)."],
        missing_questions: capMissingQuestions(["Avez-vous la preuve de sortie/export (DAU, MRN, transport) ?"]),
        vies_validation: {
          seller_format_ok: sellerVatOk,
          buyer_format_ok: buyerVatOk,
          vies_link: VIES_LINK,
        },
      };
    }

    if (flow === "import" && buyerCountry === "FR" && !sellerInEu) {
      return {
        status: "IMPORT_VAT",
        reason: "Importation de biens vers la France: TVA import due et autoliquidation selon identification TVA.",
        required_invoice_mentions: ["TVA import: autoliquidation sur CA3 si entreprise identifiee TVA."],
        missing_questions: [],
        vies_validation: {
          seller_format_ok: sellerVatOk,
          buyer_format_ok: buyerVatOk,
          vies_link: VIES_LINK,
        },
      };
    }
  }

  if (goodsOrServices === "services" && isEU && input.buyerIsTaxable) {
    return {
      status: "REVERSE_CHARGE",
      reason: "Prestation B2B UE: autoliquidation par le preneur (regle generale services).",
      required_invoice_mentions: ["Autoliquidation - TVA due par le preneur (reverse charge)."],
      missing_questions: [],
      vies_validation: {
        seller_format_ok: sellerVatOk,
        buyer_format_ok: buyerVatOk,
        vies_link: VIES_LINK,
      },
    };
  }

  const fallbackStatus: VatResultStatus = "UNKNOWN";
  const missingQuestions: string[] = [];
  if (!input.sellerVat) missingQuestions.push("Numero TVA vendeur manquant.");
  if (isEU && !input.buyerVat) missingQuestions.push("Numero TVA acheteur manquant.");
  if (!input.proofOfTransport && goodsOrServices === "goods" && sellerInEu && buyerInEu) {
    missingQuestions.push("Preuve de transport intra-UE manquante.");
  }

  return {
    status: fallbackStatus,
    reason: "Informations insuffisantes ou scenario hors regles standards; verification experte recommandee.",
    required_invoice_mentions: [],
    missing_questions: capMissingQuestions(missingQuestions),
    vies_validation: {
      seller_format_ok: sellerVatOk,
      buyer_format_ok: buyerVatOk,
      vies_link: VIES_LINK,
    },
  };
}

export function vatResultToChecks(vat: VatResult) {
  const status = vat.status === "UNKNOWN"
    ? "WARN"
    : vat.missing_questions.length > 0
      ? "WARN"
      : vat.status === "VAT_APPLIES" || vat.status === "VAT_EXEMPT" || vat.status === "REVERSE_CHARGE" || vat.status === "IMPORT_VAT"
        ? "OK"
        : "KO";

  const viesStatus = vat.vies_validation.seller_format_ok && vat.vies_validation.buyer_format_ok
    ? "OK"
    : "WARN";

  return [
    {
      id: "vat_status",
      label: "Statut TVA",
      status,
      explanation: vat.reason,
      what_to_fix:
        vat.status === "UNKNOWN"
          ? "Completer les donnees TVA (pays, assujettissement, numero TVA, preuve transport)."
          : "Verifier que la mention fiscale est bien presente sur la facture.",
      example: vat.required_invoice_mentions[0] || "Autoliquidation - TVA due par le preneur.",
      source_link:
        vat.status === "REVERSE_CHARGE" || vat.status === "VAT_EXEMPT"
          ? "https://www.impots.gouv.fr/"
          : "https://www.douane.gouv.fr/",
    },
    {
      id: "vat_vies_format",
      label: "Validation format TVA (VIES)",
      status: viesStatus,
      explanation: "Controle de format du numero TVA; verification VIES a effectuer pour validation officielle.",
      what_to_fix: "Corriger le format (ex: FR12345678901) puis verifier dans VIES.",
      example: "FRXX999999999",
      source_link: vat.vies_validation.vies_link,
    },
  ];
}

export function isEuIso2(code: string) {
  return isEuCountry(code);
}

export function isValidVatNumber(vat: string, countryIso2?: string) {
  return isValidVatFormat(vat, countryIso2);
}
