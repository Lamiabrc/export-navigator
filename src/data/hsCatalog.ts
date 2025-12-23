export type HsItem = {
  hsCode: string;
  label: string;
  notes: string;
  risk: 'Faible' | 'Modéré' | 'Fort';
};

export const defaultHsCatalog: HsItem[] = [
  {
    hsCode: '6307',
    label: 'Articles textiles confectionnés (orthèses textiles)',
    notes: 'Fiche matière + conformité MDR ; vérifier éco-participations éventuelles.',
    risk: 'Modéré',
  },
  {
    hsCode: '6212',
    label: 'Ceintures médicales, bandages et articles similaires',
    notes: 'Documentation produit et origine ; peut changer de taux selon origine.',
    risk: 'Modéré',
  },
  {
    hsCode: '9021',
    label: 'Articles orthopédiques (attelles, orthèses rigides)',
    notes: 'Certificat CE/MDR impératif ; droits variables selon matière et origine.',
    risk: 'Fort',
  },
];
