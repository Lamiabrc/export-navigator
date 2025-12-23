export type ChargeRule = {
  zone: 'DROM' | 'UE' | 'Suisse' | 'Hors UE';
  label: string;
  description: string;
  controls: string[];
  sources: { label: string; url: string }[];
};

export const chargesTaxesKnowledge: ChargeRule[] = [
  {
    zone: 'DROM',
    label: 'OM / OMR',
    description: 'Taxe locale à l’entrée en DROM, calculée sur valeur douane + transport.',
    controls: ['HS code exact + origine', 'Valeur transport intégrée', 'Preuve de paiement OM/OMR'],
    sources: [
      { label: 'Douane – Octroi de mer', url: 'https://www.douane.gouv.fr/dossier/octroi-de-mer' },
    ],
  },
  {
    zone: 'DROM',
    label: 'TVA import locale',
    description: 'TVA 8.5% à l’import DROM (ou taux local), souvent autoliquidation non applicable.',
    controls: ['Facture commerciale cohérente', 'Déclaration douane import', 'Preuve de liquidation TVA locale'],
    sources: [
      { label: 'Douane – TVA import DOM', url: 'https://www.douane.gouv.fr/fiche/la-tva-dom' },
    ],
  },
  {
    zone: 'DROM',
    label: 'Dédouanement import',
    description: 'Formalités à l’entrée DOM, transit souvent nécessaire.',
    controls: ['Mandat au transitaire', 'Déclaration douane conservée', 'Refacturation transit si EXW/FCA'],
    sources: [
      { label: 'Douane – Formalités import', url: 'https://www.douane.gouv.fr/demarche/importer-un-produit' },
    ],
  },
  {
    zone: 'UE',
    label: 'Autoliquidation TVA intra',
    description: 'TVA autoliquidée si N° TVA valide et preuve transport intra-UE.',
    controls: ['N° TVA client validé', 'Preuve transport (CMR/BL)', 'Incoterm cohérent (FCA/DAP)'],
    sources: [
      { label: 'EU VAT VIES', url: 'https://ec.europa.eu/taxation_customs/vies/' },
    ],
  },
  {
    zone: 'UE',
    label: 'Transit / dossier',
    description: 'Frais de dossier transporteur pour international ; refacturable.',
    controls: ['Facture transit disponible', 'Ligne de refacturation si applicable'],
    sources: [
      { label: 'Incoterms ICC', url: 'https://iccwbo.org/resources-for-business/incoterms-rules/' },
    ],
  },
  {
    zone: 'Suisse',
    label: 'Droits (dépend HS/NC)',
    description: 'Taux variables selon HS et origine préférentielle.',
    controls: ['HS code confirmé', 'Origine préférentielle (EUR.1 ou déclaration)', 'Simulation TARes'],
    sources: [
      { label: 'TARes', url: 'https://xtares.admin.ch/tares/' },
    ],
  },
  {
    zone: 'Suisse',
    label: 'TVA import 7.7%',
    description: 'Collectée à l’import, base = valeur douane + transport.',
    controls: ['Valeur transport incluse', 'Décompte TVA import archivé'],
    sources: [
      { label: 'Suisse TVA import', url: 'https://www.estv.admin.ch/estv/fr/home/mehrwertsteuer/fachinformationen/steuerobjekt/einfuhrsteuer.html' },
    ],
  },
  {
    zone: 'Hors UE',
    label: 'Droits de douane',
    description: 'Dépend HS/NC/TARIC et origine ; ne pas inventer de taux.',
    controls: ['HS code validé', 'Origine connue', 'Lien TARIC/TARes consulté'],
    sources: [
      { label: 'TARIC', url: 'https://ec.europa.eu/taxation_customs/dds2/taric/measures.jsp' },
    ],
  },
  {
    zone: 'Hors UE',
    label: 'TVA import (FR)',
    description: 'Collectée à l’import, autoliquidation possible si inscrit.',
    controls: ['Compte TVA import/autoliquidation', 'Déclaration en douane cohérente'],
    sources: [
      { label: 'TVA import FR', url: 'https://www.douane.gouv.fr/demarche/mettre-en-oeuvre-la-tva-limportation' },
    ],
  },
];
