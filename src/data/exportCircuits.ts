import type { ExportCircuit } from '@/types/circuits';

export const exportCircuits: ExportCircuit[] = [
  {
    id: 'fca_client_place',
    name: 'FCA - Livraison au lieu choisi par le client',
    shortName: 'FCA Client',
    description: 'Le fournisseur livre les marchandises dédouanées export au transporteur désigné par le client, au lieu convenu. Le client assume le transport principal et tous les frais d\'import.',
    zone: 'Multiple',
    incoterm: 'FCA',
    transitaires: ['Client'],
    documentDistribution: [
      { document: 'Facture commerciale', recipients: ['Client'], notes: 'Original pour le transporteur du client' },
      { document: 'Packing list', recipients: ['Client'], notes: 'Copie pour contrôle' },
      { document: 'Bon de livraison', recipients: ['Client'], notes: 'Signé à la mise à disposition' },
      { document: 'Déclaration export (EX1)', recipients: ['Client'], notes: 'Copie pour preuve export' },
    ],
    declarationsRequired: [
      'Déclaration d\'exportation (EX1)',
      'DEB si destination UE (Déclaration d\'Échanges de Biens)'
    ],
    documentsRequired: [
      'Facture commerciale',
      'Packing list',
      'Bon de livraison',
      'Preuve de mise à disposition au transporteur'
    ],
    costItems: [
      { id: 'prep', label: 'Préparation commande', payer: 'Fournisseur', description: 'Emballage, étiquetage, palettisation' },
      { id: 'customs_export', label: 'Dédouanement export', payer: 'Fournisseur', description: 'Formalités douanières de sortie France' },
      { id: 'transport', label: 'Transport principal', payer: 'Client', description: 'Acheminement vers destination' },
      { id: 'customs_import', label: 'Dédouanement import', payer: 'Client', description: 'Formalités douanières d\'entrée si hors UE' },
      { id: 'duties', label: 'Droits et taxes', payer: 'Client', description: 'Droits de douane, TVA import, OM/OMR si DROM' }
    ],
    steps: [
      { id: '1', label: 'Commande client', actor: 'Client', description: 'Réception et validation de la commande' },
      { id: '2', label: 'Préparation', actor: 'ORLIMAN', description: 'Préparation et emballage des produits' },
      { id: '3', label: 'Déclaration export', actor: 'ORLIMAN', description: 'Formalités douanières export (EX1)' },
      { id: '4', label: 'Mise à disposition', actor: 'ORLIMAN', description: 'Remise au transporteur du client' },
      { id: '5', label: 'Transport', actor: 'Transporteur client', description: 'Acheminement vers destination' },
      { id: '6', label: 'Réception', actor: 'Client', description: 'Livraison finale et import si nécessaire' }
    ],
    risks: [
      'Vérifier que le client a bien organisé son transport',
      'S\'assurer de la validité des documents export avant remise',
      'Conserver preuve de mise à disposition au transporteur'
    ],
    bestPractices: [
      'Demander les coordonnées du transporteur client avant expédition',
      'Établir un bon de livraison signé au moment de la remise',
      'Transmettre copie des documents export au client'
    ]
  },
  {
    id: 'ddp_direct',
    name: 'DDP Direct - France vers client final',
    shortName: 'DDP Direct',
    description: 'Le fournisseur assume l\'intégralité des frais et risques jusqu\'à la livraison chez le client, y compris dédouanement import, droits et taxes.',
    zone: 'Multiple',
    incoterm: 'DDP',
    transitaires: ['DHL', 'Geodis', 'LVoverseas'],
    documentDistribution: [
      { document: 'Facture commerciale', recipients: ['DHL', 'Geodis', 'LVoverseas'], notes: '3 exemplaires originaux' },
      { document: 'Packing list', recipients: ['DHL', 'Geodis', 'LVoverseas'], notes: 'Détail des colis' },
      { document: 'Document transport (CMR/AWB/BL)', recipients: ['DHL', 'Geodis', 'LVoverseas'], notes: 'Selon mode de transport' },
      { document: 'DAU', recipients: ['DHL', 'Geodis', 'LVoverseas'], notes: 'Si hors UE / DROM' },
      { document: 'Certificat d\'origine', recipients: ['DHL', 'Geodis', 'LVoverseas'], notes: 'Si applicable' },
    ],
    declarationsRequired: [
      'Déclaration d\'exportation (EX1)',
      'DEB si destination UE',
      'Déclaration d\'importation dans le pays de destination'
    ],
    documentsRequired: [
      'Facture commerciale',
      'Packing list',
      'Document de transport (CMR, BL, AWB)',
      'DAU si hors UE / DROM',
      'Certificat d\'origine si applicable'
    ],
    costItems: [
      { id: 'prep', label: 'Préparation commande', payer: 'Fournisseur', description: 'Emballage, étiquetage, palettisation' },
      { id: 'customs_export', label: 'Dédouanement export', payer: 'Fournisseur', description: 'Formalités douanières de sortie France' },
      { id: 'transport', label: 'Transport principal', payer: 'Fournisseur', description: 'Acheminement vers destination', typical_percentage: '3-8% valeur' },
      { id: 'customs_import', label: 'Dédouanement import', payer: 'Fournisseur', description: 'Formalités douanières d\'entrée' },
      { id: 'duties', label: 'Droits de douane', payer: 'Fournisseur', description: 'Droits à l\'importation', typical_percentage: '0-5%' },
      { id: 'tva_import', label: 'TVA import', payer: 'Fournisseur', description: 'TVA à l\'importation', typical_percentage: '2.1-20%' },
      { id: 'om', label: 'Octroi de Mer (DROM)', payer: 'Fournisseur', description: 'Taxe spécifique DROM', typical_percentage: '0-60%' },
      { id: 'omr', label: 'OMR (DROM)', payer: 'Fournisseur', description: 'Octroi de Mer Régional', typical_percentage: '0-2.5%' }
    ],
    steps: [
      { id: '1', label: 'Commande client', actor: 'Client', description: 'Réception et validation de la commande' },
      { id: '2', label: 'Préparation', actor: 'ORLIMAN', description: 'Préparation et emballage des produits' },
      { id: '3', label: 'Déclaration export', actor: 'ORLIMAN', description: 'Formalités douanières export' },
      { id: '4', label: 'Transport', actor: 'DHL/Geodis/LVoverseas', description: 'Acheminement vers destination' },
      { id: '5', label: 'Dédouanement import', actor: 'Transitaire', description: 'Formalités et paiement taxes' },
      { id: '6', label: 'Livraison finale', actor: 'Transporteur', description: 'Livraison chez le client' }
    ],
    risks: [
      'Coût total difficile à estimer (taxes variables)',
      'Responsabilité jusqu\'à livraison finale',
      'Avance de trésorerie pour taxes import'
    ],
    bestPractices: [
      'Utiliser le simulateur pour estimer les coûts complets',
      'Prévoir une marge pour les variations de taxes',
      'Avoir un transitaire de confiance dans le pays de destination'
    ]
  },
  {
    id: 'platform_drom',
    name: 'DROM via Plateforme Logistique',
    shortName: 'Plateforme DROM',
    description: 'Flux vers les DROM via une plateforme logistique sous-traitante dans le territoire de destination (ex: TDIS en Martinique). Le sous-traitant gère le dédouanement et la distribution locale.',
    zone: 'DROM',
    incoterm: 'DAP/DDP',
    transitaires: ['LVoverseas', 'TDIS'],
    documentDistribution: [
      { document: 'Facture commerciale', recipients: ['LVoverseas', 'TDIS'], notes: 'LVoverseas pour export, TDIS pour import' },
      { document: 'Packing list', recipients: ['LVoverseas', 'TDIS'], notes: 'Détail pour préparation plateforme' },
      { document: 'Connaissement (BL)', recipients: ['LVoverseas'], notes: 'Original pour le maritime' },
      { document: 'DAU', recipients: ['TDIS'], notes: 'Pour dédouanement DROM' },
      { document: 'Fiche TDIS', recipients: ['TDIS'], notes: 'Instructions de distribution locale' },
    ],
    declarationsRequired: [
      'Déclaration d\'exportation (EX1)',
      'DAU (Document Administratif Unique)',
      'Déclaration OM/OMR'
    ],
    documentsRequired: [
      'Facture commerciale',
      'Packing list',
      'Connaissement maritime (BL)',
      'DAU',
      'Fiche TDIS / plateforme'
    ],
    costItems: [
      { id: 'prep', label: 'Préparation commande', payer: 'Fournisseur', description: 'Emballage export maritime' },
      { id: 'customs_export', label: 'Dédouanement export', payer: 'Fournisseur', description: 'Formalités douanières France' },
      { id: 'transport_maritime', label: 'Transport maritime', payer: 'Fournisseur', description: 'Fret maritime vers DROM', typical_percentage: '4-7% valeur' },
      { id: 'handling_port', label: 'Manutention portuaire', payer: 'Fournisseur', description: 'Déchargement et mise à quai' },
      { id: 'platform_fee', label: 'Frais plateforme (TDIS)', payer: 'Fournisseur', description: 'Stockage, préparation, distribution', typical_percentage: '2-4%' },
      { id: 'customs_import', label: 'Dédouanement DROM', payer: 'Variable', description: 'Selon incoterm convenu' },
      { id: 'om', label: 'Octroi de Mer', payer: 'Variable', description: 'Selon incoterm et produit', typical_percentage: '0-60%' },
      { id: 'omr', label: 'OMR', payer: 'Variable', description: 'Octroi de Mer Régional', typical_percentage: '0-2.5%' },
      { id: 'tva_drom', label: 'TVA DROM', payer: 'Variable', description: 'TVA réduite 8.5% (sauf Guyane/Mayotte)', typical_percentage: '8.5%' }
    ],
    steps: [
      { id: '1', label: 'Commande client', actor: 'Client DROM', description: 'Commande passée' },
      { id: '2', label: 'Préparation export', actor: 'ORLIMAN', description: 'Conditionnement maritime' },
      { id: '3', label: 'Export France', actor: 'ORLIMAN + LVoverseas', description: 'Déclaration export + mise à FOB' },
      { id: '4', label: 'Transport maritime', actor: 'LVoverseas', description: 'Traversée vers DROM (15-25 jours)' },
      { id: '5', label: 'Réception plateforme', actor: 'TDIS', description: 'Déchargement et stockage' },
      { id: '6', label: 'Dédouanement', actor: 'TDIS', description: 'Formalités import et taxes' },
      { id: '7', label: 'Distribution locale', actor: 'TDIS', description: 'Livraison au client final' }
    ],
    risks: [
      'Délais maritimes variables (météo, saturation ports)',
      'Calcul OM complexe selon nomenclature produit',
      'Coûts de stockage plateforme si retard enlèvement'
    ],
    bestPractices: [
      'Établir un contrat cadre avec la plateforme (TDIS)',
      'Anticiper les pics saisonniers (fêtes, rentrée)',
      'Vérifier les taux OM pour produits orthopédiques (exonération 9021*)',
      'Prévoir délai minimum 3 semaines'
    ]
  },
  {
    id: 'ue_intra',
    name: 'Flux Intracommunautaire UE',
    shortName: 'Intra-UE',
    description: 'Échanges au sein de l\'Union Européenne. Pas de douane mais obligations déclaratives (DEB/DES). TVA intracommunautaire avec autoliquidation si numéro TVA valide.',
    zone: 'UE',
    incoterm: 'DAP/FCA',
    transitaires: ['Geodis', 'DHL'],
    documentDistribution: [
      { document: 'Facture commerciale HT', recipients: ['Geodis', 'DHL'], notes: 'Mentions TVA intracommunautaire obligatoires' },
      { document: 'Packing list', recipients: ['Geodis', 'DHL'], notes: 'Détail des colis' },
      { document: 'CMR / Lettre de voiture', recipients: ['Geodis'], notes: 'Pour transport routier' },
      { document: 'AWB', recipients: ['DHL'], notes: 'Pour express aérien' },
      { document: 'Preuve de livraison', recipients: ['Geodis', 'DHL'], notes: 'Signé à réception - CONSERVER 6 ans' },
    ],
    declarationsRequired: [
      'DEB (Déclaration d\'Échanges de Biens) si > 460 000€/an',
      'DES (Déclaration Européenne de Services) si services',
      'Listing TVA intracommunautaire',
      'Vérification numéro TVA client (VIES)'
    ],
    documentsRequired: [
      'Facture commerciale HT avec mentions légales',
      'Packing list',
      'CMR / Lettre de voiture',
      'Preuve de livraison',
      'Numéro TVA intracommunautaire client'
    ],
    costItems: [
      { id: 'prep', label: 'Préparation commande', payer: 'Fournisseur', description: 'Emballage standard' },
      { id: 'transport', label: 'Transport routier', payer: 'Variable', description: 'Selon incoterm (FCA ou DAP)', typical_percentage: '2-5% valeur' },
      { id: 'admin', label: 'Frais administratifs', payer: 'Fournisseur', description: 'DEB, contrôle TVA' }
    ],
    steps: [
      { id: '1', label: 'Commande client UE', actor: 'Client', description: 'Avec numéro TVA intracommunautaire' },
      { id: '2', label: 'Vérification TVA', actor: 'ORLIMAN', description: 'Contrôle VIES du numéro TVA' },
      { id: '3', label: 'Facturation HT', actor: 'ORLIMAN', description: 'Facture exonérée TVA' },
      { id: '4', label: 'Préparation', actor: 'ORLIMAN', description: 'Emballage et documents' },
      { id: '5', label: 'Transport', actor: 'Geodis/DHL', description: 'Livraison UE' },
      { id: '6', label: 'DEB mensuelle', actor: 'ORLIMAN', description: 'Déclaration si seuil atteint' },
      { id: '7', label: 'Réception', actor: 'Client', description: 'Client autoliquide TVA' }
    ],
    risks: [
      'Numéro TVA invalide = TVA française applicable',
      'Absence de preuve transport = risque fiscal',
      'Oubli DEB = pénalités'
    ],
    bestPractices: [
      'TOUJOURS vérifier numéro TVA sur VIES avant expédition',
      'Conserver CMR signé + preuve livraison 6 ans',
      'Automatiser la DEB avec logiciel comptable',
      'Mentions obligatoires sur facture : "Exonération TVA Art. 262 ter I CGI"'
    ]
  },
  {
    id: 'suisse',
    name: 'Flux Suisse',
    shortName: 'Suisse',
    description: 'Exportation vers la Suisse (hors UE). Dédouanement export France + import Suisse requis. Accords de libre-échange applicables avec EUR.1 pour réduction droits.',
    zone: 'Hors UE',
    incoterm: 'DAP/DDP',
    transitaires: ['Geodis', 'DHL', 'Autre'],
    documentDistribution: [
      { document: 'Facture commerciale (FR/DE)', recipients: ['Geodis', 'DHL'], notes: 'Bilingue français/allemand recommandé' },
      { document: 'Packing list', recipients: ['Geodis', 'DHL'], notes: 'Détail des colis' },
      { document: 'EUR.1', recipients: ['Geodis', 'DHL'], notes: 'OBLIGATOIRE pour franchise droits' },
      { document: 'CMR', recipients: ['Geodis'], notes: 'Transport routier' },
      { document: 'AWB', recipients: ['DHL'], notes: 'Express aérien' },
      { document: 'e-dec suisse', recipients: ['Autre'], notes: 'Transitaire suisse pour import' },
    ],
    declarationsRequired: [
      'Déclaration d\'exportation (EX1)',
      'EUR.1 ou déclaration d\'origine sur facture',
      'Déclaration d\'importation suisse (e-dec)'
    ],
    documentsRequired: [
      'Facture commerciale (français/allemand)',
      'Packing list',
      'EUR.1 ou déclaration origine',
      'CMR / Document transport',
      'Certificat de conformité si requis'
    ],
    costItems: [
      { id: 'prep', label: 'Préparation commande', payer: 'Fournisseur', description: 'Emballage, documents multilingues' },
      { id: 'customs_export', label: 'Dédouanement export FR', payer: 'Fournisseur', description: 'EX1 + EUR.1' },
      { id: 'transport', label: 'Transport routier', payer: 'Variable', description: 'France → Suisse', typical_percentage: '2-4% valeur' },
      { id: 'customs_import', label: 'Dédouanement import CH', payer: 'Variable', description: 'Formalités douane suisse' },
      { id: 'duties', label: 'Droits de douane', payer: 'Variable', description: '0% avec EUR.1, sinon tarif MFN', typical_percentage: '0-5%' },
      { id: 'tva_ch', label: 'TVA suisse', payer: 'Variable', description: 'TVA import 8.1% (normal)', typical_percentage: '8.1%' }
    ],
    steps: [
      { id: '1', label: 'Commande client CH', actor: 'Client', description: 'Commande depuis Suisse' },
      { id: '2', label: 'Préparation', actor: 'ORLIMAN', description: 'Documents FR/DE, EUR.1' },
      { id: '3', label: 'Export France', actor: 'ORLIMAN', description: 'Déclaration EX1 + EUR.1' },
      { id: '4', label: 'Transport', actor: 'Geodis/DHL', description: 'Passage frontière' },
      { id: '5', label: 'Dédouanement CH', actor: 'Transitaire CH', description: 'e-dec + paiement TVA' },
      { id: '6', label: 'Livraison', actor: 'Transporteur', description: 'Livraison client final' }
    ],
    risks: [
      'EUR.1 obligatoire pour franchise droits (origine UE)',
      'Documents en allemand/français selon canton',
      'TVA suisse non récupérable pour vendeur français'
    ],
    bestPractices: [
      'Toujours établir EUR.1 pour produits origine UE',
      'Travailler avec transitaire suisse habitué aux dispositifs médicaux',
      'Facture en CHF ou EUR selon préférence client',
      'Vérifier normes CH spécifiques (Swissmedic si dispositifs médicaux)'
    ]
  },
  {
    id: 'hors_ue',
    name: 'Flux Hors UE / Zone Préférentielle',
    shortName: 'Hors UE',
    description: 'Exportations vers pays tiers hors UE avec dédouanement complet. Possibilité d\'accords préférentiels (EUR.1, FORM A) selon destination pour réduire les droits.',
    zone: 'Hors UE',
    incoterm: 'FCA/DAP/DDP',
    transitaires: ['DHL', 'LVoverseas', 'Geodis', 'Autre'],
    documentDistribution: [
      { document: 'Facture commerciale (EN)', recipients: ['DHL', 'LVoverseas', 'Geodis', 'Autre'], notes: '3 exemplaires originaux' },
      { document: 'Packing list', recipients: ['DHL', 'LVoverseas', 'Geodis', 'Autre'], notes: 'Détail des colis' },
      { document: 'EUR.1 / FORM A / ATR', recipients: ['DHL', 'LVoverseas', 'Geodis', 'Autre'], notes: 'Selon accord préférentiel' },
      { document: 'Certificat d\'origine', recipients: ['DHL', 'LVoverseas', 'Geodis', 'Autre'], notes: 'CCI ou douanes' },
      { document: 'Document transport (BL/AWB/CMR)', recipients: ['DHL', 'LVoverseas', 'Geodis'], notes: 'Selon mode de transport' },
      { document: 'Certificats produits', recipients: ['Autre'], notes: 'Transitaire destination pour conformité locale' },
    ],
    declarationsRequired: [
      'Déclaration d\'exportation (EX1)',
      'EUR.1 si accord préférentiel',
      'FORM A si SPG',
      'Déclaration import pays destination'
    ],
    documentsRequired: [
      'Facture commerciale (EN)',
      'Packing list',
      'EUR.1 / FORM A / ATR selon destination',
      'Certificat d\'origine',
      'Document de transport (BL, AWB, CMR)',
      'Certificats spécifiques selon produit'
    ],
    costItems: [
      { id: 'prep', label: 'Préparation export', payer: 'Fournisseur', description: 'Emballage international' },
      { id: 'customs_export', label: 'Dédouanement export', payer: 'Fournisseur', description: 'EX1 + certificats origine' },
      { id: 'transport', label: 'Transport international', payer: 'Variable', description: 'Maritime/Aérien/Routier', typical_percentage: '5-15% valeur' },
      { id: 'insurance', label: 'Assurance transport', payer: 'Variable', description: 'CIF si inclus', typical_percentage: '0.3-0.5%' },
      { id: 'customs_import', label: 'Dédouanement import', payer: 'Variable', description: 'Selon incoterm' },
      { id: 'duties', label: 'Droits de douane', payer: 'Variable', description: 'Selon pays et accord', typical_percentage: '0-20%' },
      { id: 'tva_import', label: 'TVA/Taxes import', payer: 'Variable', description: 'Selon législation locale', typical_percentage: '5-25%' }
    ],
    steps: [
      { id: '1', label: 'Commande export', actor: 'Client', description: 'Commande internationale' },
      { id: '2', label: 'Vérification', actor: 'ORLIMAN', description: 'Pays, sanctions, certificats requis' },
      { id: '3', label: 'Préparation', actor: 'ORLIMAN', description: 'Documents, emballage international' },
      { id: '4', label: 'Export France', actor: 'ORLIMAN', description: 'EX1, EUR.1/FORM A' },
      { id: '5', label: 'Transport', actor: 'DHL/LVoverseas/Geodis', description: 'Acheminement international' },
      { id: '6', label: 'Import destination', actor: 'Transitaire local', description: 'Dédouanement + taxes' },
      { id: '7', label: 'Livraison', actor: 'Transporteur local', description: 'Distribution finale' }
    ],
    risks: [
      'Sanctions internationales (vérifier liste noire)',
      'Certificats origine mal établis = droits pleins',
      'Délais imprévisibles selon destination',
      'Réglementations locales dispositifs médicaux'
    ],
    bestPractices: [
      'Vérifier accords préférentiels applicables',
      'Contrôler sanctions/embargos avant acceptation commande',
      'Utiliser transitaire expérimenté sur la destination',
      'Prévoir délais larges pour pays difficiles',
      'Assurance marchandise recommandée'
    ]
  }
];

export const getCircuitById = (id: string): ExportCircuit | undefined => {
  return exportCircuits.find(c => c.id === id);
};
