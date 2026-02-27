import type { ClassificationResult, ControlsResult, CopilotCheck, PolicyContext, ResolvedContext, SourceLink } from "./types";

type ControlsParams = {
  context: ResolvedContext;
  classification: ClassificationResult;
  policy: PolicyContext;
};

type SanctionsCountryRule = {
  level: "high" | "medium";
  reason: string;
  source: SourceLink;
};

const DUAL_USE_KEYWORDS = [
  "cryptography",
  "chiffrement",
  "drone",
  "uav",
  "laser",
  "capteur",
  "sensor",
  "nucleaire",
  "nuclear",
  "chimie",
  "chemical",
  "defense",
  "military",
  "satellite",
  "guidance",
];

const SANCTIONS_COUNTRY_MAP: Record<string, SanctionsCountryRule> = {
  RU: {
    level: "high",
    reason: "Pays fortement expose aux sanctions UE/OFAC. Verification juridique obligatoire avant engagement.",
    source: {
      title: "EU Sanctions Map",
      url: "https://www.sanctionsmap.eu/",
    },
  },
  IR: {
    level: "high",
    reason: "Regime de sanctions et controles renforces. Operation a bloquer tant que screening non valide.",
    source: {
      title: "OFAC Sanctions Programs",
      url: "https://ofac.treasury.gov/sanctions-programs-and-country-information",
    },
  },
  KP: {
    level: "high",
    reason: "Pays sous sanctions internationales severes. Verification export-control indispensable.",
    source: {
      title: "UN Consolidated Sanctions List",
      url: "https://scsanctions.un.org/consolidated/",
    },
  },
  SY: {
    level: "high",
    reason: "Pays expose a des restrictions larges. Validation compliance requise avant toute offre.",
    source: {
      title: "EU Sanctions Map",
      url: "https://www.sanctionsmap.eu/",
    },
  },
  BY: {
    level: "medium",
    reason: "Pays sous restrictions sectorielles. Controle des parties et du produit requis.",
    source: {
      title: "EU Sanctions Map",
      url: "https://www.sanctionsmap.eu/",
    },
  },
  CU: {
    level: "medium",
    reason: "Pays soumis a regimes de sanctions selon juridiction. Evaluer risque bancaire et paiement.",
    source: {
      title: "OFAC Sanctions Programs",
      url: "https://ofac.treasury.gov/sanctions-programs-and-country-information",
    },
  },
};

const DUAL_USE_SOURCES: SourceLink[] = [
  {
    title: "Regulation (EU) 2021/821 (dual-use)",
    url: "https://eur-lex.europa.eu/eli/reg/2021/821/oj",
  },
  {
    title: "EU Dual-use guidance",
    url: "https://policy.trade.ec.europa.eu/help-exporters-and-importers/exporting-dual-use-items_en",
  },
];

function normalize(value: string) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function dedupeChecks(checks: CopilotCheck[]) {
  const map = new Map<string, CopilotCheck>();
  for (const check of checks) {
    map.set(check.id, check);
  }
  return Array.from(map.values());
}

function dualUseCheck(context: ResolvedContext): {
  triggered: boolean;
  check: CopilotCheck;
  questions: string[];
  links: SourceLink[];
} {
  const sample = normalize(`${context.product || ""} ${context.usage || ""}`);
  const triggered = DUAL_USE_KEYWORDS.some((keyword) => sample.includes(keyword));

  const questions = [
    "Usage final civil, militaire ou mixte ?",
    "Caracteristiques techniques critiques (puissance, precision, capteurs, chiffrement) ?",
    "Client final et pays de reexport connus ?",
    "Produit intgre dans un systeme defense, spatial ou nucleaire ?",
  ].slice(0, triggered ? 4 : 0);

  const check: CopilotCheck = triggered
    ? {
        id: "dual_use_signal",
        label: "Signal dual-use detecte",
        status: "A_CONFIRMER",
        explanation: "Le produit semble sensible (drone/chiffrement/capteur ou usage technique critique).",
        what_to_fix: "Completer le mini-questionnaire technique et verifier l'annexe UE 2021/821.",
        example_mention: "Controle export dual-use: verification annexe UE 2021/821 en cours.",
        fieldPath: "context.product",
        source_link: DUAL_USE_SOURCES[0].url,
      }
    : {
        id: "dual_use_signal",
        label: "Signal dual-use",
        status: "OK",
        explanation: "Aucun indice fort de dual-use dans la description actuelle.",
        what_to_fix: "Maintenir une description technique claire en cas d'audit.",
      };

  return {
    triggered,
    check,
    questions,
    links: triggered ? DUAL_USE_SOURCES : [],
  };
}

function sanctionsCountryCheck(destination: string | null): { check: CopilotCheck; hardStop: boolean; links: SourceLink[]; sanctions: string[] } {
  if (!destination) {
    return {
      check: {
        id: "sanctions_country",
        label: "Screening pays",
        status: "MANQUANT",
        explanation: "Le pays destination manque: impossible de finaliser le screening sanctions.",
        what_to_fix: "Renseigner le pays destination (ISO2 ou nom).",
        fieldPath: "context.destination",
      },
      hardStop: false,
      links: [],
      sanctions: [],
    };
  }

  const rule = SANCTIONS_COUNTRY_MAP[destination];
  if (!rule) {
    return {
      check: {
        id: "sanctions_country",
        label: "Screening pays",
        status: "OK",
        explanation: "Aucun blocage pays critique detecte dans la cartographie sanctions minimale.",
        what_to_fix: "Conserver une preuve de screening au moment de l'expedition.",
        source_link: "https://www.sanctionsmap.eu/",
      },
      hardStop: false,
      links: [{ title: "EU Sanctions Map", url: "https://www.sanctionsmap.eu/" }],
      sanctions: [],
    };
  }

  const status: CopilotCheck["status"] = rule.level === "high" ? "KO" : "A_CONFIRMER";
  return {
    check: {
      id: "sanctions_country",
      label: "Screening pays",
      status,
      explanation: rule.reason,
      what_to_fix:
        rule.level === "high"
          ? "Stopper la transaction jusqu'a validation juridique + screening complet des parties."
          : "Renforcer les controles (parties, banques, transit, licence export).",
      example_mention: "Sanctions screening pays realise avant confirmation de commande.",
      fieldPath: "context.destination",
      source_link: rule.source.url,
    },
    hardStop: rule.level === "high",
    links: [rule.source],
    sanctions: [rule.reason],
  };
}

function sanctionsPartyCheck(policy: PolicyContext, context: ResolvedContext): { check: CopilotCheck; hardStop: boolean; links: SourceLink[]; sanctions: string[] } {
  const hasParty = Boolean(context.buyer || context.seller);
  if (!hasParty) {
    return {
      check: {
        id: "sanctions_parties",
        label: "Screening des parties",
        status: "A_CONFIRMER",
        explanation: "Le nom du client/fournisseur n'est pas renseigne, screening incomplet.",
        what_to_fix: "Ajouter au moins le nom de la partie acheteuse ou vendeuse.",
        fieldPath: "context.buyer",
        source_link: "https://ofac.treasury.gov/sanctions-list-service",
      },
      hardStop: false,
      links: [
        { title: "OFAC Sanctions List Service", url: "https://ofac.treasury.gov/sanctions-list-service" },
        { title: "UN Consolidated List", url: "https://scsanctions.un.org/consolidated/" },
      ],
      sanctions: [],
    };
  }

  if (!policy.sanctionsMatches.length) {
    return {
      check: {
        id: "sanctions_parties",
        label: "Screening des parties",
        status: "OK",
        explanation: "Aucun match direct detecte dans le cache sanctions.",
        what_to_fix: "Conserver la trace de screening (date + liste).",
        source_link: "https://ofac.treasury.gov/sanctions-list-service",
      },
      hardStop: false,
      links: [
        { title: "OFAC Sanctions List Service", url: "https://ofac.treasury.gov/sanctions-list-service" },
        { title: "UN Consolidated List", url: "https://scsanctions.un.org/consolidated/" },
      ],
      sanctions: [],
    };
  }

  const first = policy.sanctionsMatches[0];
  return {
    check: {
      id: "sanctions_parties",
      label: "Screening des parties",
      status: "KO",
      explanation: `Match potentiel sanctions detecte: ${first.entity_name}.`,
      what_to_fix: "Bloquer l'operation, verifier l'identite complete et demander validation compliance.",
      example_mention: "Transaction suspendue - match sanctions en verification.",
      fieldPath: "context.buyer",
      source_link: "https://ofac.treasury.gov/sanctions-list-service",
    },
    hardStop: true,
    links: [
      { title: "OFAC Sanctions List Service", url: "https://ofac.treasury.gov/sanctions-list-service" },
      { title: "UN Consolidated List", url: "https://scsanctions.un.org/consolidated/" },
    ],
    sanctions: [`Match sanctions potentiel: ${first.entity_name}`],
  };
}

function hsConfidenceCheck(classification: ClassificationResult): CopilotCheck {
  if (!classification.primary) {
    return {
      id: "hs_classification",
      label: "Classification HS",
      status: "MANQUANT",
      explanation: "Aucun HS detecte automatiquement avec certitude suffisante.",
      what_to_fix: "Renseigner le produit precis puis confirmer un HS6.",
      fieldPath: "context.product",
      source_link: "https://trade.ec.europa.eu/access-to-markets/en/home",
    };
  }

  if (classification.requiresRtcBti) {
    return {
      id: "hs_classification",
      label: "Classification HS",
      status: "A_CONFIRMER",
      explanation: `HS propose ${classification.primary.hs6} mais confiance limitee (${Math.round(classification.confidence * 100)}%).`,
      what_to_fix: "Confirmer avec fiche technique; RTC/BTI recommande si enjeu tarifaire eleve.",
      example_mention: "Classification provisoire HS6 en cours de validation RTC/BTI.",
      fieldPath: "context.product",
      source_link: "https://trade.ec.europa.eu/access-to-markets/en/home",
    };
  }

  return {
    id: "hs_classification",
    label: "Classification HS",
    status: "OK",
    explanation: `HS principal retenu: ${classification.primary.hs6}.`,
    what_to_fix: "Documenter la base de classification (description + composition).",
    source_link: "https://trade.ec.europa.eu/access-to-markets/en/home",
  };
}

function incotermCheck(context: ResolvedContext): CopilotCheck {
  if (!context.incoterm) {
    return {
      id: "incoterm_presence",
      label: "Incoterm",
      status: "A_CONFIRMER",
      explanation: "Incoterm absent: risque de litige sur transfert des risques et couts.",
      what_to_fix: "Preciser l'Incoterm (ex: FCA Lyon, CIF Casablanca).",
      example_mention: "Incoterm 2020: FCA Lyon - chargement vendeur.",
      fieldPath: "context.incoterm",
      source_link: "https://iccwbo.org/business-solutions/incoterms-rules/incoterms-2020/",
    };
  }

  return {
    id: "incoterm_presence",
    label: "Incoterm",
    status: "OK",
    explanation: `Incoterm declare: ${context.incoterm}.`,
    what_to_fix: "Ajouter le lieu exact (port/ville) sur offre et facture.",
    source_link: "https://iccwbo.org/business-solutions/incoterms-rules/incoterms-2020/",
  };
}

export function evaluateControls(params: ControlsParams): ControlsResult {
  const checks: CopilotCheck[] = [];
  const risks: string[] = [];
  const actions: string[] = [];
  const sanctions: string[] = [];
  const sourceLinks = new Map<string, SourceLink>();
  let hardStop = false;

  const countryResult = sanctionsCountryCheck(params.context.destination);
  const partyResult = sanctionsPartyCheck(params.policy, params.context);
  const dualUseResult = dualUseCheck(params.context);

  checks.push(countryResult.check, partyResult.check, dualUseResult.check, hsConfidenceCheck(params.classification), incotermCheck(params.context));

  for (const link of [...countryResult.links, ...partyResult.links, ...dualUseResult.links]) {
    sourceLinks.set(link.url, link);
  }

  hardStop = countryResult.hardStop || partyResult.hardStop;
  sanctions.push(...countryResult.sanctions, ...partyResult.sanctions);

  if (countryResult.check.status !== "OK") {
    risks.push("Exposition sanctions pays a confirmer avant engagement commercial.");
  }
  if (partyResult.check.status !== "OK") {
    risks.push("Risque de contrepartie restreinte sans screening complet des parties.");
  }
  if (dualUseResult.check.status !== "OK") {
    risks.push("Risque dual-use: verifier usage final et classification technique.");
  }

  actions.push(
    "Lancer screening sanctions pays + parties avec trace horodatee.",
    "Valider HS6 et documents douane avant devis ferme.",
    "Confirmer Incoterm + lieu + responsabilites transport/assurance."
  );

  if (params.classification.requiresRtcBti) {
    actions.unshift("Si doute HS: initier une demande RTC/BTI pour securiser la classification.");
  }

  const dedupedChecks = dedupeChecks(checks);

  return {
    checks: dedupedChecks,
    risks: Array.from(new Set(risks)).slice(0, 3),
    actions: Array.from(new Set(actions)).slice(0, 3),
    sanctions: Array.from(new Set(sanctions)).slice(0, 5),
    sourceLinks: Array.from(sourceLinks.values()),
    dualUseQuestions: dualUseResult.questions,
    hardStop,
  };
}
