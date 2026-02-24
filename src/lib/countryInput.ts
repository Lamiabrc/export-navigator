const COUNTRY_ALIASES: Record<string, string> = {
  portugal: "Portugal",
  espagne: "Espagne",
  spain: "Espagne",
  france: "France",
  allemagne: "Allemagne",
  germany: "Allemagne",
  italie: "Italie",
  italy: "Italie",
  belgique: "Belgique",
  belgium: "Belgique",
  "pays bas": "Pays-Bas",
  netherlands: "Pays-Bas",
  hollande: "Pays-Bas",
  irlande: "Irlande",
  ireland: "Irlande",
  autriche: "Autriche",
  austria: "Autriche",
  pologne: "Pologne",
  poland: "Pologne",
  suede: "Suede",
  sweden: "Suede",
  norvege: "Norvege",
  norway: "Norvege",
  danemark: "Danemark",
  denmark: "Danemark",
  finlande: "Finlande",
  finland: "Finlande",
  roumanie: "Roumanie",
  romania: "Roumanie",
  grece: "Grece",
  greece: "Grece",
  "republique tcheque": "Republique tcheque",
  czechia: "Republique tcheque",
  hongrie: "Hongrie",
  hungary: "Hongrie",
  bulgarie: "Bulgarie",
  bulgaria: "Bulgarie",
  croatie: "Croatie",
  croatia: "Croatie",
  slovaquie: "Slovaquie",
  slovakia: "Slovaquie",
  slovenie: "Slovenie",
  slovenia: "Slovenie",
  lituanie: "Lituanie",
  lithuania: "Lituanie",
  lettonie: "Lettonie",
  latvia: "Lettonie",
  estonie: "Estonie",
  estonia: "Estonie",
  chypre: "Chypre",
  cyprus: "Chypre",
  malte: "Malte",
  malta: "Malte",
  usa: "USA",
  "etats unis": "USA",
  "united states": "USA",
  "royaume uni": "Royaume-Uni",
  uk: "Royaume-Uni",
  "united kingdom": "Royaume-Uni",
  chine: "Chine",
  china: "Chine",
  japon: "Japon",
  japan: "Japon",
  canada: "Canada",
  maroc: "Maroc",
  morocco: "Maroc",
  turquie: "Turquie",
  turkey: "Turquie",
  uruguay: "Uruguay",
  mexique: "Mexique",
  mexico: "Mexique",
  bresil: "Bresil",
  brazil: "Bresil",
  inde: "Inde",
  india: "Inde",
};

function normalize(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

export function detectCountryFromShortInput(value: string) {
  const normalized = normalize(value);
  if (!normalized) return null;

  const words = normalized.split(" ").filter(Boolean);
  if (words.length < 1 || words.length > 2) return null;

  return COUNTRY_ALIASES[normalized] || null;
}
