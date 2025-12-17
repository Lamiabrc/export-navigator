import type { Transitaire } from '@/types/circuits';

export const transitaires: Transitaire[] = [
  {
    id: 'DHL',
    name: 'DHL Express',
    speciality: 'Express international, petits colis, urgences',
    zones: ['UE', 'Suisse', 'Hors UE'],
    documentsReceived: [
      'Facture commerciale',
      'Packing list',
      'AWB (Air Waybill)',
      'Certificat d\'origine si requis',
    ],
  },
  {
    id: 'LVoverseas',
    name: 'LV Overseas',
    speciality: 'Maritime DROM, conteneurs, groupage',
    zones: ['DROM', 'Hors UE'],
    documentsReceived: [
      'Facture commerciale',
      'Packing list',
      'Connaissement maritime (BL)',
      'DAU',
      'Certificat d\'origine',
    ],
  },
  {
    id: 'Geodis',
    name: 'Geodis',
    speciality: 'Routier UE, logistique intégrée',
    zones: ['UE', 'Suisse'],
    documentsReceived: [
      'Facture commerciale',
      'Packing list',
      'CMR / Lettre de voiture',
      'EUR.1 si hors UE',
    ],
  },
  {
    id: 'TDIS',
    name: 'TDIS Martinique',
    speciality: 'Plateforme logistique DROM, distribution locale',
    zones: ['DROM'],
    documentsReceived: [
      'Facture commerciale',
      'Packing list',
      'BL / Connaissement',
      'DAU',
      'Fiche préparation commande',
    ],
  },
  {
    id: 'Autre',
    name: 'Autre transitaire',
    speciality: 'Transitaire spécifique selon destination',
    zones: ['Multiple'],
    documentsReceived: [
      'Facture commerciale',
      'Packing list',
      'Documents transport',
      'Certificats requis',
    ],
  },
  {
    id: 'Client',
    name: 'Transitaire du client',
    speciality: 'Choisi et géré par le client (FCA)',
    zones: ['Multiple'],
    documentsReceived: [
      'Facture commerciale',
      'Packing list',
      'Bon de mise à disposition',
    ],
  },
];

export const getTransitaireById = (id: string): Transitaire | undefined => {
  return transitaires.find(t => t.id === id);
};
