import { CURRENCIES } from "@/lib/constants";

import type { CheckerItem, FxCheckResult, InvoiceData, TransactionContext } from "./types";

const BERCY_LINK = "https://www.impots.gouv.fr/";

const ISO4217_EXTRA = new Set([
  "AED", "ARS", "BRL", "CLP", "COP", "CZK", "DKK", "EGP", "HUF", "INR", "KRW", "MXN", "NOK",
  "NZD", "PEN", "PLN", "QAR", "RON", "SAR", "SEK", "SGD", "THB", "TRY", "TWD", "UYU", "VND", "ZAR",
]);

const ISO4217 = new Set([...CURRENCIES.map((item) => item.value.toUpperCase()), ...ISO4217_EXTRA]);

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function isIso4217(currency: string) {
  const code = String(currency || "").trim().toUpperCase();
  return ISO4217.has(code);
}

function baseCheck(id: string, label: string, status: "OK" | "WARN" | "KO", explanation: string, whatToFix: string, example: string): CheckerItem {
  return {
    id,
    label,
    status,
    explanation,
    what_to_fix: whatToFix,
    example,
    source_link: BERCY_LINK,
  };
}

export function evaluateFxRules(context: TransactionContext, invoice: InvoiceData): FxCheckResult {
  const currency = String(context.currency || "").trim().toUpperCase();
  const checks: CheckerItem[] = [];
  const recommendations: string[] = [];

  const isoOk = isIso4217(currency);
  checks.push(
    baseCheck(
      "fx_iso4217",
      "Devise ISO 4217",
      isoOk ? "OK" : "KO",
      isoOk ? `Devise ${currency} reconnue.` : `Devise ${currency || "n/a"} non reconnue.`,
      "Utiliser un code devise ISO 4217 (EUR, USD, GBP, ...).",
      "USD",
    ),
  );

  const requiresExchangeRate = currency !== "EUR";
  const rate = Number(context.exchangeRate || 0);
  const rateOk = !requiresExchangeRate || (Number.isFinite(rate) && rate > 0);

  checks.push(
    baseCheck(
      "fx_rate_presence",
      "Taux de change",
      rateOk ? "OK" : "KO",
      requiresExchangeRate
        ? rateOk
          ? `Taux de change saisi: 1 ${currency} = ${rate} EUR.`
          : "Devise non EUR sans taux de change."
        : "Facture en EUR: taux non requis.",
      "Renseigner le taux de change utilise pour les calculs fiscaux/comptables.",
      "1 USD = 0.92 EUR",
    ),
  );

  let converted: FxCheckResult["converted"] = null;
  if (requiresExchangeRate && rateOk) {
    converted = {
      totalHtEur: round2(invoice.totals.totalHt * rate),
      vatAmountEur: round2(invoice.totals.vatAmount * rate),
      totalTtcEur: round2(invoice.totals.totalTtc * rate),
    };

    checks.push(
      baseCheck(
        "fx_conversion",
        "Contre-valeur EUR",
        "OK",
        "Contre-valeur EUR calculee pour base taxable/TVA.",
        "Reporter la contre-valeur EUR sur les documents fiscaux internes.",
        `HT EUR: ${converted.totalHtEur}`,
      ),
    );
  }

  if (requiresExchangeRate && !rateOk) {
    recommendations.push("Ajouter le taux de change de reference du jour de facturation.");
  }
  if (!isoOk) {
    recommendations.push("Remplacer la devise par un code ISO 4217 reconnu.");
  }

  recommendations.push("Conserver la source de taux et fournir une traduction si la facture est en langue etrangere.");

  return {
    checks,
    requiresExchangeRate,
    converted,
    recommendations,
  };
}

export function isValidIsoCurrency(code: string) {
  return isIso4217(code);
}
