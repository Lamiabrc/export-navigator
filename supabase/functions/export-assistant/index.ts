function kbForDestination(destination: DestinationKey) {
  const commonRegulatory = [
    "Dispositifs médicaux Classe I : vérifier statut, étiquetage, notice/IFU, langue exigée, traçabilité, vigilance.",
    "Vérifier si un importateur/distributeur local est requis (responsabilités, réclamations, vigilance).",
    "Ne jamais figer une exigence réglementaire sans vérifier la règle locale (autorité sanitaire + exigences de mise sur le marché).",
  ];

  const commonTransport = [
    "Clarifier l’Incoterm + le lieu (EXW/FCA/DAP/DDP...) : qui paie le transport, l’assurance, les taxes/droits, le dédouanement ?",
    "Toujours verrouiller HS code + origine + valeur : ce sont les 3 causes n°1 de blocages/coûts à l’import.",
    "Preuve de transport indispensable (AWB/BL/CMR) + packing list propre (poids, volumes, nb colis).",
  ];

  const commonDocs = [
    "Facture commerciale (mentions complètes) + packing list",
    "Document transport (AWB/BL/CMR) + preuve d’expédition/livraison",
    "Origine (si utile) + HS code recommandé sur facture (au minimum en interne)",
    "Certificats/attestations de conformité selon le produit et la destination",
  ];

  const commonRisks = [
    "Incoterm flou → qui paie taxes/droits/transport ? → litiges et surcoûts",
    "HS code / origine / valeur incohérents → retards, taxes imprévues, contrôles",
    "Mentions facture incomplètes → blocage douane / transporteur",
    "Étiquetage/notice non conforme → refus distribution ou mise sur le marché",
  ];

  const commonNext = [
    "Confirmer destination exacte + incoterm + lieu (ex: DAP Nouméa / DDP Fort-de-France)",
    "Valider HS code + origine + valeur (et la responsabilité importateur/I.O.R.)",
    "Préparer le pack documentaire (facture, packing, transport, conformité) + preuve",
    "Verrouiller qui paie taxes/droits et qui dédouane (client, transitaire, vous)",
    "À valider avec transitaire / fiscaliste / RA qualité selon cas",
  ];

  // Base générique
  const base = {
    regulatory_basics: commonRegulatory,
    vat_tax_basics: [
      "Ne pas annoncer de taux fixe sans validation : TVA/droits varient selon destination, incoterm, statut client, et classification.",
      "Le point clé opérationnel : définir qui est l’importateur de référence (IOR) et qui supporte taxes/droits (DAP vs DDP).",
      "À valider avec transitaire / fiscaliste / RA qualité selon cas",
    ],
    transport_customs_basics: commonTransport,
    documents_checklist: commonDocs,
    distribution_notes: [
      "Contrat distribution : responsabilités (vigilance, retours, stockage, réclamations).",
      "Fixer la politique retours/SAV : qui reprend, comment tracer, quels délais.",
    ],
    risks_and_pitfalls: commonRisks,
    watch_regulatory: [
      "Surveiller exigences locales import/distribution DM + évolutions douanières (restrictions, sanctions, docs).",
    ],
    watch_competitive: [
      "Comparer prix, canaux (distributeur, marketplace), conditions de remboursement et concurrence locale.",
    ],
    next_steps: commonNext,
  };

  // --- DROM (Guadeloupe, Martinique, Guyane, Mayotte, Réunion)
  if (destination.startsWith("DROM_")) {
    return {
      ...base,
      vat_tax_basics: [
        "Métropole → DROM : livraison de biens généralement facturable HT (exonération) si conditions + preuves d’expédition/livraison (à sécuriser).",
        "Octroi de mer : taxe spécifique applicable dans les DROM, à anticiper (qui paie ? selon incoterm).",
        "Guyane/Mayotte : TVA non applicable (règle spécifique) — attention aux règles locales et à la facturation.",
        "À valider avec transitaire / fiscaliste / RA qualité selon cas",
      ],
      transport_customs_basics: [
        "DROM : anticiper délais + contraintes transport (aérien/mer) + preuve d’expédition.",
        "Clarifier le process octroi de mer (souvent géré par transporteur/transitaire selon incoterm).",
        ...commonTransport,
      ],
      documents_checklist: [
        "Facture + packing list + document transport (AWB/BL/CMR) + preuve d’expédition/livraison",
        "Mentions facture adaptées au flux DROM (exonération si applicable) + incoterm + lieu",
        "Éléments nécessaires au calcul taxes locales (nature produit, valeur, origine ; HS recommandé)",
        "À valider avec transitaire / fiscaliste / RA qualité selon cas",
      ],
      risks_and_pitfalls: [
        "Oublier la preuve d’expédition → risque de remise en cause du traitement TVA",
        "Incoterm mal cadré → octroi de mer / frais locaux non anticipés",
        ...commonRisks,
      ],
    };
  }

  // --- Monaco
  if (destination === "MONACO") {
    return {
      ...base,
      vat_tax_basics: [
        "Monaco : TVA perçue sur les mêmes bases et aux mêmes taux qu’en France (traitement souvent ‘France-like’).",
        "Confirmer le cas réel (B2B/B2C + lieu de livraison + preuve) pour sécuriser le traitement.",
        "À valider avec transitaire / fiscaliste / RA qualité selon cas",
      ],
      transport_customs_basics: [
        "Monaco : généralement pas un schéma ‘hors UE’ classique côté douane, mais garder preuve transport/livraison.",
        ...commonTransport,
      ],
    };
  }

  // --- Nouvelle-Calédonie (PTOM)
  if (destination === "PTOM_NOUVELLE_CALEDONIE") {
    return {
      ...base,
      vat_tax_basics: [
        "Nouvelle-Calédonie (PTOM) : ne fait pas partie du territoire UE/territoire douanier UE → flux à traiter comme ‘hors UE’ côté formalités.",
        "Point clé : qui est IOR (Importer of Record) et qui paye taxes/droits à l’arrivée (DAP vs DDP).",
        "À valider avec transitaire / fiscaliste / RA qualité selon cas",
      ],
      transport_customs_basics: [
        "PTOM : prévoir formalités export + import local ; transitaire fortement recommandé.",
        ...commonTransport,
      ],
      documents_checklist: [
        "Facture commerciale + packing list + document transport",
        "Origine + HS code (recommandé) pour éviter blocage et mauvaise taxation",
        "Consignes IOR / dédouanement (qui déclare, qui paye) + coordonnées importateur",
        "À valider avec transitaire / fiscaliste / RA qualité selon cas",
      ],
      risks_and_pitfalls: [
        "Assumer ‘France’ → oublier formalités/import taxes locales → blocage à l’arrivée",
        "IOR non défini → livraison stoppée chez transporteur",
        ...commonRisks,
      ],
    };
  }

  // --- UE
  if (destination === "UE") {
    return {
      ...base,
      vat_tax_basics: [
        "UE : pas de dédouanement ; focus TVA intracom (statut client + preuve transport) + conformité/notice/étiquetage selon pays.",
        "Toujours collecter preuve de transport pour sécuriser le régime TVA (si exonération intracom).",
        "À valider avec transitaire / fiscaliste / RA qualité selon cas",
      ],
      transport_customs_basics: [
        "UE : pas de formalités douane mais exigences qualité/étiquetage/langue à vérifier.",
        ...commonTransport,
      ],
    };
  }

  // --- Hors UE
  if (destination === "HORS_UE") {
    return {
      ...base,
      vat_tax_basics: [
        "Hors UE : export généralement HT côté vendeur si preuve d’export ; taxes/droits payés à l’import selon pays.",
        "DDP hors UE : attention immatriculation TVA locale / représentant / IOR (risque de blocage si non cadré).",
        "À valider avec transitaire / fiscaliste / RA qualité selon cas",
      ],
      transport_customs_basics: [
        "Hors UE : dédouanement export + import + documents ; anticiper contrôles (produits de santé).",
        ...commonTransport,
      ],
    };
  }

  return base;
}

function buildInvoiceChecklist(destination: DestinationKey): string[] {
  const base = [
    "Coordonnées vendeur/acheteur + adresses complètes",
    "N° facture + date + devise",
    "Description produit claire (réf., quantité, valeur unitaire/total, poids/colis)",
    "Incoterm + lieu (ex: DAP Nouméa / DDP Fort-de-France)",
    "Conditions de paiement",
  ];

  if (destination === "UE" || destination === "MONACO") {
    return [
      ...base,
      "Statut client (B2B/B2C) + n° TVA si applicable",
      "Preuve transport/livraison (bonne pratique systématique)",
    ];
  }

  if (destination.startsWith("DROM_")) {
    return [
      ...base,
      "Mentions adaptées au flux DROM (traitement TVA selon votre cas + preuve)",
      "Éléments utiles taxes locales (valeur, nature produit ; HS recommandé)",
      "À valider avec transitaire / fiscaliste / RA qualité selon cas",
    ];
  }

  if (destination === "PTOM_NOUVELLE_CALEDONIE" || destination === "HORS_UE") {
    return [
      ...base,
      "HS code recommandé (au moins en interne, idéalement sur facture)",
      "Pays d’origine des marchandises (si pertinent)",
      "Nom/coordonnées Importer of Record (IOR) si DDP ou exigé",
      "À valider avec transitaire / fiscaliste / RA qualité selon cas",
    ];
  }

  return base;
}

function buildCompetitiveQueries(destination: DestinationKey): string[] {
  switch (destination) {
    case "MONACO":
      return ["distributeur dispositifs médicaux Monaco", "prix orthèses Monaco", "concurrents orthèses Monaco"];
    case "PTOM_NOUVELLE_CALEDONIE":
      return ["importateur dispositifs médicaux Nouvelle-Calédonie", "tarif douanier Nouvelle-Calédonie orthèses", "concurrents orthèses Nouvelle-Calédonie"];
    case "UE":
      return ["distributeur orthèses Europe", "prix orthèses UE", "concurrents ORLIMAN orthèses UE"];
    case "HORS_UE":
      return ["importateur dispositifs médicaux pays cible", "exigences importateur dispositifs médicaux pays cible", "concurrents orthèses pays cible"];
    default:
      return ["octroi de mer orthèses DROM", "distributeur orthèses Martinique Guadeloupe Réunion Guyane Mayotte", "concurrents orthèses DROM"];
  }
}

function buildQuestions(destination: DestinationKey, context: Record<string, unknown> | undefined): string[] {
  const qs: string[] = [];

  qs.push("Destination exacte (pays/île/ville) + incoterm souhaité (DAP ou DDP) ?");
  qs.push("Qui est l’importateur de référence (IOR) et qui paie taxes/droits/frais à l’arrivée ?");
  qs.push("Avez-vous HS code + origine + valeur (pour éviter mauvaise taxation/retards) ?");

  if (destination.startsWith("DROM_")) {
    qs.push("Qui gère l’octroi de mer (transporteur/transitaire/vous/client) et quel est le schéma de preuve d’expédition ?");
  } else if (destination === "MONACO") {
    qs.push("Client B2B/B2C et lieu réel de livraison (Monaco) + preuve de transport disponible ?");
  } else if (destination === "PTOM_NOUVELLE_CALEDONIE") {
    qs.push("Avez-vous un transitaire pour formalités export + import local en Nouvelle-Calédonie ?");
  } else if (destination === "HORS_UE") {
    qs.push("Y a-t-il des exigences d’enregistrement/importateur local pour dispositifs médicaux dans le pays cible ?");
  }

  if (!context || Object.keys(context).length === 0) {
    qs.push("Produit exact (réf, usage, classe DM, étiquetage/IFU existants, langue) ?");
  }

  return qs.slice(0, 6);
}
