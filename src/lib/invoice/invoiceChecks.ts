import { OFFICIAL_LINKS } from "@/lib/constants";

import type { CheckerItem, InvoiceData, InvoiceLineInput, TransactionContext } from "./types";

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function statusFromOk(ok: boolean, strict = false): "OK" | "WARN" | "KO" {
  if (ok) return "OK";
  return strict ? "KO" : "WARN";
}

function makeCheck(
  id: string,
  label: string,
  status: "OK" | "WARN" | "KO",
  explanation: string,
  whatToFix: string,
  example: string,
  source?: string,
): CheckerItem {
  return {
    id,
    label,
    status,
    explanation,
    what_to_fix: whatToFix,
    example,
    source_link: source,
  };
}

function lineComputedValue(line: InvoiceLineInput) {
  const qty = Number.isFinite(line.qty) ? line.qty : 0;
  const unitPrice = Number.isFinite(line.unitPrice) ? line.unitPrice : 0;
  const discount = Number.isFinite(line.discountPct) ? line.discountPct : 0;
  return round2(qty * unitPrice * (1 - discount / 100));
}

function checkMandatoryMentions(context: TransactionContext, invoice: InvoiceData): CheckerItem[] {
  const checks: CheckerItem[] = [];

  checks.push(
    makeCheck(
      "mentions_invoice_number",
      "Numero de facture",
      statusFromOk(invoice.invoiceNumber.trim().length > 0, true),
      invoice.invoiceNumber.trim().length > 0
        ? "Numero de facture renseigne."
        : "Numero de facture manquant.",
      "Renseigner un numero unique de facture.",
      "FAC-2026-00154",
      OFFICIAL_LINKS.douane_fr,
    ),
  );

  checks.push(
    makeCheck(
      "mentions_issue_date",
      "Date d'emission",
      statusFromOk(invoice.issueDate.trim().length > 0, true),
      invoice.issueDate.trim().length > 0 ? "Date d'emission presente." : "Date d'emission manquante.",
      "Ajouter la date d'emission de la facture.",
      "2026-02-26",
      OFFICIAL_LINKS.douane_fr,
    ),
  );

  const sellerOk = invoice.seller.name.trim() && invoice.seller.address.trim();
  checks.push(
    makeCheck(
      "mentions_seller_identity",
      "Identite vendeur",
      statusFromOk(Boolean(sellerOk), true),
      sellerOk ? "Nom/adresse vendeur presents." : "Informations vendeur incompletes.",
      "Completer nom, adresse et identifiant vendeur.",
      "MPL Export SAS, 12 rue du Port, FR...",
      OFFICIAL_LINKS.douane_fr,
    ),
  );

  const buyerOk = invoice.buyer.name.trim() && invoice.buyer.address.trim();
  checks.push(
    makeCheck(
      "mentions_buyer_identity",
      "Identite acheteur",
      statusFromOk(Boolean(buyerOk), true),
      buyerOk ? "Nom/adresse acheteur presents." : "Informations acheteur incompletes.",
      "Completer nom, adresse et identifiant acheteur.",
      "ABC Italia SRL, Via Roma 15, IT...",
      OFFICIAL_LINKS.douane_fr,
    ),
  );

  checks.push(
    makeCheck(
      "mentions_lines",
      "Lignes facture",
      statusFromOk(invoice.lines.length > 0, true),
      invoice.lines.length > 0 ? `${invoice.lines.length} ligne(s) presente(s).` : "Aucune ligne facture.",
      "Ajouter au moins une ligne article/service.",
      "Description, quantite, prix unitaire, valeur ligne.",
      OFFICIAL_LINKS.douane_fr,
    ),
  );

  checks.push(
    makeCheck(
      "mentions_incoterm",
      "Incoterm international",
      statusFromOk(context.incoterm.trim().length >= 3 && context.incotermPlace.trim().length >= 2),
      context.incoterm.trim().length >= 3 && context.incotermPlace.trim().length >= 2
        ? `Incoterm ${context.incoterm} ${context.incotermPlace}.`
        : "Incoterm ou lieu manquant.",
      "Renseigner l'incoterm et le lieu (obligatoire en international).",
      "FCA Le Havre",
      OFFICIAL_LINKS.incoterms_icc,
    ),
  );

  return checks;
}

function checkTotals(invoice: InvoiceData): CheckerItem[] {
  const checks: CheckerItem[] = [];
  const tolerance = 0.02;

  const recomputedLineSum = round2(invoice.lines.reduce((sum, line) => sum + lineComputedValue(line), 0));
  const subtotalOk = Math.abs(recomputedLineSum - invoice.totals.totalHt) <= tolerance;

  checks.push(
    makeCheck(
      "calc_subtotal",
      "Calcul total HT",
      subtotalOk ? "OK" : "KO",
      subtotalOk
        ? "Total HT coherent avec la somme des lignes."
        : `Total HT incoherent (attendu ${recomputedLineSum}, saisi ${invoice.totals.totalHt}).`,
      "Recalculer total HT a partir des lignes.",
      "HT = somme des valeurs lignes",
      OFFICIAL_LINKS.douane_fr,
    ),
  );

  const expectedTtc = round2(invoice.totals.totalHt + invoice.totals.vatAmount);
  const ttcOk = Math.abs(expectedTtc - invoice.totals.totalTtc) <= tolerance;

  checks.push(
    makeCheck(
      "calc_ttc",
      "Calcul total TTC",
      ttcOk ? "OK" : "KO",
      ttcOk
        ? "Total TTC coherent (HT + TVA)."
        : `Total TTC incoherent (attendu ${expectedTtc}, saisi ${invoice.totals.totalTtc}).`,
      "Ajuster total TTC ou TVA.",
      "TTC = HT + TVA",
      OFFICIAL_LINKS.douane_fr,
    ),
  );

  const wrongLines = invoice.lines.filter((line) => Math.abs(lineComputedValue(line) - line.lineValue) > tolerance);
  checks.push(
    makeCheck(
      "calc_line_values",
      "Calcul valeurs de lignes",
      wrongLines.length === 0 ? "OK" : "WARN",
      wrongLines.length === 0
        ? "Valeurs lignes coherentes."
        : `${wrongLines.length} ligne(s) avec ecart sur la valeur calculee.`,
      "Verifier qty, PU, remise et valeur ligne.",
      "Valeur ligne = qty x PU x (1-remise)",
      OFFICIAL_LINKS.douane_fr,
    ),
  );

  return checks;
}

function isValidIban(value: string) {
  const raw = String(value || "").replace(/\s+/g, "").toUpperCase();
  return /^[A-Z]{2}[0-9A-Z]{13,32}$/.test(raw);
}

function isValidBic(value: string) {
  const raw = String(value || "").replace(/\s+/g, "").toUpperCase();
  return /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(raw);
}

function checkPayment(context: TransactionContext, invoice: InvoiceData): CheckerItem[] {
  const checks: CheckerItem[] = [];

  const hasIban = invoice.payment.iban.trim().length > 0;
  checks.push(
    makeCheck(
      "pay_iban_format",
      "Format IBAN",
      !hasIban ? "WARN" : isValidIban(invoice.payment.iban) ? "OK" : "WARN",
      !hasIban
        ? "IBAN non fourni (optionnel)."
        : isValidIban(invoice.payment.iban)
          ? "IBAN au format plausible."
          : "IBAN invalide ou incomplet.",
      "Verifier l'IBAN (pays + cle + numero de compte).",
      "FR7612345987650123456789014",
      "https://www.banque-france.fr/",
    ),
  );

  const hasBic = invoice.payment.bic.trim().length > 0;
  checks.push(
    makeCheck(
      "pay_bic_swift",
      "Format BIC/SWIFT",
      !hasBic ? "WARN" : isValidBic(invoice.payment.bic || invoice.payment.swift) ? "OK" : "WARN",
      !hasBic
        ? "BIC/SWIFT non fourni (optionnel)."
        : isValidBic(invoice.payment.bic || invoice.payment.swift)
          ? "BIC/SWIFT valide."
          : "BIC/SWIFT invalide.",
      "Verifier code BIC (8 ou 11 caracteres).",
      "BNPAFRPP",
      "https://www.banque-france.fr/",
    ),
  );

  const ibanCountry = invoice.payment.iban.replace(/\s+/g, "").slice(0, 2).toUpperCase();
  const countryMismatch = hasIban && ibanCountry && context.sellerCountry && ibanCountry !== context.sellerCountry.toUpperCase();

  checks.push(
    makeCheck(
      "pay_country_consistency",
      "Cohérence pays IBAN / vendeur",
      countryMismatch ? "WARN" : "OK",
      countryMismatch
        ? `IBAN (${ibanCountry}) different du pays vendeur (${context.sellerCountry}).`
        : "Pays IBAN coherent ou non applicable.",
      "Confirmer le compte bancaire contractuel du vendeur.",
      "Vendeur FR -> IBAN commencant par FR",
      "https://www.banque-france.fr/",
    ),
  );

  return checks;
}

function checkInterDocs(invoice: InvoiceData): CheckerItem[] {
  const docs = invoice.documents;
  const providedCount = [docs.awb, docs.bl, docs.packingList].filter((x) => x.trim().length > 0).length;

  return [
    makeCheck(
      "docs_cross_consistency",
      "Cohérence documents transport",
      providedCount === 0 ? "WARN" : providedCount === 1 ? "WARN" : "OK",
      providedCount === 0
        ? "Aucun numero AWB/B-L/Packing list renseigne (controle croise saute)."
        : providedCount === 1
          ? "Un seul document saisi: coherence inter-docs partielle."
          : "Plusieurs references documentaires presentes.",
      "Ajouter AWB/B-L/Packing List quand disponibles.",
      "AWB 020-12345675, PL-2026-0084",
      OFFICIAL_LINKS.douane_fr,
    ),
  ];
}

function checkRiskSignals(invoice: InvoiceData): CheckerItem[] {
  const checks: CheckerItem[] = [];

  checks.push(
    makeCheck(
      "risk_weights",
      "Cohérence poids net/brut",
      invoice.grossWeight >= invoice.netWeight ? "OK" : "KO",
      invoice.grossWeight >= invoice.netWeight
        ? "Poids brut >= poids net."
        : "Poids brut inferieur au poids net: incoherent.",
      "Verifier les poids et l'unite.",
      "Poids net 850 kg, brut 910 kg",
      OFFICIAL_LINKS.douane_fr,
    ),
  );

  checks.push(
    makeCheck(
      "risk_packages",
      "Nombre de colis",
      invoice.packageCount > 0 ? "OK" : "WARN",
      invoice.packageCount > 0
        ? `${invoice.packageCount} colis declares.`
        : "Nombre de colis non renseigne.",
      "Completer nombre de colis et marques/numeros.",
      "12 colis, marques ABX/001-012",
      OFFICIAL_LINKS.douane_fr,
    ),
  );

  return checks;
}

export function evaluateInvoiceChecks(context: TransactionContext, invoice: InvoiceData) {
  return {
    mentions: [
      ...checkMandatoryMentions(context, invoice),
      ...checkPayment(context, invoice),
      ...checkInterDocs(invoice),
    ],
    calculs: checkTotals(invoice),
    risks: checkRiskSignals(invoice),
  };
}
