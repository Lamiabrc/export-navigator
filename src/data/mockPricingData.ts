import type { PricePoint, Product, PricingConfig } from "@/types/pricing";

export const pricingConfig: PricingConfig = {
  premiumThreshold: 10, // % au-dessus de la moyenne concurrent
  alignLow: -5, // % vs moyenne : sous-positionné en dessous de -5%
  alignHigh: 5, // % vs moyenne : considéré aligné entre -5% et +5%
  minConfidence: 65,
};

export const products: Product[] = [
  { product_id: "p1", id: "p1", sku: "ORL-CH-001", product_name: "Chevillere ligamento", name: "Chevillere ligamento", category: "Chevillere", lpp_code: "201A", lppCode: "201A", cost: 18 },
  { product_id: "p2", id: "p2", sku: "ORL-GN-002", product_name: "Genouillere sport", name: "Genouillere sport", category: "Genou", lpp_code: "301B", lppCode: "301B", cost: 24 },
  { product_id: "p3", id: "p3", sku: "ORL-CE-003", product_name: "Ceinture lombaire", name: "Ceinture lombaire", category: "Ceinture", lpp_code: "501C", lppCode: "501C", cost: 28 },
  { product_id: "p4", id: "p4", sku: "ORL-EP-004", product_name: "Épaule stabilisation", name: "Épaule stabilisation", category: "Epaule", cost: 32 },
  { product_id: "p5", id: "p5", sku: "ORL-CO-005", product_name: "Collier cervical", name: "Collier cervical", category: "Cervical", lpp_code: "101D", lppCode: "101D", cost: 9 },
  { product_id: "p6", id: "p6", sku: "ORL-PO-006", product_name: "Poignet strap", name: "Poignet strap", category: "Poignet", cost: 8 },
  { product_id: "p7", id: "p7", sku: "ORL-CH-007", product_name: "Chevillere premium gel", name: "Chevillere premium gel", category: "Chevillere", lpp_code: "201A", lppCode: "201A", cost: 22 },
  { product_id: "p8", id: "p8", sku: "ORL-GN-008", product_name: "Genouillere ligamentaire", name: "Genouillere ligamentaire", category: "Genou", lpp_code: "301B", lppCode: "301B", cost: 35 },
  { product_id: "p9", id: "p9", sku: "ORL-CE-009", product_name: "Ceinture posture active", name: "Ceinture posture active", category: "Ceinture", cost: 26 },
  { product_id: "p10", id: "p10", sku: "ORL-EP-010", product_name: "Épaule cryo", name: "Épaule cryo", category: "Epaule", cost: 30 },
  { product_id: "p11", id: "p11", sku: "ORL-PO-011", product_name: "Poignet rapide", name: "Poignet rapide", category: "Poignet", cost: 7 },
];

const mk = (partial: Omit<PricePoint, "price_id">, id: number): PricePoint => ({
  price_id: `pp-${id}`,
  id: `pp-${id}`,
  ...partial,
});

export const pricePoints: PricePoint[] = [
  // ORLIMAN baseline
  mk({ product_id: "p1", productId: "p1", brand: "ORLIMAN", market: "FR", channel: "Pharmacie", currency: "EUR", price: 42, price_type: "TTC", priceType: "TTC", date: "2024-12-01", source_label: "Sell-out retail", sourceLabel: "Sell-out retail", confidence: 90 }, 1),
  mk({ product_id: "p1", productId: "p1", brand: "ORLIMAN", market: "MQ", channel: "Hospital", currency: "EUR", price: 38, price_type: "HT", priceType: "HT", date: "2024-11-15", source_label: "Distributeur DOM", sourceLabel: "Distributeur DOM", confidence: 82 }, 2),
  mk({ product_id: "p2", productId: "p2", brand: "ORLIMAN", market: "FR", channel: "Pharmacie", currency: "EUR", price: 78, price_type: "TTC", priceType: "TTC", date: "2024-12-02", source_label: "Retail panel", sourceLabel: "Retail panel", confidence: 88 }, 3),
  mk({ product_id: "p2", productId: "p2", brand: "ORLIMAN", market: "GP", channel: "Hospital", currency: "EUR", price: 72, price_type: "HT", priceType: "HT", date: "2024-11-28", source_label: "Distributeur DOM", sourceLabel: "Distributeur DOM", confidence: 84 }, 4),
  mk({ product_id: "p3", productId: "p3", brand: "ORLIMAN", market: "FR", channel: "Pharmacie", currency: "EUR", price: 64, price_type: "TTC", priceType: "TTC", date: "2024-12-03", source_label: "E-commerce", sourceLabel: "E-commerce", confidence: 86 }, 5),
  mk({ product_id: "p3", productId: "p3", brand: "ORLIMAN", market: "UE", channel: "Retail", currency: "EUR", price: 58, price_type: "HT", priceType: "HT", date: "2024-11-05", source_label: "Distributeur UE", sourceLabel: "Distributeur UE", confidence: 80 }, 6),
  mk({ product_id: "p4", productId: "p4", brand: "ORLIMAN", market: "FR", channel: "Hospital", currency: "EUR", price: 112, price_type: "HT", priceType: "HT", date: "2024-12-01", source_label: "CHU", sourceLabel: "CHU", confidence: 75 }, 7),
  mk({ product_id: "p5", productId: "p5", brand: "ORLIMAN", market: "FR", channel: "Pharmacie", currency: "EUR", price: 28, price_type: "TTC", priceType: "TTC", date: "2024-11-20", source_label: "Retail panel", sourceLabel: "Retail panel", confidence: 90 }, 8),
  mk({ product_id: "p6", productId: "p6", brand: "ORLIMAN", market: "FR", channel: "Sport", currency: "EUR", price: 22, price_type: "TTC", priceType: "TTC", date: "2024-12-04", source_label: "E-commerce", sourceLabel: "E-commerce", confidence: 87 }, 9),
  mk({ product_id: "p7", productId: "p7", brand: "ORLIMAN", market: "FR", channel: "Pharmacie", currency: "EUR", price: 52, price_type: "TTC", priceType: "TTC", date: "2024-12-04", source_label: "Retail panel", sourceLabel: "Retail panel", confidence: 84 }, 10),
  mk({ product_id: "p8", productId: "p8", brand: "ORLIMAN", market: "FR", channel: "Hospital", currency: "EUR", price: 134, price_type: "HT", priceType: "HT", date: "2024-12-05", source_label: "CHU", sourceLabel: "CHU", confidence: 78 }, 11),
  mk({ product_id: "p9", productId: "p9", brand: "ORLIMAN", market: "UE", channel: "Retail", currency: "EUR", price: 62, price_type: "HT", priceType: "HT", date: "2024-11-18", source_label: "Distributeur UE", sourceLabel: "Distributeur UE", confidence: 80 }, 12),
  mk({ product_id: "p10", productId: "p10", brand: "ORLIMAN", market: "GP", channel: "Hospital", currency: "EUR", price: 118, price_type: "HT", priceType: "HT", date: "2024-11-30", source_label: "Distributeur DOM", sourceLabel: "Distributeur DOM", confidence: 77 }, 13),
  mk({ product_id: "p11", productId: "p11", brand: "ORLIMAN", market: "FR", channel: "Sport", currency: "EUR", price: 19, price_type: "TTC", priceType: "TTC", date: "2024-12-06", source_label: "Retail panel", sourceLabel: "Retail panel", confidence: 90 }, 14),

  // Competitors - Chevillere
  mk({ product_id: "p1", productId: "p1", brand: "THUASNE", market: "FR", channel: "Pharmacie", currency: "EUR", price: 39, price_type: "TTC", priceType: "TTC", date: "2024-12-01", source_label: "Retail panel", sourceLabel: "Retail panel", confidence: 90 }, 15),
  mk({ product_id: "p1", productId: "p1", brand: "DONJOY_ENOVIS", market: "FR", channel: "Pharmacie", currency: "EUR", price: 44, price_type: "TTC", priceType: "TTC", date: "2024-11-25", source_label: "Retail panel", sourceLabel: "Retail panel", confidence: 85 }, 16),
  mk({ product_id: "p1", productId: "p1", brand: "GIBAUD", market: "FR", channel: "Pharmacie", currency: "EUR", price: 36, price_type: "TTC", priceType: "TTC", date: "2024-11-18", source_label: "Retail panel", sourceLabel: "Retail panel", confidence: 82 }, 17),
  mk({ product_id: "p1", productId: "p1", brand: "THUASNE", market: "MQ", channel: "Hospital", currency: "EUR", price: 35, price_type: "HT", priceType: "HT", date: "2024-11-15", source_label: "Distributeur DOM", sourceLabel: "Distributeur DOM", confidence: 78 }, 18),
  mk({ product_id: "p1", productId: "p1", brand: "GIBAUD", market: "MQ", channel: "Hospital", currency: "EUR", price: 34, price_type: "HT", priceType: "HT", date: "2024-11-16", source_label: "Distributeur DOM", sourceLabel: "Distributeur DOM", confidence: 72 }, 19),

  // Genou
  mk({ product_id: "p2", productId: "p2", brand: "THUASNE", market: "FR", channel: "Pharmacie", currency: "EUR", price: 74, price_type: "TTC", priceType: "TTC", date: "2024-12-01", source_label: "Retail panel", sourceLabel: "Retail panel", confidence: 88 }, 20),
  mk({ product_id: "p2", productId: "p2", brand: "DONJOY_ENOVIS", market: "FR", channel: "Pharmacie", currency: "EUR", price: 92, price_type: "TTC", priceType: "TTC", date: "2024-11-28", source_label: "Retail panel", sourceLabel: "Retail panel", confidence: 86 }, 21),
  mk({ product_id: "p2", productId: "p2", brand: "GIBAUD", market: "FR", channel: "Pharmacie", currency: "EUR", price: 69, price_type: "TTC", priceType: "TTC", date: "2024-11-30", source_label: "Retail panel", sourceLabel: "Retail panel", confidence: 82 }, 22),
  mk({ product_id: "p2", productId: "p2", brand: "THUASNE", market: "GP", channel: "Hospital", currency: "EUR", price: 68, price_type: "HT", priceType: "HT", date: "2024-11-26", source_label: "Distributeur DOM", sourceLabel: "Distributeur DOM", confidence: 80 }, 23),
  mk({ product_id: "p2", productId: "p2", brand: "DONJOY_ENOVIS", market: "GP", channel: "Hospital", currency: "EUR", price: 76, price_type: "HT", priceType: "HT", date: "2024-11-27", source_label: "Distributeur DOM", sourceLabel: "Distributeur DOM", confidence: 78 }, 24),

  // Ceinture
  mk({ product_id: "p3", productId: "p3", brand: "THUASNE", market: "FR", channel: "Pharmacie", currency: "EUR", price: 59, price_type: "TTC", priceType: "TTC", date: "2024-12-03", source_label: "Retail panel", sourceLabel: "Retail panel", confidence: 86 }, 25),
  mk({ product_id: "p3", productId: "p3", brand: "GIBAUD", market: "FR", channel: "Pharmacie", currency: "EUR", price: 55, price_type: "TTC", priceType: "TTC", date: "2024-11-29", source_label: "Retail panel", sourceLabel: "Retail panel", confidence: 84 }, 26),
  mk({ product_id: "p3", productId: "p3", brand: "DONJOY_ENOVIS", market: "UE", channel: "Retail", currency: "EUR", price: 62, price_type: "HT", priceType: "HT", date: "2024-11-20", source_label: "Distributeur UE", sourceLabel: "Distributeur UE", confidence: 78 }, 27),
  mk({ product_id: "p3", productId: "p3", brand: "THUASNE", market: "UE", channel: "Retail", currency: "EUR", price: 60, price_type: "HT", priceType: "HT", date: "2024-11-21", source_label: "Distributeur UE", sourceLabel: "Distributeur UE", confidence: 76 }, 28),

  // Epaule
  mk({ product_id: "p4", productId: "p4", brand: "THUASNE", market: "FR", channel: "Hospital", currency: "EUR", price: 104, price_type: "HT", priceType: "HT", date: "2024-12-01", source_label: "CHU", sourceLabel: "CHU", confidence: 74 }, 29),
  mk({ product_id: "p4", productId: "p4", brand: "DONJOY_ENOVIS", market: "FR", channel: "Hospital", currency: "EUR", price: 118, price_type: "HT", priceType: "HT", date: "2024-11-22", source_label: "CHU", sourceLabel: "CHU", confidence: 76 }, 30),
  mk({ product_id: "p4", productId: "p4", brand: "GIBAUD", market: "FR", channel: "Hospital", currency: "EUR", price: 96, price_type: "HT", priceType: "HT", date: "2024-11-25", source_label: "CHU", sourceLabel: "CHU", confidence: 70 }, 31),

  // Cervical
  mk({ product_id: "p5", productId: "p5", brand: "THUASNE", market: "FR", channel: "Pharmacie", currency: "EUR", price: 25, price_type: "TTC", priceType: "TTC", date: "2024-12-02", source_label: "Retail panel", sourceLabel: "Retail panel", confidence: 90 }, 32),
  mk({ product_id: "p5", productId: "p5", brand: "GIBAUD", market: "FR", channel: "Pharmacie", currency: "EUR", price: 23, price_type: "TTC", priceType: "TTC", date: "2024-11-22", source_label: "Retail panel", sourceLabel: "Retail panel", confidence: 85 }, 33),
  mk({ product_id: "p5", productId: "p5", brand: "DONJOY_ENOVIS", market: "FR", channel: "Pharmacie", currency: "EUR", price: 27, price_type: "TTC", priceType: "TTC", date: "2024-11-26", source_label: "Retail panel", sourceLabel: "Retail panel", confidence: 83 }, 34),

  // Poignet
  mk({ product_id: "p6", productId: "p6", brand: "THUASNE", market: "FR", channel: "Sport", currency: "EUR", price: 20, price_type: "TTC", priceType: "TTC", date: "2024-12-03", source_label: "E-commerce", sourceLabel: "E-commerce", confidence: 85 }, 35),
  mk({ product_id: "p6", productId: "p6", brand: "DONJOY_ENOVIS", market: "FR", channel: "Sport", currency: "EUR", price: 24, price_type: "TTC", priceType: "TTC", date: "2024-11-29", source_label: "E-commerce", sourceLabel: "E-commerce", confidence: 82 }, 36),
  mk({ product_id: "p6", productId: "p6", brand: "GIBAUD", market: "FR", channel: "Sport", currency: "EUR", price: 18, price_type: "TTC", priceType: "TTC", date: "2024-11-28", source_label: "E-commerce", sourceLabel: "E-commerce", confidence: 80 }, 37),

  // Premium chevillère
  mk({ product_id: "p7", productId: "p7", brand: "THUASNE", market: "FR", channel: "Pharmacie", currency: "EUR", price: 49, price_type: "TTC", priceType: "TTC", date: "2024-12-04", source_label: "Retail panel", sourceLabel: "Retail panel", confidence: 84 }, 38),
  mk({ product_id: "p7", productId: "p7", brand: "DONJOY_ENOVIS", market: "FR", channel: "Pharmacie", currency: "EUR", price: 58, price_type: "TTC", priceType: "TTC", date: "2024-12-01", source_label: "Retail panel", sourceLabel: "Retail panel", confidence: 86 }, 39),
  mk({ product_id: "p7", productId: "p7", brand: "GIBAUD", market: "FR", channel: "Pharmacie", currency: "EUR", price: 47, price_type: "TTC", priceType: "TTC", date: "2024-11-30", source_label: "Retail panel", sourceLabel: "Retail panel", confidence: 80 }, 40),

  // Genou ligamentaire
  mk({ product_id: "p8", productId: "p8", brand: "THUASNE", market: "FR", channel: "Hospital", currency: "EUR", price: 126, price_type: "HT", priceType: "HT", date: "2024-12-03", source_label: "CHU", sourceLabel: "CHU", confidence: 74 }, 41),
  mk({ product_id: "p8", productId: "p8", brand: "DONJOY_ENOVIS", market: "FR", channel: "Hospital", currency: "EUR", price: 146, price_type: "HT", priceType: "HT", date: "2024-11-27", source_label: "CHU", sourceLabel: "CHU", confidence: 78 }, 42),
  mk({ product_id: "p8", productId: "p8", brand: "GIBAUD", market: "FR", channel: "Hospital", currency: "EUR", price: 120, price_type: "HT", priceType: "HT", date: "2024-11-29", source_label: "CHU", sourceLabel: "CHU", confidence: 70 }, 43),

  // Ceinture posture
  mk({ product_id: "p9", productId: "p9", brand: "THUASNE", market: "UE", channel: "Retail", currency: "EUR", price: 60, price_type: "HT", priceType: "HT", date: "2024-11-22", source_label: "Distributeur UE", sourceLabel: "Distributeur UE", confidence: 76 }, 44),
  mk({ product_id: "p9", productId: "p9", brand: "DONJOY_ENOVIS", market: "UE", channel: "Retail", currency: "EUR", price: 66, price_type: "HT", priceType: "HT", date: "2024-11-24", source_label: "Distributeur UE", sourceLabel: "Distributeur UE", confidence: 78 }, 45),

  // Epaule cryo
  mk({ product_id: "p10", productId: "p10", brand: "THUASNE", market: "GP", channel: "Hospital", currency: "EUR", price: 110, price_type: "HT", priceType: "HT", date: "2024-11-28", source_label: "Distributeur DOM", sourceLabel: "Distributeur DOM", confidence: 75 }, 46),
  mk({ product_id: "p10", productId: "p10", brand: "DONJOY_ENOVIS", market: "GP", channel: "Hospital", currency: "EUR", price: 126, price_type: "HT", priceType: "HT", date: "2024-11-27", source_label: "Distributeur DOM", sourceLabel: "Distributeur DOM", confidence: 74 }, 47),
  mk({ product_id: "p10", productId: "p10", brand: "GIBAUD", market: "GP", channel: "Hospital", currency: "EUR", price: 108, price_type: "HT", priceType: "HT", date: "2024-11-26", source_label: "Distributeur DOM", sourceLabel: "Distributeur DOM", confidence: 70 }, 48),

  // Poignet rapide
  mk({ product_id: "p11", productId: "p11", brand: "THUASNE", market: "FR", channel: "Sport", currency: "EUR", price: 18, price_type: "TTC", priceType: "TTC", date: "2024-12-04", source_label: "E-commerce", sourceLabel: "E-commerce", confidence: 86 }, 49),
  mk({ product_id: "p11", productId: "p11", brand: "GIBAUD", market: "FR", channel: "Sport", currency: "EUR", price: 17, price_type: "TTC", priceType: "TTC", date: "2024-11-29", source_label: "E-commerce", sourceLabel: "E-commerce", confidence: 83 }, 50),
  mk({ product_id: "p11", productId: "p11", brand: "DONJOY_ENOVIS", market: "FR", channel: "Sport", currency: "EUR", price: 20, price_type: "TTC", priceType: "TTC", date: "2024-11-30", source_label: "E-commerce", sourceLabel: "E-commerce", confidence: 80 }, 51),
];
