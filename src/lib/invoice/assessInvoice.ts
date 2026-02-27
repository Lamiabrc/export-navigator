import type { CheckerItem, CheckerStatus, InvoiceAssessment, InvoiceData, TransactionContext } from "./types";
import { evaluateCustoms } from "./customsEngine";
import { evaluateFxRules } from "./fxRules";
import { evaluateInvoiceChecks } from "./invoiceChecks";
import { evaluateVat, vatResultToChecks } from "./vatEngine";

function computeScore(checks: CheckerItem[]) {
  const penalties = checks.reduce((acc, check) => {
    if (check.status === "KO") return acc + 18;
    if (check.status === "WARN") return acc + 7;
    return acc;
  }, 0);

  return Math.max(0, Math.min(100, 100 - penalties));
}

function computeStatus(checks: CheckerItem[]): CheckerStatus {
  if (checks.some((check) => check.status === "KO")) return "BLOCKING";
  if (checks.some((check) => check.status === "WARN")) return "WARNING";
  return "OK";
}

export function assessInvoice(context: TransactionContext, invoice: InvoiceData): InvoiceAssessment {
  const vatResult = evaluateVat({
    goodsOrServices: context.goodsOrServices,
    flowDirection: context.flowDirection,
    sellerCountry: context.sellerCountry,
    buyerCountry: context.buyerCountry,
    buyerIsTaxable: context.buyerIsTaxable,
    sellerVat: context.sellerVat,
    buyerVat: context.buyerVat,
    proofOfTransport: context.proofOfTransport,
  });

  const customsResult = evaluateCustoms(context, invoice);
  const fxResult = evaluateFxRules(context, invoice);
  const baseChecks = evaluateInvoiceChecks(context, invoice);

  const checksByTab = {
    mentions: baseChecks.mentions,
    vat: [...vatResultToChecks(vatResult, {
      buyerVat: context.buyerVat,
      sellerVat: context.sellerVat,
      buyerIsTaxable: context.buyerIsTaxable,
      proofOfTransport: context.proofOfTransport,
    })],
    customs: customsResult.customs_checks,
    fx: fxResult.checks,
    calculs: baseChecks.calculs,
    risks: baseChecks.risks,
  };

  const allChecks = [
    ...checksByTab.mentions,
    ...checksByTab.vat,
    ...checksByTab.customs,
    ...checksByTab.fx,
    ...checksByTab.calculs,
    ...checksByTab.risks,
  ];

  const score = computeScore(allChecks);
  const status = computeStatus(allChecks);

  return {
    score,
    status,
    vat_result: vatResult,
    checks_by_tab: checksByTab,
    customs_usage: customsResult.customs_usage,
    fx_result: fxResult,
  };
}
