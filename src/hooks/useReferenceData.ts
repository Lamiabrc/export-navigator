import { useCallback, useEffect, useState } from 'react';
import type { Destination, Incoterm, Zone } from '@/types';
import { REFERENCE_OVERRIDES_KEY } from '@/lib/constants/storage';

export interface IncotermReference {
  code: Incoterm | string;
  description: string;
  payerTransport: 'Fournisseur' | 'Client' | string;
  notes?: string;
  obligations?: string[];
}

export interface DestinationReference {
  destination: Destination | string;
  zone: Zone | string;
  tvaRegime: string;
  taxesPossibles: string[];
  flags: string[];
  documents?: string[];
  restrictions?: string;
}

export interface ChargeTaxRule {
  name: string;
  payer: string;
  trigger: string;
  comment?: string;
  mandatoryDocs?: string[];
  scope: string;
}

export interface CheatSheet {
  title: string;
  reminders: string[];
  documents: string[];
  warning?: string;
}

export interface LogisticsOption {
  mode: 'Dépositaire (stock local)' | 'Envoi direct depuis métropole';
  bestFor: string;
  leadTime: string;
  cutoffs: string;
  responsibilities: string[];
  notes?: string;
}

export interface NomenclatureEntry {
  hsCode: string;
  label: string;
  usages: string[];
  documents: string[];
  taricUrl: string;
  taresUrl: string;
}

export interface ReferenceData {
  incoterms: IncotermReference[];
  destinations: DestinationReference[];
  chargesTaxes: ChargeTaxRule[];
  cheatSheets: CheatSheet[];
  logistics: LogisticsOption[];
  nomenclature: NomenclatureEntry[];
  updatedAt?: string;
}

export const defaultReferenceData: ReferenceData = {
  incoterms: [
    {
      code: 'EXW',
      description: 'Ex Works – client prend en charge dès sortie entrepôt',
      payerTransport: 'Client',
      notes: 'Pas de dédouanement export par le vendeur.',
      obligations: ['Mise à disposition marchandise', 'Assistance documents commerciaux'],
    },
    {
      code: 'FCA',
      description: 'Free Carrier – remise au transporteur désigné',
      payerTransport: 'Client',
      notes: 'Dédouanement export par le vendeur.',
      obligations: ['Dédouanement export', 'Chargement camion si en entrepôt vendeur'],
    },
    {
      code: 'DAP',
      description: 'Delivered At Place – livraison au lieu convenu',
      payerTransport: 'Fournisseur',
      notes: 'Import à charge client.',
      obligations: ['Transport principal payé', 'Gestion transport local si prévu'],
    },
    {
      code: 'DDP',
      description: 'Delivered Duty Paid – vendeur supporte tous les coûts',
      payerTransport: 'Fournisseur',
      notes: 'Inclut droits/TVA import.',
      obligations: ['Transport principal + import', 'Paiement droits/TVA', 'Formalités douane import'],
    },
  ],
  destinations: [
    {
      destination: 'France métropolitaine',
      zone: 'UE',
      tvaRegime: 'TVA 20% / autoliquidation B2B possible',
      taxesPossibles: ['éco-contributions', 'frais dossier transporteur'],
      flags: ['Mentionner TVA intra si B2B', 'Contrôler éco-participations'],
      documents: ['Facture', 'BL signé'],
      restrictions: 'Pas de contrôle sanitaire spécifique sur textile orthopédique.',
    },
    {
      destination: 'DROM (Guadeloupe, Martinique, Réunion)',
      zone: 'DROM',
      tvaRegime: 'TVA locale 8.5% + Octroi de mer/OMR',
      taxesPossibles: ['OM', 'OMR', 'frais dock / manutention'],
      flags: ['Port saturé en haute saison', 'Anticiper HS code pour liquidation'],
      documents: ['Facture détaillée', 'Document d’accompagnement douanier'],
      restrictions: 'Aligner valeur douane et facture commerciale.',
    },
    {
      destination: 'Suisse',
      zone: 'Hors UE',
      tvaRegime: 'TVA import 7.7% collectée localement',
      taxesPossibles: ['droits selon HS', 'frais dossier transit', 'TVA import'],
      flags: ['Certificat d’origine conseillé pour préférences', 'Facture en CHF appréciée'],
      documents: ['Facture commerciale', 'EUR.1 ou déclaration origine si applicable'],
      restrictions: 'Valoriser transport pour calcul TVA import.',
    },
    {
      destination: 'Espagne / Portugal',
      zone: 'UE',
      tvaRegime: 'TVA intra (autoliquidation) ou 0% si preuve export Canaries',
      taxesPossibles: ['frais de dossier transit', 'éco-contributions locales'],
      flags: ['Adresse complète et N° TVA requis', 'Canaries = régime export'],
      documents: ['Facture', 'Preuve de livraison/transport'],
      restrictions: 'Valider incoterm avec le client (DAP souvent privilégié).',
    },
  ],
  chargesTaxes: [
    {
      name: 'Transit / frais dossier',
      payer: 'Client sauf accord commercial',
      trigger: 'Transport international ou formalités douane',
      comment: 'Toujours refacturer si EXW/FCA, vérifier seuils en DDP.',
      mandatoryDocs: ['Facture transit / déclarant', 'Preuve passage douane'],
      scope: 'Toutes zones',
    },
    {
      name: 'Droits de douane',
      payer: 'Client sauf DDP',
      trigger: 'Import hors UE selon HS',
      comment: 'Anticiper impact prix de vente pour DDP.',
      mandatoryDocs: ['Déclaration en douane', 'Calcul droits'],
      scope: 'Hors UE / DROM',
    },
    {
      name: 'TVA import',
      payer: 'Client',
      trigger: 'Importation (DDP = vendeur avance)',
      comment: 'Autoliquidation parfois possible en UE, sinon transit facture.',
      mandatoryDocs: ['Déclaration TVA import', 'Décompte douane'],
      scope: 'Hors UE / DROM',
    },
    {
      name: 'Octroi de mer / OMR',
      payer: 'Client',
      trigger: 'Entrée DROM',
      comment: 'Nécessite HS code précis et valeur transport.',
      mandatoryDocs: ['Document douanier DROM', 'Calcul OM/OMR'],
      scope: 'DROM',
    },
  ],
  cheatSheets: [
    {
      title: 'DROM',
      reminders: [
        'Toujours mentionner HS code + valeur transport sur facture.',
        'Anticiper OM/OMR dans devis ou proposer EXW/FCA.',
        'Délais maritimes longs : valider stock dispo localement.',
      ],
      documents: ['Facture commerciale détaillée', 'Déclaration export France', 'Preuve livraison'],
      warning: 'Ports saturés en haute saison : prévoir 10-15j de marge.',
    },
    {
      title: 'UE',
      reminders: [
        'Numéro TVA client obligatoire pour facturation HT.',
        'Preuve transport (CMR/BL) nécessaire pour 0% TVA.',
        'Incoterms FCA/DAP privilégiés pour maîtrise transport.',
      ],
      documents: ['Facture', 'Preuve transport', 'EORI vendeur'],
    },
    {
      title: 'Suisse',
      reminders: [
        'Valoriser transport pour calcul TVA import 7.7%.',
        'Proposer DAP par défaut, DDP possible via transit dédié.',
        'Origine préférentielle utile pour réduire droits.',
      ],
      documents: ['Facture', 'EUR.1 ou déclaration d’origine', 'Instruction au transitaire'],
      warning: 'Refus de livraison sans valeur douane claire sur facture.',
    },
  ],
  logistics: [
    {
      mode: 'Dépositaire (stock local)',
      bestFor: 'Livraison express en DROM / Suisse avec stock tampon',
      leadTime: '24-72h selon zone',
      cutoffs: 'M-1 : réassort maritime / M-2 : réassort aérien si urgent',
      responsibilities: ['Suivi stock et péremption', 'Gestion douane import en amont', 'Facturation locale si applicable'],
      notes: 'Réduit coûts transport unitaire mais immobilise du stock.',
    },
    {
      mode: 'Envoi direct depuis métropole',
      bestFor: 'Commandes ponctuelles / faible volume',
      leadTime: '4-12 jours selon mode (aérien vs maritime)',
      cutoffs: 'J-1 12h : cut-off préparation', 
      responsibilities: ['Préparer colis avec HS code', 'Partager facture + packing list', 'Informer client du transporteur et incoterm'],
      notes: 'Coûts variables ; vérifier impact OM/OMR ou droits avant devis.',
    },
  ],
  nomenclature: [
    {
      hsCode: '6307',
      label: 'Articles textiles confectionnés (orthèses textiles)',
      usages: ['Ceintures lombaires', 'Orthèses souples'],
      documents: ['Fiche technique matière', 'Déclaration conformité'],
      taricUrl: 'https://ec.europa.eu/taxation_customs/dds2/taric/measures.jsp?Taric=6307',
      taresUrl: 'https://xtares.admin.ch/tares/login/loginFormFiller.do;jsessionid=',
    },
    {
      hsCode: '6212',
      label: 'Soutiens-gorge, ceintures médicales, bandages',
      usages: ['Ceintures post-op', 'Ceintures herniaires'],
      documents: ['Notice d’utilisation', 'Fiche technique'],
      taricUrl: 'https://ec.europa.eu/taxation_customs/dds2/taric/measures.jsp?Taric=6212',
      taresUrl: 'https://xtares.admin.ch/tares/login/loginFormFiller.do;hs=6212',
    },
    {
      hsCode: '9021',
      label: 'Articles orthopédiques (attelles, orthèses rigides)',
      usages: ['Attelles poignet', 'Orthèses genou rigides'],
      documents: ['Certificat CE / MDR', 'Notice patient'],
      taricUrl: 'https://ec.europa.eu/taxation_customs/dds2/taric/measures.jsp?Taric=9021',
      taresUrl: 'https://xtares.admin.ch/tares/login/loginFormFiller.do;hs=9021',
    },
  ],
  updatedAt: new Date().toISOString(),
};

export const useReferenceData = () => {
  const [referenceData, setReferenceData] = useState<ReferenceData>(defaultReferenceData);
  const [isLoaded, setIsLoaded] = useState(false);

  const withDefaults = useCallback(
    (data?: Partial<ReferenceData>): ReferenceData => ({
      incoterms: data?.incoterms ?? defaultReferenceData.incoterms,
      destinations: data?.destinations ?? defaultReferenceData.destinations,
      chargesTaxes: data?.chargesTaxes ?? defaultReferenceData.chargesTaxes,
      cheatSheets: data?.cheatSheets ?? defaultReferenceData.cheatSheets,
      logistics: data?.logistics ?? defaultReferenceData.logistics,
      nomenclature: data?.nomenclature ?? defaultReferenceData.nomenclature,
      updatedAt: data?.updatedAt ?? new Date().toISOString(),
    }),
    []
  );

  useEffect(() => {
    try {
      const stored = localStorage.getItem(REFERENCE_OVERRIDES_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as ReferenceData;
        setReferenceData(withDefaults(parsed));
      } else {
        setReferenceData(defaultReferenceData);
      }
    } catch {
      setReferenceData(defaultReferenceData);
    } finally {
      setIsLoaded(true);
    }
  }, [withDefaults]);

  const saveReferenceData = useCallback(
    (data: ReferenceData) => {
      const merged = withDefaults(data);
      const withDate = { ...merged, updatedAt: new Date().toISOString() };
      setReferenceData(withDate);
      localStorage.setItem(REFERENCE_OVERRIDES_KEY, JSON.stringify(withDate));
    },
    [withDefaults]
  );

  const resetReferenceData = useCallback(() => {
    setReferenceData({ ...defaultReferenceData, updatedAt: new Date().toISOString() });
    localStorage.removeItem(REFERENCE_OVERRIDES_KEY);
  }, []);

  return { referenceData, saveReferenceData, resetReferenceData, isLoaded };
};
