import type { CostDoc, CostLine, CostType } from '@/types/costs';
import type { ImportedInvoice, ImportedInvoiceLine } from '@/types/sage';

export type PilotageTarget = 'invoice' | 'cost' | 'any';

export interface KeywordRule {
  id: string;
  keywords: string[];
  costType: CostType;
  appliesTo?: PilotageTarget;
  accountStartsWith?: string[];
  description?: string;
}

export interface PilotageRules {
  coverageThreshold: number;
  keywordRules: KeywordRule[];
}

const normalize = (value?: string) =>
  (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');

const matchesAccount = (rule: KeywordRule, account?: string) => {
  if (!rule.accountStartsWith?.length || !account) return false;
  return rule.accountStartsWith.some((prefix) => account.startsWith(prefix));
};

const matchesKeyword = (rule: KeywordRule, text: string) => {
  if (!rule.keywords.length) return false;
  return rule.keywords.some((kw) => text.includes(normalize(kw)));
};

const ruleApplies = (rule: KeywordRule, target: PilotageTarget) =>
  !rule.appliesTo || rule.appliesTo === 'any' || rule.appliesTo === target;

export const defaultPilotageRules: PilotageRules = {
  coverageThreshold: 0.65,
  keywordRules: [
    {
      id: 'transport_base',
      keywords: ['fret', 'transport', 'shipping', 'colis', 'livraison'],
      accountStartsWith: ['6061', '6241'],
      costType: 'transport',
      appliesTo: 'any',
      description: 'Frais de transport / fret',
    },
    {
      id: 'douane',
      keywords: ['dédouan', 'droits', 'omr', 'octroi', 'customs', 'douane'],
      accountStartsWith: ['608', '607'],
      costType: 'douane',
      appliesTo: 'any',
      description: 'Droits de douane, OM/OMR',
    },
    {
      id: 'transit',
      keywords: ['transit', 'clearance', 'declaration', 'broker'],
      costType: 'transit',
      appliesTo: 'any',
      description: 'Prestations transit / dédouanement',
    },
    {
      id: 'frais_dossier',
      keywords: ['dossier', 'handling', 'manutention', 'frais admin', 'frais dossier'],
      costType: 'frais_dossier',
      appliesTo: 'any',
      description: 'Frais de dossier / handling',
    },
    {
      id: 'assurance',
      keywords: ['assur', 'insurance'],
      accountStartsWith: ['616'],
      costType: 'assurance',
      appliesTo: 'any',
      description: 'Assurance transport',
    },
  ],
};

export const normalizeRules = (rules?: PilotageRules): PilotageRules => {
  if (!rules) return defaultPilotageRules;
  return {
    coverageThreshold: typeof rules.coverageThreshold === 'number' ? rules.coverageThreshold : defaultPilotageRules.coverageThreshold,
    keywordRules: Array.isArray(rules.keywordRules) && rules.keywordRules.length ? rules.keywordRules : defaultPilotageRules.keywordRules,
  };
};

export const classifyText = (
  text: string,
  account: string | undefined,
  rules: PilotageRules,
  target: PilotageTarget
): CostType | undefined => {
  const normalized = normalize(text);

  for (const rule of rules.keywordRules) {
    if (!ruleApplies(rule, target)) continue;
    const accountHit = matchesAccount(rule, account);
    const keywordHit = matchesKeyword(rule, normalized);
    if (accountHit || keywordHit) return rule.costType;
  }
  return undefined;
};

const classifyInvoiceLine = (line: ImportedInvoiceLine, rules: PilotageRules): ImportedInvoiceLine => {
  if (line.costType) return line;
  const guess = classifyText(line.description || '', line.account, rules, 'invoice');
  return guess ? { ...line, costType: guess } : line;
};

const classifyCostLine = (line: CostLine, rules: PilotageRules): CostLine => {
  const shouldGuess = !line.type || line.type === 'autre';
  if (!shouldGuess) return line;
  const guess = classifyText(line.label || '', line.reference, rules, 'cost');
  return guess ? { ...line, type: guess } : line;
};

export const applyRulesToInvoice = (invoice: ImportedInvoice, rules: PilotageRules): ImportedInvoice => {
  if (!invoice.lines?.length) return invoice;
  return {
    ...invoice,
    lines: invoice.lines.map((line) => classifyInvoiceLine(line, rules)),
  };
};

export const applyRulesToCostDoc = (doc: CostDoc, rules: PilotageRules): CostDoc => {
  return {
    ...doc,
    lines: doc.lines.map((line) => classifyCostLine(line, rules)),
  };
};

export const applyRulesToCostDocs = (docs: CostDoc[], rules: PilotageRules) => docs.map((doc) => applyRulesToCostDoc(doc, rules));
