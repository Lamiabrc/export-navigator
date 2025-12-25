import type { PricePoint, Product, PricingConfig } from "@/types/pricing";

export const pricingConfig: PricingConfig = {
  premiumThreshold: 10, // % au-dessus de la moyenne concurrent
  alignLow: -5, // % vs moyenne : sous-positionné en dessous de -5%
  alignHigh: 5, // % vs moyenne : considéré aligné entre -5% et +5%
  minConfidence: 65,
};

export const products: Product[] = [
  { id: "p1", sku: "ORL-CH-001", name: "Chevillere ligamento", category: "Chevillere", lppCode: "201A", cost: 18 },
  { id: "p2", sku: "ORL-GN-002", name: "Genouillere sport", category: "Genou", lppCode: "301B", cost: 24 },
  { id: "p3", sku: "ORL-CE-003", name: "Ceinture lombaire", category: "Ceinture", lppCode: "501C", cost: 28 },
  { id: "p4", sku: "ORL-EP-004", name: "Épaule stabilisation", category: "Epaule", cost: 32 },
  { id: "p5", sku: "ORL-CO-005", name: "Collier cervical", category: "Cervical", lppCode: "101D", cost: 9 },
  { id: "p6", sku: "ORL-PO-006", name: "Poignet strap", category: "Poignet", cost: 8 },
  { id: "p7", sku: "ORL-CH-007", name: "Chevillere premium gel", category: "Chevillere", lppCode: "201A", cost: 22 },
  { id: "p8", sku: "ORL-GN-008", name: "Genouillere ligamentaire", category: "Genou", lppCode: "301B", cost: 35 },
  { id: "p9", sku: "ORL-CE-009", name: "Ceinture posture active", category: "Ceinture", cost: 26 },
  { id: "p10", sku: "ORL-EP-010", name: "Épaule cryo", category: "Epaule", cost: 30 },
  { id: "p11", sku: "ORL-PO-011", name: "Poignet rapide", category: "Poignet", cost: 7 },
];

const mk = (partial: Omit<PricePoint, "id">, id: number): PricePoint => ({
  id: `pp-${id}`,
  ...partial,
});

export const pricePoints: PricePoint[] = [
  // ORLIMAN baseline
  mk({ productId: "p1", brand: "ORLIMAN", market: "FR", channel: "Pharmacie", currency: "EUR", price: 42, priceType: "TTC", date: "2024-12-01", sourceLabel: "Sell-out retail", confidence: 90 }, 1),
  mk({ productId: "p1", brand: "ORLIMAN", market: "MQ", channel: "Hospital", currency: "EUR", price: 38, priceType: "HT", date: "2024-11-15", sourceLabel: "Distributeur DOM", confidence: 82 }, 2),
  mk({ productId: "p2", brand: "ORLIMAN", market: "FR", channel: "Pharmacie", currency: "EUR", price: 78, priceType: "TTC", date: "2024-12-02", sourceLabel: "Retail panel", confidence: 88 }, 3),
  mk({ productId: "p2", brand: "ORLIMAN", market: "GP", channel: "Hospital", currency: "EUR", price: 72, priceType: "HT", date: "2024-11-28", sourceLabel: "Distributeur DOM", confidence: 84 }, 4),
  mk({ productId: "p3", brand: "ORLIMAN", market: "FR", channel: "Pharmacie", currency: "EUR", price: 64, priceType: "TTC", date: "2024-12-03", sourceLabel: "E-commerce", confidence: 86 }, 5),
  mk({ productId: "p3", brand: "ORLIMAN", market: "UE", channel: "Retail", currency: "EUR", price: 58, priceType: "HT", date: "2024-11-05", sourceLabel: "Distributeur UE", confidence: 80 }, 6),
  mk({ productId: "p4", brand: "ORLIMAN", market: "FR", channel: "Hospital", currency: "EUR", price: 112, priceType: "HT", date: "2024-12-01", sourceLabel: "CHU", confidence: 75 }, 7),
  mk({ productId: "p5", brand: "ORLIMAN", market: "FR", channel: "Pharmacie", currency: "EUR", price: 28, priceType: "TTC", date: "2024-11-20", sourceLabel: "Retail panel", confidence: 90 }, 8),
  mk({ productId: "p6", brand: "ORLIMAN", market: "FR", channel: "Sport", currency: "EUR", price: 22, priceType: "TTC", date: "2024-12-04", sourceLabel: "E-commerce", confidence: 87 }, 9),
  mk({ productId: "p7", brand: "ORLIMAN", market: "FR", channel: "Pharmacie", currency: "EUR", price: 52, priceType: "TTC", date: "2024-12-04", sourceLabel: "Retail panel", confidence: 84 }, 10),
  mk({ productId: "p8", brand: "ORLIMAN", market: "FR", channel: "Hospital", currency: "EUR", price: 134, priceType: "HT", date: "2024-12-05", sourceLabel: "CHU", confidence: 78 }, 11),
  mk({ productId: "p9", brand: "ORLIMAN", market: "UE", channel: "Retail", currency: "EUR", price: 62, priceType: "HT", date: "2024-11-18", sourceLabel: "Distributeur UE", confidence: 80 }, 12),
  mk({ productId: "p10", brand: "ORLIMAN", market: "GP", channel: "Hospital", currency: "EUR", price: 118, priceType: "HT", date: "2024-11-30", sourceLabel: "Distributeur DOM", confidence: 77 }, 13),
  mk({ productId: "p11", brand: "ORLIMAN", market: "FR", channel: "Sport", currency: "EUR", price: 19, priceType: "TTC", date: "2024-12-06", sourceLabel: "Retail panel", confidence: 90 }, 14),

  // Competitors - Chevillere
  mk({ productId: "p1", brand: "THUASNE", market: "FR", channel: "Pharmacie", currency: "EUR", price: 39, priceType: "TTC", date: "2024-12-01", sourceLabel: "Retail panel", confidence: 90 }, 15),
  mk({ productId: "p1", brand: "DONJOY_ENOVIS", market: "FR", channel: "Pharmacie", currency: "EUR", price: 44, priceType: "TTC", date: "2024-11-25", sourceLabel: "Retail panel", confidence: 85 }, 16),
  mk({ productId: "p1", brand: "GIBAUD", market: "FR", channel: "Pharmacie", currency: "EUR", price: 36, priceType: "TTC", date: "2024-11-18", sourceLabel: "Retail panel", confidence: 82 }, 17),
  mk({ productId: "p1", brand: "THUASNE", market: "MQ", channel: "Hospital", currency: "EUR", price: 35, priceType: "HT", date: "2024-11-15", sourceLabel: "Distributeur DOM", confidence: 78 }, 18),
  mk({ productId: "p1", brand: "GIBAUD", market: "MQ", channel: "Hospital", currency: "EUR", price: 34, priceType: "HT", date: "2024-11-16", sourceLabel: "Distributeur DOM", confidence: 72 }, 19),

  // Genou
  mk({ productId: "p2", brand: "THUASNE", market: "FR", channel: "Pharmacie", currency: "EUR", price: 74, priceType: "TTC", date: "2024-12-01", sourceLabel: "Retail panel", confidence: 88 }, 20),
  mk({ productId: "p2", brand: "DONJOY_ENOVIS", market: "FR", channel: "Pharmacie", currency: "EUR", price: 92, priceType: "TTC", date: "2024-11-28", sourceLabel: "Retail panel", confidence: 86 }, 21),
  mk({ productId: "p2", brand: "GIBAUD", market: "FR", channel: "Pharmacie", currency: "EUR", price: 69, priceType: "TTC", date: "2024-11-30", sourceLabel: "Retail panel", confidence: 82 }, 22),
  mk({ productId: "p2", brand: "THUASNE", market: "GP", channel: "Hospital", currency: "EUR", price: 68, priceType: "HT", date: "2024-11-26", sourceLabel: "Distributeur DOM", confidence: 80 }, 23),
  mk({ productId: "p2", brand: "DONJOY_ENOVIS", market: "GP", channel: "Hospital", currency: "EUR", price: 76, priceType: "HT", date: "2024-11-27", sourceLabel: "Distributeur DOM", confidence: 78 }, 24),

  // Ceinture
  mk({ productId: "p3", brand: "THUASNE", market: "FR", channel: "Pharmacie", currency: "EUR", price: 59, priceType: "TTC", date: "2024-12-03", sourceLabel: "Retail panel", confidence: 86 }, 25),
  mk({ productId: "p3", brand: "GIBAUD", market: "FR", channel: "Pharmacie", currency: "EUR", price: 55, priceType: "TTC", date: "2024-11-29", sourceLabel: "Retail panel", confidence: 84 }, 26),
  mk({ productId: "p3", brand: "DONJOY_ENOVIS", market: "UE", channel: "Retail", currency: "EUR", price: 62, priceType: "HT", date: "2024-11-20", sourceLabel: "Distributeur UE", confidence: 78 }, 27),
  mk({ productId: "p3", brand: "THUASNE", market: "UE", channel: "Retail", currency: "EUR", price: 60, priceType: "HT", date: "2024-11-21", sourceLabel: "Distributeur UE", confidence: 76 }, 28),

  // Epaule
  mk({ productId: "p4", brand: "THUASNE", market: "FR", channel: "Hospital", currency: "EUR", price: 104, priceType: "HT", date: "2024-12-01", sourceLabel: "CHU", confidence: 74 }, 29),
  mk({ productId: "p4", brand: "DONJOY_ENOVIS", market: "FR", channel: "Hospital", currency: "EUR", price: 118, priceType: "HT", date: "2024-11-22", sourceLabel: "CHU", confidence: 76 }, 30),
  mk({ productId: "p4", brand: "GIBAUD", market: "FR", channel: "Hospital", currency: "EUR", price: 96, priceType: "HT", date: "2024-11-25", sourceLabel: "CHU", confidence: 70 }, 31),

  // Cervical
  mk({ productId: "p5", brand: "THUASNE", market: "FR", channel: "Pharmacie", currency: "EUR", price: 25, priceType: "TTC", date: "2024-12-02", sourceLabel: "Retail panel", confidence: 90 }, 32),
  mk({ productId: "p5", brand: "GIBAUD", market: "FR", channel: "Pharmacie", currency: "EUR", price: 23, priceType: "TTC", date: "2024-11-22", sourceLabel: "Retail panel", confidence: 85 }, 33),
  mk({ productId: "p5", brand: "DONJOY_ENOVIS", market: "FR", channel: "Pharmacie", currency: "EUR", price: 27, priceType: "TTC", date: "2024-11-26", sourceLabel: "Retail panel", confidence: 83 }, 34),

  // Poignet
  mk({ productId: "p6", brand: "THUASNE", market: "FR", channel: "Sport", currency: "EUR", price: 20, priceType: "TTC", date: "2024-12-03", sourceLabel: "E-commerce", confidence: 85 }, 35),
  mk({ productId: "p6", brand: "DONJOY_ENOVIS", market: "FR", channel: "Sport", currency: "EUR", price: 24, priceType: "TTC", date: "2024-11-29", sourceLabel: "E-commerce", confidence: 82 }, 36),
  mk({ productId: "p6", brand: "GIBAUD", market: "FR", channel: "Sport", currency: "EUR", price: 18, priceType: "TTC", date: "2024-11-28", sourceLabel: "E-commerce", confidence: 80 }, 37),

  // Premium chevillère
  mk({ productId: "p7", brand: "THUASNE", market: "FR", channel: "Pharmacie", currency: "EUR", price: 49, priceType: "TTC", date: "2024-12-04", sourceLabel: "Retail panel", confidence: 84 }, 38),
  mk({ productId: "p7", brand: "DONJOY_ENOVIS", market: "FR", channel: "Pharmacie", currency: "EUR", price: 58, priceType: "TTC", date: "2024-12-01", sourceLabel: "Retail panel", confidence: 86 }, 39),
  mk({ productId: "p7", brand: "GIBAUD", market: "FR", channel: "Pharmacie", currency: "EUR", price: 47, priceType: "TTC", date: "2024-11-30", sourceLabel: "Retail panel", confidence: 80 }, 40),

  // Genou ligamentaire
  mk({ productId: "p8", brand: "THUASNE", market: "FR", channel: "Hospital", currency: "EUR", price: 126, priceType: "HT", date: "2024-12-03", sourceLabel: "CHU", confidence: 74 }, 41),
  mk({ productId: "p8", brand: "DONJOY_ENOVIS", market: "FR", channel: "Hospital", currency: "EUR", price: 146, priceType: "HT", date: "2024-11-27", sourceLabel: "CHU", confidence: 78 }, 42),
  mk({ productId: "p8", brand: "GIBAUD", market: "FR", channel: "Hospital", currency: "EUR", price: 120, priceType: "HT", date: "2024-11-29", sourceLabel: "CHU", confidence: 70 }, 43),

  // Ceinture posture
  mk({ productId: "p9", brand: "THUASNE", market: "UE", channel: "Retail", currency: "EUR", price: 60, priceType: "HT", date: "2024-11-22", sourceLabel: "Distributeur UE", confidence: 76 }, 44),
  mk({ productId: "p9", brand: "DONJOY_ENOVIS", market: "UE", channel: "Retail", currency: "EUR", price: 66, priceType: "HT", date: "2024-11-24", sourceLabel: "Distributeur UE", confidence: 78 }, 45),

  // Epaule cryo
  mk({ productId: "p10", brand: "THUASNE", market: "GP", channel: "Hospital", currency: "EUR", price: 110, priceType: "HT", date: "2024-11-28", sourceLabel: "Distributeur DOM", confidence: 75 }, 46),
  mk({ productId: "p10", brand: "DONJOY_ENOVIS", market: "GP", channel: "Hospital", currency: "EUR", price: 126, priceType: "HT", date: "2024-11-27", sourceLabel: "Distributeur DOM", confidence: 74 }, 47),
  mk({ productId: "p10", brand: "GIBAUD", market: "GP", channel: "Hospital", currency: "EUR", price: 108, priceType: "HT", date: "2024-11-26", sourceLabel: "Distributeur DOM", confidence: 70 }, 48),

  // Poignet rapide
  mk({ productId: "p11", brand: "THUASNE", market: "FR", channel: "Sport", currency: "EUR", price: 18, priceType: "TTC", date: "2024-12-04", sourceLabel: "E-commerce", confidence: 86 }, 49),
  mk({ productId: "p11", brand: "GIBAUD", market: "FR", channel: "Sport", currency: "EUR", price: 17, priceType: "TTC", date: "2024-11-29", sourceLabel: "E-commerce", confidence: 83 }, 50),
  mk({ productId: "p11", brand: "DONJOY_ENOVIS", market: "FR", channel: "Sport", currency: "EUR", price: 20, priceType: "TTC", date: "2024-11-30", sourceLabel: "E-commerce", confidence: 80 }, 51),
];
