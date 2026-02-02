import type {
  Brand,
  PositionRow,
  Positioning,
  PricePoint,
  PricingConfig,
  Product,
} from "@/types/pricing";

/**
 * Helpers
 */
const safeNumber = (v: unknown): number | undefined => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : undefined;
};

const byConfidenceThenDate = (a: PricePoint, b: PricePoint) => {
  if (b.confidence !== a.confidence) return b.confidence - a.confidence;
  return new Date(b.date).getTime() - new Date(a.date).getTime();
};

const selectPrice = (points: PricePoint[]) => {
  if (!points.length) return undefined;
  const sorted = [...points].sort(byConfidenceThenDate);
  return sorted[0];
};

/**
 * Prix "MPL" fallback : lecture permissive depuis un objet produit (DB ou autre)
 * On évite de dépendre d'un schema strict.
 */
const getFallbackMplPriceFromProduct = (product: Product): number | undefined => {
  const p: any = product as any;

  // Priorités :
  // 1) mplPrice (si ajouté un jour)
  // 2) tarif_catalogue_2025 (table products)
  // 3) tarif_ref_eur (tarif de référence)
  // 4) catalogPrice / price (selon ton type pricing)
  return (
    safeNumber(p?.mplPrice) ??
    safeNumber(p?.tarif_catalogue_2025) ??
    safeNumber(p?.tarif_ref_eur) ??
    safeNumber(p?.catalogPrice) ??
    safeNumber(p?.price)
  );
};

/**
 * ✅ Benchmarks marché
 * On garde les types existants (Brand) mais :
 * - brand !== "MPL" = "source marché" (benchmark) au lieu de "concurrent"
 */
export const computeBestBenchmarkPrice = (points: PricePoint[]) => {
  if (!points.length) return undefined;
  const best = [...points].sort((a, b) => a.price - b.price)[0];
  return { brand: best.brand as Brand, price: best.price };
};

/** Moyenne des benchmarks marché */
export const computeAvgBenchmarkPrice = (points: PricePoint[]) => {
  if (!points.length) return undefined;
  const sum = points.reduce((acc, p) => acc + p.price, 0);
  return sum / points.length;
};

export const computeGaps = (
  mplPrice?: number,
  best?: { brand: Brand; price: number },
  avg?: number
): { gapBestPct?: number; gapAvgPct?: number } => {
  if (mplPrice === undefined) return {};

  const bestBase = best?.price;
  const avgBase = avg;

  // ⚠️ évite division par zéro
  const gapBestPct =
    bestBase && bestBase > 0 ? ((mplPrice - bestBase) / bestBase) * 100 : undefined;

  const gapAvgPct =
    avgBase && avgBase > 0 ? ((mplPrice - avgBase) / avgBase) * 100 : undefined;

  return { gapBestPct, gapAvgPct };
};

/**
 * Positioning = lecture simple "par rapport au marché"
 */
export const classifyPositioning = (
  gapAvgPct?: number,
  config?: PricingConfig
): Positioning => {
  if (gapAvgPct === undefined || config === undefined) return "no_data";
  if (gapAvgPct > config.premiumThreshold) return "premium";
  if (gapAvgPct < config.alignLow) return "underpriced";
  return "aligned";
};

/**
 * Recos orientées "marché / stratégie" (pas concurrence)
 */
export const recommendAction = (
  positioning: Positioning,
  gapBestPct?: number,
  gapAvgPct?: number,
  cost?: number,
  config?: PricingConfig
): { recommendation: string; hint: string } => {
  if (!config) {
    return { recommendation: "Collecter les données", hint: "Configuration pricing manquante" };
  }

  if (positioning === "no_data") {
    return {
      recommendation: "Renseigner le contexte",
      hint:
        "Données de marché insuffisantes (benchmarks) ou prix interne manquant. Ajoutez des sources/observations pour fiabiliser l'analyse.",
    };
  }

  if (positioning === "underpriced") {
    const target = gapAvgPct !== undefined ? `${Math.abs(gapAvgPct).toFixed(0)}%` : "";
    return {
      recommendation: "Revaloriser",
      hint: `Prix sous la référence marché ${target}. Ajuster le tarif ou renforcer l'offre (bundle / service / garanties).`,
    };
  }

  if (positioning === "premium") {
    const deltaBest = gapBestPct !== undefined ? `${gapBestPct.toFixed(0)}%` : "";
    const marginInfo = cost !== undefined ? ` (coût estimé ${cost} €)` : "";
    return {
      recommendation: "Arbitrer premium",
      hint: `Au-dessus des références marché ${deltaBest}.${marginInfo} Vérifier la valeur perçue, ou rapprocher le tarif d'un benchmark bas.`,
    };
  }

  return {
    recommendation: "Maintenir",
    hint: "Positionnement cohérent vs références marché. Surveiller l'évolution (sources, saisonnalité, conditions).",
  };
};

/**
 * ⚙️ Fonction principale :
 * - Regroupe par productId + market/channel
 * - Injecte un point MPL synthétique si aucun prix MPL n'existe mais qu'on a un fallback catalogue
 * - Produit des PositionRow (compat avec tes écrans actuels)
 */
export const groupByProductMarketChannel = (
  products: Product[],
  pricePoints: PricePoint[],
  config: PricingConfig
): PositionRow[] => {
  const rows: PositionRow[] = [];

  // Index points by product
  const byProduct = pricePoints.reduce<Record<string, PricePoint[]>>((acc, pp) => {
    if (pp.confidence < config.minConfidence) return acc;
    const list = acc[pp.productId] || [];
    list.push(pp);
    acc[pp.productId] = list;
    return acc;
  }, {});

  products.forEach((product) => {
    const productPoints = byProduct[product.id] ?? [];
    const byMarketChannel = new Map<string, PricePoint[]>();

    // Regroupe les points existants
    productPoints.forEach((pp) => {
      const key = `${pp.market}__${pp.channel}`;
      const arr = byMarketChannel.get(key) ?? [];
      arr.push(pp);
      byMarketChannel.set(key, arr);
    });

    // Fallback MPL si absent (prix catalogue)
    const fallbackMplPrice = getFallbackMplPriceFromProduct(product);

    if (fallbackMplPrice !== undefined) {
      // Pour chaque couple market/channel existant : si pas de MPL, on injecte un point synthétique
      byMarketChannel.forEach((points, key) => {
        const hasMpl = points.some((p) => p.brand === "MPL");
        if (hasMpl) return;

        const [market, channel] = key.split("__");

        points.push({
          id: `synthetic-mpl-${product.id}-${market}-${channel}`,
          productId: product.id,
          brand: "MPL",
          price: fallbackMplPrice,
          market,
          channel,
          confidence: 90,
          date: new Date().toISOString(),
          source: "catalogue_fallback",
        } as any);
      });

      // Si aucun point du tout sur ce produit, on crée au moins 1 ligne "DEFAULT"
      if (byMarketChannel.size === 0) {
        const key = `DEFAULT__DEFAULT`;
        byMarketChannel.set(key, [
          {
            id: `synthetic-mpl-${product.id}-DEFAULT-DEFAULT`,
            productId: product.id,
            brand: "MPL",
            price: fallbackMplPrice,
            market: "DEFAULT",
            channel: "DEFAULT",
            confidence: 80,
            date: new Date().toISOString(),
            source: "catalogue_fallback",
          } as any,
        ]);
      }
    }

    byMarketChannel.forEach((points, key) => {
      const [market, channel] = key.split("__");

      const mplPoints = points.filter((p) => p.brand === "MPL");
      const benchmarkPoints = points.filter((p) => p.brand !== "MPL"); // ✅ pas "competitor"

      const chosenMpl = selectPrice(mplPoints);
      const best = computeBestBenchmarkPrice(benchmarkPoints);
      const avg = computeAvgBenchmarkPrice(benchmarkPoints);

      const { gapBestPct, gapAvgPct } = computeGaps(chosenMpl?.price, best, avg);
      const positioning = classifyPositioning(gapAvgPct, config);

      const { recommendation, hint } = recommendAction(
        positioning,
        gapBestPct,
        gapAvgPct,
        (product as any)?.cost,
        config
      );

      const confidences = points.map((p) => p.confidence);
      const confidenceCoverage =
        confidences.length === 0
          ? 0
          : Math.round(confidences.reduce((s, c) => s + c, 0) / confidences.length);

      rows.push({
        product,
        market,
        channel,
        mplPrice: chosenMpl?.price,

        // ✅ on garde les champs (pour compat UI), mais ce sont des "benchmarks marché"
        bestCompetitor: best,
        avgCompetitorPrice: avg,

        gapBestPct,
        gapAvgPct,
        positioning,
        recommendation,
        recommendationHint: hint,
        confidenceCoverage,
      });
    });
  });

  return rows;
};

/**
 * ✅ Compat : si des écrans importent encore les anciens noms
 * (tu peux supprimer plus tard quand tout est refactor).
 */
export const computeBestCompetitorPrice = computeBestBenchmarkPrice;
export const computeAvgCompetitorPrice = computeAvgBenchmarkPrice;
