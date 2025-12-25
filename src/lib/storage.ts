export const loadJson = <T>(key: string, fallback: T): T => {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch (e) {
    console.warn(`loadJson failed for ${key}`, e);
    return fallback;
  }
};

export const saveJson = <T>(key: string, data: T) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.warn(`saveJson failed for ${key}`, e);
  }
};

export const STORAGE_KEYS = {
  competitors: "en_competitors",
  products: "en_products",
  pricePoints: "en_price_points",
};
