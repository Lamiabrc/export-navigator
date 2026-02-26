import { OFFICIAL_LINKS } from "@/lib/constants";

import type { CheckerItem, InvoiceData, TransactionContext } from "./types";

function normalizeHs6(value: string) {
  return String(value || "").replace(/[^0-9]/g, "").slice(0, 6);
}

function toStatus(ok: boolean, strict = false): "OK" | "WARN" | "KO" {
  if (ok) return "OK";
  return strict ? "KO" : "WARN";
}

function checkLineDescriptions(invoice: InvoiceData): CheckerItem {
  const invalid = invoice.lines.filter((line) => line.description.trim().length < 5);
  return {
    id: "customs_line_description",
    label: "Description douaniere par ligne",
    status: toStatus(invalid.length === 0, true),
    explanation:
      invalid.length === 0
        ? "Descriptions produits suffisamment explicites pour la douane."
        : `${invalid.length} ligne(s) ont une description trop vague.`,
    what_to_fix: "Ajouter une description technique/commerciale precise par ligne.",
    example: "Pompe centrifuge acier inoxydable 2.2 kW, usage industriel.",
    source_link: OFFICIAL_LINKS.douane_fr,
  };
}

function checkHs6(invoice: InvoiceData): CheckerItem {
  const missing = invoice.lines.filter((line) => normalizeHs6(line.hs6).length !== 6);
  return {
    id: "customs_hs6",
    label: "Code HS6 par ligne",
    status: missing.length === 0 ? "OK" : "WARN",
    explanation:
      missing.length === 0
        ? "Codes HS6 presents pour toutes les lignes."
        : `${missing.length} ligne(s) sans HS6 valide; classement douanier a confirmer.`,
    what_to_fix: "Completer chaque ligne avec un HS6 valide (6 chiffres).",
    example: "HS6 850760 pour batteries lithium-ion.",
    source_link: OFFICIAL_LINKS.taric,
  };
}

function checkCountryOfOrigin(invoice: InvoiceData): CheckerItem {
  const missing = invoice.lines.filter((line) => !line.originCountry.trim());
  return {
    id: "customs_origin",
    label: "Pays d'origine",
    status: missing.length === 0 ? "OK" : "WARN",
    explanation:
      missing.length === 0
        ? "Origine declaree sur chaque ligne."
        : `${missing.length} ligne(s) sans pays d'origine.`,
    what_to_fix: "Ajouter le pays d'origine des marchandises par ligne.",
    example: "Origine: FR (fabrication France).",
    source_link: OFFICIAL_LINKS.douane_fr,
  };
}

function checkIncoterm(context: TransactionContext): CheckerItem {
  const hasIncoterm = context.incoterm.trim().length >= 3;
  const hasPlace = context.incotermPlace.trim().length >= 2;
  return {
    id: "customs_incoterm_place",
    label: "Incoterm + lieu",
    status: hasIncoterm && hasPlace ? "OK" : "WARN",
    explanation:
      hasIncoterm && hasPlace
        ? `Incoterm ${context.incoterm} avec lieu ${context.incotermPlace}.`
        : "Incoterm international incomplet (code et/ou lieu manquant).",
    what_to_fix: "Renseigner un incoterm ICC + lieu precis (ex: FCA Lyon).",
    example: "DAP Milan, Italie.",
    source_link: OFFICIAL_LINKS.incoterms_icc,
  };
}

function checkValueAndCurrency(context: TransactionContext, invoice: InvoiceData): CheckerItem {
  const totalsOk = invoice.totals.totalHt > 0 && invoice.totals.totalTtc > 0 && context.currency.trim().length === 3;
  return {
    id: "customs_value_currency",
    label: "Valeur facture et devise",
    status: totalsOk ? "OK" : "KO",
    explanation: totalsOk
      ? "Valeur commerciale et devise coherentes pour declaration douaniere."
      : "Valeur facture nulle/incoherente ou devise invalide.",
    what_to_fix: "Verifier total HT/TTC et renseigner une devise ISO 4217.",
    example: "Total HT 24 000 USD, devise USD.",
    source_link: OFFICIAL_LINKS.access2markets,
  };
}

function checkCustomsBreakdown(invoice: InvoiceData): CheckerItem {
  const hasBreakdown = invoice.charges.freight > 0 || invoice.charges.insurance > 0;
  return {
    id: "customs_value_breakdown",
    label: "Valeur en douane (fret/assurance)",
    status: hasBreakdown ? "OK" : "WARN",
    explanation: hasBreakdown
      ? "Fret/assurance renseignes pour constituer la valeur en douane."
      : "Aucun fret/assurance: la valeur en douane peut etre sous-evaluee.",
    what_to_fix: "Ajouter fret et assurance (et autres assists/royalties si applicables).",
    example: "Fret 900 EUR, assurance 120 EUR.",
    source_link: OFFICIAL_LINKS.douane_fr,
  };
}

function checkDdpConsistency(context: TransactionContext, invoice: InvoiceData): CheckerItem {
  const isDdp = context.incoterm.trim().toUpperCase() === "DDP";
  if (!isDdp) {
    return {
      id: "customs_ddp_consistency",
      label: "Coherence DDP",
      status: "OK",
      explanation: "Incoterm non DDP: controle DDP non applicable.",
      what_to_fix: "Aucune action requise.",
      example: "DAP / FCA / EXW.",
    };
  }

  const hasTaxIndicator = invoice.totals.vatAmount > 0 || invoice.charges.freight > 0 || invoice.charges.insurance > 0;
  return {
    id: "customs_ddp_consistency",
    label: "Coherence DDP",
    status: hasTaxIndicator ? "OK" : "WARN",
    explanation: hasTaxIndicator
      ? "DDP coherent avec des elements de cout import/fiscalite renseignes."
      : "DDP declare sans trace de taxes/frais import; risque contractuel.",
    what_to_fix: "Documenter qui supporte droits/taxes et integrer ces montants au prix.",
    example: "DDP Madrid - droits et TVA import inclus dans le prix facture.",
    source_link: OFFICIAL_LINKS.incoterms_icc,
  };
}

export function evaluateCustoms(context: TransactionContext, invoice: InvoiceData) {
  const checks: CheckerItem[] = [
    checkLineDescriptions(invoice),
    checkHs6(invoice),
    checkCountryOfOrigin(invoice),
    checkIncoterm(context),
    checkValueAndCurrency(context, invoice),
    checkCustomsBreakdown(invoice),
    checkDdpConsistency(context, invoice),
  ];

  const customs_usage = [
    "Determination des droits de douane et taxes a l'import.",
    "Verification de l'origine preferentielle/non-preferentielle.",
    "Controle de la valeur en douane (base droits et TVA import).",
    "Analyse du risque documentaire et ciblage des controles.",
  ];

  return {
    customs_checks: checks,
    customs_usage,
  };
}
