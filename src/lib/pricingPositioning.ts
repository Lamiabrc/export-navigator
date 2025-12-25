import type {
  Brand,
  PositionRow,
  Positioning,
  PricePoint,
  PricingConfig,
  Product,
} from "@/types/pricing";

const byConfidenceThenDate = (a: PricePoint, b: PricePoint) => {
  if (b.confidence !== a.confidence) return b.confidence - a.confidence;
  return new Date(b.date).getTime() - new Date(a.date).getTime();
};

const selectPrice = (points: PricePoint[]) => {
  if (!points.length) return undefined;
  const sorted = [...points].sort(byConfidenceThenDate);
  return sorted[0];
};

export const computeBestCompetitorPrice = (points: PricePoint[]) => {
  if (!points.length) return undefined;
  const best = [...points].sort((a, b) => a.price - b.price)[0];
  return { brand: best.brand as Brand, price: best.price };
};

export const computeAvgCompetitorPrice = (points: PricePoint[]) => {
  if (!points.length) return undefined;
  const sum = points.reduce((acc, p) => acc + p.price, 0);
  return sum / points.length;
};

export const computeGaps = (
  orlimanPrice?: number,
  best?: { brand: Brand; price: number },
  avg?: number
): { gapBestPct?: number; gapAvgPct?: number } => {
  if (!orlimanPrice) return {};
  const gapBestPct = best ? ((orlimanPrice - best.price) / best.price) * 100 : undefined;
  const gapAvgPct = avg ? ((orlimanPrice - avg) / avg) * 100 : undefined;
  return { gapBestPct, gapAvgPct };
};

export const classifyPositioning = (gapAvgPct?: number, config?: PricingConfig): Positioning => {
  if (gapAvgPct === undefined || config === undefined) return "no_data";
  if (gapAvgPct > config.premiumThreshold) return "premium";
  if (gapAvgPct < config.alignLow) return "underpriced";
  return "aligned";
};

export const recommendAction = (
  positioning: Positioning,
  gapBestPct?: number,
  gapAvgPct?: number,
  cost?: number,
  config?: PricingConfig
): { recommendation: string; hint: string } => {
  if (!config) {
    return { recommendation: "Collecter données", hint: "Config pricing manquante" };
  }
  if (positioning === "no_data") {
    return {
      recommendation: "Collecter données",
      hint: "Pas assez de prix concurrents ou confiance faible",
    };
  }

  if (positioning === "underpriced") {
    const target = gapAvgPct !== undefined ? `${Math.abs(gapAvgPct).toFixed(0)}%` : "";
    return {
      recommendation: "Revaloriser",
      hint: `Prix sous la moyenne concurrente ${target}. Revoir tarifs / bundles.`,
    };
  }

  if (positioning === "premium") {
    const deltaBest = gapBestPct !== undefined ? `${gapBestPct.toFixed(0)}%` : "";
    const margin = cost !== undefined ? ` (cout ${cost}€ estimé)` : "";
    return {
      recommendation: "Aligner partiellement",
      hint: `Au-dessus du marché ${deltaBest}. Vérifier valeur perçue${margin} ou descendre vers best.`,
    };
  }

  return {
    recommendation: "Maintenir",
    hint: "Prix aligné. Monitorer volumes et signaux concurrence.",
  };
};

export const groupByProductMarketChannel = (
  products: Product[],
  pricePoints: PricePoint[],
  config: PricingConfig
): PositionRow[] => {
  const rows: PositionRow[] = [];

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

    productPoints.forEach((pp) => {
      const key = `${pp.market}__${pp.channel}`;
      const arr = byMarketChannel.get(key) ?? [];
      arr.push(pp);
      byMarketChannel.set(key, arr);
    });

    byMarketChannel.forEach((points, key) => {
      const [market, channel] = key.split("__");
      const orlimanPoints = points.filter((p) => p.brand === "ORLIMAN");
      const competitorPoints = points.filter((p) => p.brand !== "ORLIMAN");

      const chosenOrliman = selectPrice(orlimanPoints);
      const best = computeBestCompetitorPrice(competitorPoints);
      const avg = computeAvgCompetitorPrice(competitorPoints);
      const { gapBestPct, gapAvgPct } = computeGaps(chosenOrliman?.price, best, avg);
      const positioning = classifyPositioning(gapAvgPct, config);
      const { recommendation, hint } = recommendAction(
        positioning,
        gapBestPct,
        gapAvgPct,
        product.cost,
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
        orlimanPrice: chosenOrliman?.price,
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
