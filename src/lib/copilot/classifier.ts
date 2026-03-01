import type { ClassificationResult, HsCandidate, ProductAliasRecord, ResolvedContext } from "./types.js";

type ClassifyParams = {
  context: ResolvedContext;
  aliases: ProductAliasRecord[];
};

type BuiltinAlias = {
  term: string;
  chapters: string[];
  examples: string[];
  chips?: string[];
};

const CHAPTER_TO_HS6: Record<string, { hs6: string; label: string }> = {
  "07": { hs6: "070200", label: "Tomates fraiches" },
  "08": { hs6: "080390", label: "Bananes, fraiches ou sechees" },
  "09": { hs6: "090111", label: "Cafe non torrefie" },
  "10": { hs6: "100199", label: "Ble" },
  "15": { hs6: "150910", label: "Huile d'olive vierge" },
  "30": { hs6: "300490", label: "Medicaments" },
  "33": { hs6: "330499", label: "Produits cosmetiques" },
  "39": { hs6: "392690", label: "Articles en plastique" },
  "44": { hs6: "440799", label: "Bois debite" },
  "48": { hs6: "481920", label: "Emballages en papier/carton" },
  "61": { hs6: "610910", label: "T-shirts en coton" },
  "62": { hs6: "620462", label: "Pantalons textile" },
  "64": { hs6: "640399", label: "Chaussures" },
  "72": { hs6: "720449", label: "Ferrailles et debris de fer ou acier" },
  "73": { hs6: "730890", label: "Constructions et parties en fer ou acier" },
  "84": { hs6: "847989", label: "Machines et appareils mecaniques" },
  "85": { hs6: "852349", label: "Supports logiciels et donnees" },
  "87": { hs6: "870899", label: "Pieces automobiles" },
  "88": { hs6: "880610", label: "Drones et aeronefs sans pilote" },
  "90": { hs6: "902780", label: "Appareils de mesure et capteurs" },
};

const BUILTIN_ALIASES: BuiltinAlias[] = [
  { term: "banane", chapters: ["08"], examples: ["banane", "bananes", "banana"] },
  { term: "ferraille", chapters: ["72", "73"], examples: ["ferraille", "scrap", "dechets acier"], chips: ["ferraille", "barres", "toles"] },
  { term: "acier", chapters: ["72", "73"], examples: ["acier", "steel", "barres acier"], chips: ["ferraille", "barres", "toles"] },
  { term: "drone", chapters: ["88", "85"], examples: ["drone", "uav", "quadcopter"], chips: ["drone loisir", "drone pro", "pieces drone"] },
  { term: "chiffrement", chapters: ["85", "90"], examples: ["chiffrement", "cryptography", "encryption software"], chips: ["logiciel", "module materiel", "service"] },
  { term: "logiciel", chapters: ["85"], examples: ["logiciel", "software", "saas"], chips: ["licence logicielle", "support physique", "service saas"] },
  { term: "capteur", chapters: ["90", "85"], examples: ["capteur", "sensor", "lidar"] },
  { term: "medicament", chapters: ["30"], examples: ["medicament", "pharma", "medicine"] },
  { term: "cosmetique", chapters: ["33"], examples: ["cosmetique", "makeup", "skincare"] },
  { term: "textile", chapters: ["61", "62"], examples: ["textile", "vetement", "t-shirt"] },
  { term: "piece auto", chapters: ["87"], examples: ["piece auto", "auto parts"] },
  { term: "machine", chapters: ["84"], examples: ["machine", "machinery", "equipment"] },
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

function chapterToCandidate(chapter: string, confidence: number, reason: string): HsCandidate | null {
  const mapped = CHAPTER_TO_HS6[chapter];
  if (!mapped) return null;
  return {
    hs6: mapped.hs6,
    label: mapped.label,
    confidence: Number(confidence.toFixed(2)),
    reason,
  };
}

function rankChapters(product: string, aliases: ProductAliasRecord[]) {
  const normalizedProduct = normalize(product);
  const chapterScores = new Map<string, number>();
  const reasons = new Map<string, string[]>();

  const register = (chapter: string, score: number, reason: string) => {
    chapterScores.set(chapter, (chapterScores.get(chapter) || 0) + score);
    const existing = reasons.get(chapter) || [];
    reasons.set(chapter, [...existing, reason]);
  };

  for (const alias of BUILTIN_ALIASES) {
    for (const term of alias.examples) {
      const nTerm = normalize(term);
      if (!nTerm) continue;
      if (normalizedProduct.includes(nTerm)) {
        for (const chapter of alias.chapters) {
          register(chapter, nTerm.length > 6 ? 1.8 : 1.4, `mot-cle: ${term}`);
        }
      }
    }
  }

  for (const alias of aliases) {
    const normalizedTerm = normalize(alias.term);
    if (!normalizedTerm) continue;
    if (!normalizedProduct.includes(normalizedTerm)) continue;

    for (const chapter of alias.hs_chapters) {
      const normalizedChapter = String(chapter || "").replace(/[^0-9]/g, "").slice(0, 2);
      if (!normalizedChapter) continue;
      register(normalizedChapter, normalizedTerm.length > 6 ? 1.5 : 1.2, `alias db: ${alias.term}`);
    }
  }

  const ranked = Array.from(chapterScores.entries())
    .map(([chapter, score]) => ({ chapter, score, reasons: (reasons.get(chapter) || []).slice(0, 2) }))
    .sort((a, b) => b.score - a.score);

  return ranked;
}

function deriveChips(product: string, topChapter: string | null, aliases: ProductAliasRecord[]) {
  const normalized = normalize(product);
  const chips = new Set<string>();

  for (const alias of BUILTIN_ALIASES) {
    if (alias.examples.some((example) => normalized.includes(normalize(example)))) {
      (alias.chips || []).forEach((chip) => chips.add(chip));
    }
  }

  if (!chips.size && topChapter === "72") {
    ["ferraille", "barres", "toles"].forEach((chip) => chips.add(chip));
  }

  if (!chips.size) {
    for (const alias of aliases.slice(0, 6)) {
      if (alias.examples.length) chips.add(alias.examples[0]);
      if (chips.size >= 3) break;
    }
  }

  if (!chips.size) {
    ["produit fini", "matiere premiere", "piece technique"].forEach((chip) => chips.add(chip));
  }

  return Array.from(chips).slice(0, 3);
}

export function classifyProduct(params: ClassifyParams): ClassificationResult {
  const explicitHs6 = String(params.context.hs6 || "").replace(/[^0-9]/g, "").slice(0, 6);
  if (explicitHs6.length === 6) {
    const chapter = explicitHs6.slice(0, 2);
    const mapped = CHAPTER_TO_HS6[chapter];
    const explicit: HsCandidate = {
      hs6: explicitHs6,
      label: mapped?.label || "HS declare par utilisateur",
      confidence: 0.99,
      reason: "code HS fourni",
    };

    const alternatives = Object.entries(CHAPTER_TO_HS6)
      .filter(([candidateChapter]) => candidateChapter !== chapter)
      .slice(0, 2)
      .map(([_, candidate]) => ({
        hs6: candidate.hs6,
        label: candidate.label,
        confidence: 0.42,
        reason: "alternative de chapitre proche",
      }));

    return {
      primary: explicit,
      alternatives,
      chips: deriveChips(params.context.product || "", chapter, params.aliases),
      confidence: explicit.confidence,
      requiresRtcBti: false,
    };
  }

  const product = String(params.context.product || "").trim();
  if (!product) {
    return {
      primary: null,
      alternatives: [],
      chips: ["ferraille", "barres", "toles"],
      confidence: 0,
      requiresRtcBti: true,
    };
  }

  const ranked = rankChapters(product, params.aliases);
  const top = ranked[0];
  const second = ranked[1];

  if (!top) {
    return {
      primary: null,
      alternatives: [],
      chips: deriveChips(product, null, params.aliases),
      confidence: 0.3,
      requiresRtcBti: true,
    };
  }

  const denominator = top.score + (second?.score || 0) + 1;
  const confidence = Math.max(0.35, Math.min(0.92, top.score / denominator + 0.35));

  const primary = chapterToCandidate(top.chapter, confidence, top.reasons.join(" | "));
  const alternatives = ranked
    .slice(1, 3)
    .map((entry) => chapterToCandidate(entry.chapter, Math.max(0.25, confidence - 0.18), entry.reasons.join(" | ")))
    .filter((candidate): candidate is HsCandidate => Boolean(candidate));

  return {
    primary,
    alternatives,
    chips: deriveChips(product, top.chapter, params.aliases),
    confidence: Number(confidence.toFixed(2)),
    requiresRtcBti: confidence < 0.65,
  };
}
