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
 * Essaie de deduire un prix MPL depuis la fiche produit DB
 * (sans imposer un schema strict : on lit plusieurs cles possibles).
 *
 * On garde ca volontairement permissif car ton type `Product` cote pricing
 * n'est pas forcement le meme que ta table `products`.
 */
const getFallbackMplPriceFromProduct = (product: Product): number | undefined => {
  const p: any = product as any;

  // Priorites (ajuste si besoin) :
  // 1) un champ "mplPrice" si tu l'ajoutes dans le futur
  // 2) tarif_catalogue_2025 (table products)
  // 3) tarif_ref_eur (si tu veux piloter via tarif reference)
  // 4) catalogPrice / price (si ton type pricing le contient)
  return (
    safeNumber(p?.mplPrice) ??
    safeNumber(p?.tarif_catalogue_2025) ??
    safeNumber(p?.tarif_ref_eur) ??
    safeNumber(p?.catalogPrice) ??
    safeNumber(p?.price)
  );
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
  mplPrice?: number,
  best?: { brand: Brand; price: number },
  avg?: number
): { gapBestPct?: number; gapAvgPct?: number } => {
  if (mplPrice === undefined) return {};
  const gapBestPct = best ? ((mplPrice - best.price) / best.price) * 100 : undefined;
  const gapAvgPct = avg ? ((mplPrice - avg) / avg) * 100 : undefined;
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
    return { recommendation: "Collecter donnees", hint: "Config pricing manquante" };
  }

  if (positioning === "no_data") {
    return {
      recommendation: "Collecter donnees",
      hint: "Pas assez de prix concurrents ou prix MPL manquant",
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
    const marginInfo = cost !== undefined ? ` (cout ${cost} EUR estime)` : "";
    return {
      recommendation: "Aligner partiellement",
      hint: `Au-dessus du marche ${deltaBest}. Verifier valeur percue${marginInfo} ou descendre vers best.`,
    };
  }

  return {
    recommendation: "Maintenir",
    hint: "Prix aligne. Monitorer volumes et signaux concurrence.",
  };
};

export const groupByProductMarketChannel = (
  products: Product[],
  pricePoints: PricePoint[],
  config: PricingConfig
): PositionRow[] => {
  const rows: PositionRow[] = [];

  // index points by product
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

    // Fallback MPL si absent (prix "catalogue")
    const fallbackMplPrice = getFallbackMplPriceFromProduct(product);

    if (fallbackMplPrice !== undefined) {
      // Pour chaque couple market/channel existant : si pas de MPL, on injecte un point synthetique
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

      // Si aucun point du tout sur ce produit, on cree au moins 1 ligne "DEFAULT"
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
      const competitorPoints = points.filter((p) => p.brand !== "MPL");

      const chosenMpl = selectPrice(mplPoints);
      const best = computeBestCompetitorPrice(competitorPoints);
      const avg = computeAvgCompetitorPrice(competitorPoints);

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
