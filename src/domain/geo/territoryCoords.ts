export type TerritoryCoord = {
  code: string;
  name: string;
  lat: number;
  lng: number;
};

// Source de vérité minimale pour les territoires export / DROM + quelques pays UE
export const TERRITORY_COORDS: Record<string, TerritoryCoord> = {
  HUB: { code: "HUB", name: "MPL Conseil Export FR", lat: 48.86, lng: 2.35 },
  GP: { code: "GP", name: "Guadeloupe", lat: 16.25, lng: -61.55 },
  MQ: { code: "MQ", name: "Martinique", lat: 14.64, lng: -61.02 },
  GF: { code: "GF", name: "Guyane", lat: 3.93, lng: -53.12 },
  RE: { code: "RE", name: "Réunion", lat: -21.12, lng: 55.54 },
  YT: { code: "YT", name: "Mayotte", lat: -12.83, lng: 45.16 },
  BL: { code: "BL", name: "Saint-Barthélemy", lat: 17.90, lng: -62.85 },
  MF: { code: "MF", name: "Saint-Martin", lat: 18.07, lng: -63.05 },
  BE: { code: "BE", name: "Belgique", lat: 50.85, lng: 4.35 },
  CH: { code: "CH", name: "Suisse", lat: 46.20, lng: 6.14 },
  LU: { code: "LU", name: "Luxembourg", lat: 49.61, lng: 6.13 },
};

export function getCoord(code: string): TerritoryCoord | undefined {
  return TERRITORY_COORDS[code];
}
