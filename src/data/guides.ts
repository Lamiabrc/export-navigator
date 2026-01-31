export type GuideDoc = {
  slug: string;
  title: string;
  description?: string;
  updatedAt?: string; // ISO string
  readingTime?: string;
  tags?: string[];
  content: string; // markdown-like text (rendered as plain text / pre-line)
};

export const GUIDES: GuideDoc[] = [
  {
    slug: "incoterms-ddp",
    title: "Incoterms : comprendre DDP (et éviter les pièges)",
    description:
      "DDP = Delivered Duty Paid. Le vendeur prend (presque) tout en charge. Cas d’usage, risques, checklist.",
    updatedAt: new Date().toISOString(),
    readingTime: "6 min",
    tags: ["Incoterms", "DDP", "Douane", "TVA"],
    content: `
## DDP : définition simple
DDP (Delivered Duty Paid) signifie que le vendeur livre au lieu convenu dans le pays de destination,
et prend en charge les formalités et coûts : transport, droits, taxes (selon le cas), et souvent la
gestion douanière import.

## Les pièges fréquents
- TVA import / TVA locale : qui est redevable ? quelles obligations d’immatriculation ?
- Représentation douanière : qui peut déclarer ? à quel nom ?
- Facturation et incoterm incohérents (FOB + transport payé, etc.)
- Coûts cachés : stockage, surestaries/demurrage, inspection, frais de dossier

## Checklist DDP (ultra pratique)
1. Confirmer : HS + restrictions + licences éventuelles
2. Déterminer : valeur en douane, droits, taxes, base TVA
3. Vérifier : EORI, immatriculation TVA locale si nécessaire
4. Définir : qui déclare (agent, représentant), et sur quel identifiant
5. Sécuriser : documents (facture, packing list, origine, transport)
6. Clarifier : Incoterm, lieu exact, transfert de risques, assurance

## Recommandation MPL
Utiliser DDP uniquement si :
- tu maîtrises l’import dans le pays,
- tu as un partenaire/agent fiable,
- et tu as validé fiscalité + conformité.
Sinon, DAP / DPU ou FCA/CPT peuvent être plus “safe”.
`.trim(),
  },
];

export function getGuideBySlug(slug: string | undefined | null): GuideDoc | null {
  if (!slug) return null;
  const s = String(slug).trim().toLowerCase();
  return GUIDES.find((g) => g.slug.toLowerCase() === s) ?? null;
}

export default GUIDES;
