export type IncotermCostItem = {
  label: string;
  detail: string;
};

export type IncotermEntry = {
  code: string;
  slug: string;
  mode: "Tous modes" | "Maritime";
  intro: string;
  whenToUse: string[];
  costs: IncotermCostItem[];
  riskTransfer: string;
  documents: string[];
  example: string;
  mistakes: string[];
  nearby: string[];
};

export const INCOTERMS: IncotermEntry[] = [
  {
    code: "EXW",
    slug: "incoterms-exw",
    mode: "Tous modes",
    intro:
      "Le vendeur met la marchandise a disposition dans ses locaux. L'acheteur organise l'enlevement, le transport et les formalites export/import.",
    whenToUse: [
      "Quand l'acheteur a un transitaire local et pilote toute la logistique.",
      "Pour des enlevements simples dans le pays du vendeur.",
      "Si le vendeur veut limiter ses obligations au strict minimum.",
    ],
    costs: [
      { label: "Pre-acheminement", detail: "Acheteur" },
      { label: "Chargement au depart", detail: "Acheteur (sauf accord)" },
      { label: "Douane export", detail: "Acheteur" },
      { label: "Transport principal", detail: "Acheteur" },
      { label: "Assurance", detail: "Acheteur (optionnelle)" },
      { label: "Import / droits / TVA", detail: "Acheteur" },
    ],
    riskTransfer:
      "Risque transfere des la mise a disposition dans les locaux du vendeur, avant chargement sur le vehicule.",
    documents: [
      "Facture commerciale",
      "Packing list",
      "Ordre d'enlevement / instructions transport",
      "Declaration export (si geree par l'acheteur)",
      "Document de transport (CMR/AWB/BL)",
      "Assurance (optionnelle)",
    ],
    example:
      "Un acheteur belge mandate son transitaire pour enlever des palettes a Lyon ; le risque passe des la mise a disposition en entrepot.",
    mistakes: [
      "Choisir EXW alors que le vendeur doit gerer la douane export.",
      "Oublier de preciser qui charge le camion.",
      "Sous-estimer les obligations surete/conformite du vendeur.",
    ],
    nearby: ["FCA", "CPT", "DAP"],
  },
  {
    code: "FCA",
    slug: "incoterms-fca",
    mode: "Tous modes",
    intro:
      "Le vendeur remet la marchandise au transporteur designe par l'acheteur, au lieu convenu, apres dedouanement export.",
    whenToUse: [
      "Quand l'acheteur pilote le transport principal.",
      "Pour les expeditions conteneurisees.",
      "Quand le vendeur peut gerer la douane export.",
    ],
    costs: [
      { label: "Pre-acheminement", detail: "Vendeur" },
      { label: "Chargement", detail: "Vendeur si remise dans ses locaux" },
      { label: "Douane export", detail: "Vendeur" },
      { label: "Transport principal", detail: "Acheteur" },
      { label: "Assurance", detail: "Acheteur (optionnelle)" },
      { label: "Import / droits / TVA", detail: "Acheteur" },
    ],
    riskTransfer:
      "Au moment de la remise au transporteur au lieu nomme (entrepot, terminal, port sec...).",
    documents: [
      "Facture commerciale",
      "Packing list",
      "Declaration export",
      "Document de transport principal (CMR/AWB/BL)",
      "Preuve de remise au transporteur",
    ],
    example:
      "Le vendeur livre au terminal de Lille ; le transitaire de l'acheteur prend en charge le transport international.",
    mistakes: [
      "Lieu de remise imprecis ou incomplet.",
      "Confondre FCA et EXW sur la douane export.",
      "Ne pas clarifier qui charge quand la remise est hors site vendeur.",
    ],
    nearby: ["EXW", "CPT", "DAP"],
  },
  {
    code: "CPT",
    slug: "incoterms-cpt",
    mode: "Tous modes",
    intro:
      "Le vendeur paie le transport principal jusqu'au lieu nomme, mais le risque transfere des la remise au premier transporteur.",
    whenToUse: [
      "Quand le vendeur obtient de bons tarifs de transport.",
      "Pour des flux multimodaux (route + air + mer).",
      "Si l'acheteur prefere gerer l'assurance.",
    ],
    costs: [
      { label: "Pre-acheminement", detail: "Vendeur" },
      { label: "Douane export", detail: "Vendeur" },
      { label: "Transport principal", detail: "Vendeur" },
      { label: "Assurance", detail: "Acheteur (optionnelle)" },
      { label: "Import / droits / TVA", detail: "Acheteur" },
      { label: "Acheminement final", detail: "Acheteur" },
    ],
    riskTransfer:
      "Des la remise au premier transporteur, meme si le fret est paye jusqu'a destination.",
    documents: [
      "Facture commerciale",
      "Packing list",
      "Declaration export",
      "Document de transport (CMR/AWB/BL)",
      "Assurance (si prise par l'acheteur)",
    ],
    example:
      "Le vendeur paie le fret aerien jusqu'a Toronto, mais le risque passe a la remise au transitaire a Paris.",
    mistakes: [
      "Penser que le risque transfere a destination.",
      "Oublier de couvrir l'assurance transport.",
      "Lieu de destination trop vague ou incomplet.",
    ],
    nearby: ["CIP", "FCA", "DAP"],
  },
  {
    code: "CIP",
    slug: "incoterms-cip",
    mode: "Tous modes",
    intro:
      "Identique au CPT, mais le vendeur doit souscrire une assurance transport couvrant le trajet jusqu'au lieu nomme.",
    whenToUse: [
      "Marchandises a forte valeur ou sensibles.",
      "Quand l'acheteur veut une assurance incluse.",
      "Pour les transports multimodaux.",
    ],
    costs: [
      { label: "Pre-acheminement", detail: "Vendeur" },
      { label: "Douane export", detail: "Vendeur" },
      { label: "Transport principal", detail: "Vendeur" },
      { label: "Assurance", detail: "Vendeur (couverture renforcee)" },
      { label: "Import / droits / TVA", detail: "Acheteur" },
      { label: "Acheminement final", detail: "Acheteur" },
    ],
    riskTransfer:
      "Des la remise au premier transporteur, meme si l'assurance est payee jusqu'au lieu nomme.",
    documents: [
      "Facture commerciale",
      "Packing list",
      "Declaration export",
      "Document de transport (CMR/AWB/BL)",
      "Certificat d'assurance",
    ],
    example:
      "Le vendeur expedie des machines vers Montreal et fournit une assurance ICC A couvrant le trajet.",
    mistakes: [
      "Assurance minimale ou inadaptée a la valeur.",
      "Confondre transfert du risque et lieu de livraison.",
      "Oublier de preciser le lieu exact.",
    ],
    nearby: ["CPT", "DAP", "CIF"],
  },
  {
    code: "DAP",
    slug: "incoterms-dap",
    mode: "Tous modes",
    intro:
      "Le vendeur livre au lieu nomme, pret a etre decharge. L'import et les taxes restent a la charge de l'acheteur.",
    whenToUse: [
      "Quand le vendeur veut maitriser le transport jusqu'a destination.",
      "Quand l'acheteur prefere gerer la douane import.",
      "Pour des livraisons porte/entrepot.",
    ],
    costs: [
      { label: "Pre-acheminement", detail: "Vendeur" },
      { label: "Douane export", detail: "Vendeur" },
      { label: "Transport principal", detail: "Vendeur" },
      { label: "Dechargement", detail: "Acheteur" },
      { label: "Import / droits / TVA", detail: "Acheteur" },
    ],
    riskTransfer:
      "Au lieu de destination, avant dechargement.",
    documents: [
      "Facture commerciale",
      "Packing list",
      "Document de transport",
      "Preuve de livraison",
      "Documents import (acheteur)",
    ],
    example:
      "Le vendeur livre a l'entrepot du client a Madrid ; l'acheteur decharge et dedouane.",
    mistakes: [
      "Confondre DAP et DDP sur l'import.",
      "Lieu de livraison mal defini.",
      "Oublier les couts de dechargement et taxes locales.",
    ],
    nearby: ["DPU", "DDP", "CPT"],
  },
  {
    code: "DPU",
    slug: "incoterms-dpu",
    mode: "Tous modes",
    intro:
      "Le vendeur livre et decharge la marchandise au lieu nomme. L'import reste a la charge de l'acheteur.",
    whenToUse: [
      "Quand le vendeur peut organiser la decharge.",
      "Pour des livraisons en terminal ou sur chantier.",
      "Quand le vendeur veut maitriser la livraison jusqu'a la mise a quai.",
    ],
    costs: [
      { label: "Pre-acheminement", detail: "Vendeur" },
      { label: "Douane export", detail: "Vendeur" },
      { label: "Transport principal", detail: "Vendeur" },
      { label: "Dechargement", detail: "Vendeur" },
      { label: "Import / droits / TVA", detail: "Acheteur" },
    ],
    riskTransfer:
      "Apres dechargement au lieu convenu.",
    documents: [
      "Facture commerciale",
      "Packing list",
      "Document de transport",
      "Preuve de dechargement",
      "Documents import (acheteur)",
    ],
    example:
      "Le vendeur decharge des equipements sur site a Milan ; l'acheteur gere la douane import.",
    mistakes: [
      "Choisir DPU sans maitriser la decharge.",
      "Lieu trop vague ou non operational.",
      "Sous-estimer les frais de terminal.",
    ],
    nearby: ["DAP", "DDP", "CIP"],
  },
  {
    code: "DDP",
    slug: "incoterms-ddp",
    mode: "Tous modes",
    intro:
      "Le vendeur prend en charge transport, douane export/import, droits et TVA, jusqu'au lieu de livraison convenu.",
    whenToUse: [
      "Quand le vendeur veut offrir un service cle en main.",
      "Si l'acheteur ne veut pas gerer la douane import.",
      "Quand le vendeur a une structure locale pour l'import.",
    ],
    costs: [
      { label: "Pre-acheminement", detail: "Vendeur" },
      { label: "Douane export", detail: "Vendeur" },
      { label: "Transport principal", detail: "Vendeur" },
      { label: "Import / droits / TVA", detail: "Vendeur" },
      { label: "Acheminement final", detail: "Vendeur" },
      { label: "Dechargement", detail: "Acheteur (sauf accord)" },
    ],
    riskTransfer:
      "Au lieu de destination, pret a decharger.",
    documents: [
      "Facture commerciale",
      "Packing list",
      "Documents de transport",
      "Declarations export et import",
      "Preuve de paiement droits/TVA",
    ],
    example:
      "Le vendeur livre DDP au client a Bruxelles avec droits et TVA acquittes.",
    mistakes: [
      "Ne pas pouvoir dedouaner a l'import (EORI/TVA).",
      "Sous-estimer droits, taxes et frais locaux.",
      "Ignorer les restrictions sur l'importateur officiel.",
    ],
    nearby: ["DAP", "DPU", "CPT"],
  },
  {
    code: "FAS",
    slug: "incoterms-fas",
    mode: "Maritime",
    intro:
      "Maritime : le vendeur place la marchandise le long du navire au port d'embarquement ; l'acheteur charge et paie le fret.",
    whenToUse: [
      "Marchandises vrac ou conventionnelles.",
      "Quand l'acheteur affrete le navire.",
      "Livraison au quai/terminal maritime.",
    ],
    costs: [
      { label: "Pre-acheminement", detail: "Vendeur" },
      { label: "Douane export", detail: "Vendeur" },
      { label: "Mise a quai (alongside)", detail: "Vendeur" },
      { label: "Chargement a bord", detail: "Acheteur" },
      { label: "Transport principal", detail: "Acheteur" },
      { label: "Assurance", detail: "Acheteur" },
      { label: "Import / droits / TVA", detail: "Acheteur" },
    ],
    riskTransfer:
      "Quand la marchandise est placee le long du navire au port d'embarquement.",
    documents: [
      "Facture commerciale",
      "Packing list",
      "Declaration export",
      "Recu terminal / quai",
      "Bill of Lading (acheteur)",
    ],
    example:
      "Le vendeur livre des sacs au quai du port du Havre ; l'acheteur charge sur le navire.",
    mistakes: [
      "Utiliser FAS pour conteneurs (preferer FCA).",
      "Confondre 'alongside' et 'on board'.",
      "Port/quai imprecis.",
    ],
    nearby: ["FOB", "CFR", "FCA"],
  },
  {
    code: "FOB",
    slug: "incoterms-fob",
    mode: "Maritime",
    intro:
      "Maritime : le vendeur charge la marchandise a bord du navire ; le risque passe a bord au port d'embarquement.",
    whenToUse: [
      "Vrac, breakbulk ou conventions maritimes classiques.",
      "Quand l'acheteur choisit le navire.",
      "Contrats maritimes traditionnels.",
    ],
    costs: [
      { label: "Pre-acheminement", detail: "Vendeur" },
      { label: "Douane export", detail: "Vendeur" },
      { label: "Chargement a bord", detail: "Vendeur" },
      { label: "Transport principal", detail: "Acheteur" },
      { label: "Assurance", detail: "Acheteur" },
      { label: "Import / droits / TVA", detail: "Acheteur" },
    ],
    riskTransfer:
      "Lorsque la marchandise est a bord au port d'embarquement.",
    documents: [
      "Facture commerciale",
      "Packing list",
      "Declaration export",
      "Bill of Lading",
    ],
    example:
      "Le vendeur charge au port de Marseille ; l'acheteur paie le fret vers Alger.",
    mistakes: [
      "Utiliser FOB pour conteneurs (preferer FCA).",
      "Port d'embarquement mal defini.",
      "Croire que le risque va jusqu'au port d'arrivee.",
    ],
    nearby: ["FAS", "CFR", "FCA"],
  },
  {
    code: "CFR",
    slug: "incoterms-cfr",
    mode: "Maritime",
    intro:
      "Maritime : le vendeur paie le fret jusqu'au port d'arrivee, mais le risque transfere a bord au port d'embarquement.",
    whenToUse: [
      "Quand l'acheteur veut que le vendeur reserve le fret.",
      "Pour des marchandises maritimes non conteneurisees.",
      "Si l'acheteur gere l'assurance.",
    ],
    costs: [
      { label: "Pre-acheminement", detail: "Vendeur" },
      { label: "Douane export", detail: "Vendeur" },
      { label: "Chargement a bord", detail: "Vendeur" },
      { label: "Transport principal", detail: "Vendeur" },
      { label: "Assurance", detail: "Acheteur" },
      { label: "Import / droits / TVA", detail: "Acheteur" },
    ],
    riskTransfer:
      "A bord au port d'embarquement, malgre le fret paye jusqu'au port d'arrivee.",
    documents: [
      "Facture commerciale",
      "Packing list",
      "Declaration export",
      "Bill of Lading",
    ],
    example:
      "Le vendeur paie le fret jusqu'a Dakar ; le risque transfere au chargement a Bordeaux.",
    mistakes: [
      "Confondre CFR et CIF sur l'assurance.",
      "Penser que le risque transfere au port d'arrivee.",
      "Port d'arrivee imprecis.",
    ],
    nearby: ["FOB", "CIF", "CPT"],
  },
  {
    code: "CIF",
    slug: "incoterms-cif",
    mode: "Maritime",
    intro:
      "Maritime : le vendeur paie fret et assurance minimale jusqu'au port d'arrivee ; le risque transfere a bord.",
    whenToUse: [
      "Quand l'acheteur veut une assurance incluse.",
      "Pour marchandises maritimes non conteneurisees.",
      "Quand le vendeur maitrise le fret maritime.",
    ],
    costs: [
      { label: "Pre-acheminement", detail: "Vendeur" },
      { label: "Douane export", detail: "Vendeur" },
      { label: "Chargement a bord", detail: "Vendeur" },
      { label: "Transport principal", detail: "Vendeur" },
      { label: "Assurance", detail: "Vendeur (couverture minimale)" },
      { label: "Import / droits / TVA", detail: "Acheteur" },
    ],
    riskTransfer:
      "A bord au port d'embarquement.",
    documents: [
      "Facture commerciale",
      "Packing list",
      "Declaration export",
      "Bill of Lading",
      "Certificat d'assurance",
    ],
    example:
      "Le vendeur livre CIF vers Casablanca avec assurance minimale incluse.",
    mistakes: [
      "Assurance minimale insuffisante pour la valeur.",
      "Utiliser CIF pour conteneurs (preferer CIP).",
      "Confondre lieu de livraison et transfert du risque.",
    ],
    nearby: ["CFR", "CIP", "FOB"],
  },
];

const bySlug = new Map(INCOTERMS.map((item) => [item.slug, item]));
const byCode = new Map(INCOTERMS.map((item) => [item.code.toUpperCase(), item]));

export function getIncotermBySlug(slug?: string | null) {
  if (!slug) return null;
  return bySlug.get(String(slug).trim().toLowerCase()) ?? null;
}

export function getIncotermByCode(code?: string | null) {
  if (!code) return null;
  return byCode.get(String(code).trim().toUpperCase()) ?? null;
}

export const INCOTERM_LINKS = INCOTERMS.map((item) => ({
  code: item.code,
  slug: item.slug,
  label: `Incoterm ${item.code}`,
  mode: item.mode,
}));
