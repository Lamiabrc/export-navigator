export type LanguageCode = "fr" | "en";

const fr = {
  meta: {
    home: {
      title: "Export : diagnostic express, veille pays et marges | MPL Export Navigator",
      description:
        "Obtenez en quelques minutes un diagnostic export (documents, risques, Incoterms), une première estimation de marge et une veille pays. Inscription gratuite pour accéder aux résultats.",
    },
    tool: {
      title: "Export Navigator · Outil d'évaluation",
      description:
        "Outil France ↔ Monde : estimation du coût complet, checklists et score de risque pour vos opérations import/export.",
    },
    services: {
      title: "Export Navigator · Offres & plans",
      description:
        "Des plans clairs : FREE, PRO ONLINE (59€), PRO + VISIO (149€) et PILOTAGE HEBDO (560€) pour sécuriser vos flux France ↔ Monde.",
    },
    watch: {
      title: "Export Navigator · Veille & ressources",
      description:
        "Veille réglementaire et insights import/export (douane, TVA, sanctions, exigences documentaires) pour anticiper les risques.",
    },
    about: {
      title: "Export Navigator · À propos",
      description:
        "Plateforme d’aide à la décision import/export : coûts, documents, veille et accompagnement optionnel (France ↔ Monde).",
    },
    contact: {
      title: "Export Navigator · Contact",
      description:
        "Posez vos questions import/export ou choisissez un accompagnement (visio mensuelle ou pilotage hebdo).",
    },
  },

  header: {
    menu: {
      home: "Accueil",
      tool: "Outil",
      services: "Offre gratuite",
      watch: "Veille",
      guides: "Guides",
      methodologie: "Méthodologie",
      about: "À propos",
      contact: "Contact",
    },
    cta: "Créer un compte gratuit",
    languageLabel: "Langue",
    languageAria: "Changer la langue du site",
  },

  // ✅ Pop-up FREE : profil société obligatoire
  companyProfile: {
    title: "Profil société requis",
    description:
      "Avant de profiter de la version FREE (quotas et veille démo), confirmez votre société et son adresse. Cette donnée reste confidentielle et sécurise l'accès à l'outil.",
    fields: {
      companyName: "Nom de la société",
      addressLine1: "Adresse (ligne 1)",
      city: "Ville",
      postalCode: "Code postal",
      country: "Pays",
    },
    placeholders: {
      companyName: "Ex : MPL Export Conseil",
      addressLine1: "Ex : 12 rue de la Douane",
      city: "Ex : Paris",
      postalCode: "Ex : 75009",
      country: "Choisir un pays",
    },
    actions: {
      save: "Valider et débloquer",
      saving: "Enregistrement…",
      later: "Plus tard",
    },
    success: {
      title: "Profil confirmé",
      description: "Tu peux maintenant utiliser la version FREE (quotas limités) et accéder à la veille démo.",
    },
    errors: {
      missing: "Informations manquantes",
      help: "Complète tous les champs obligatoires pour continuer.",
      saveTitle: "Erreur lors de la sauvegarde",
      saveBody: "Impossible d'enregistrer les informations. Réessaie dans quelques instants.",
      noTable: "La base n'est pas encore initialisée. Merci de patienter pendant la configuration.",
    },
    friendly: "Merci de confirmer, on s’occupe du reste. 😊",
  },

  gdpr: {
    guaranteeTitle: "Garantie RGPD",
    guaranteeBody:
      "Vos données sont stockées sur des serveurs européens, chiffrées au repos et accessibles uniquement par nos équipes autorisées. Vous gardez le contrôle et pouvez demander la suppression ou la rectification à tout moment.",
    consentTitle: "Paramètres de consentement",
    consentBody:
      "On active les cookies essentiels, analytiques et marketing seulement avec votre consentement. Vous pouvez ajuster les catégories ci-dessous, et tout est réversible.",
    options: {
      analytics: "Statistiques anonymes",
      marketing: "Mises à jour & invitations",
    },
    actions: {
      accept: "Tout accepter",
      save: "Sauvegarder mes choix",
    },
  },

  languagePrompt: {
    title: "Choisissez votre langue",
    body: "Souhaitez-vous continuer en français ou en anglais ?",
  },

  hero: {
    title: "Le département export digital des PME.",
    subtitle: "Simulation, documents, conformité et veille — sans recruter, sans multiplier les outils.",
    paragraph:
      "Export Navigator automatise une grande partie du travail récurrent d’un service export (ADV, responsable, consultant sur les basiques) tout en laissant la décision finale à l’humain selon votre contexte.",
    ctaPrimary: "Tester gratuitement",
    ctaSecondary: "Découvrir les plans",
    brandLabel: "Export Navigator",
    bullets: [
      "Automatise une grande partie du travail d’un service export (ADV, responsable, consultant sur tâches récurrentes)",
      "Simulateur coût rendu (Incoterms, transport, frais) + rapports PDF",
      "Checklists documentaires standardisées",
      "Veille réglementaire automatisée (flux + filtres + digest)",
    ],
  },

  // ✅ UNE seule définition (corrigé)
  automationProof: {
    title: "Ce que l’outil automatise (au lieu d’embaucher)",
    items: [
      {
        title: "ADV export",
        detail: "Checklists, documents et PDF prêts à partager avec vos opérationnels.",
      },
      {
        title: "Responsable export / ADV",
        detail: "Standardisation, contrôle qualité et historiques pour piloter chaque flux.",
      },
      {
        title: "Consultant export (tâches récurrentes)",
        detail: "Cadrage, synthèse et rapports sans mobiliser un consultant pour les basiques.",
      },
      {
        title: "Veille & conformité",
        detail: "Flux RSS, filtres et alertes par pays/HS selon votre plan.",
      },
    ],
  },

  // ✅ UNE seule définition (corrigé)
  disclaimers: [
    "Indications non contractuelles. Ne remplace pas un agent en douane/commissionnaire.",
    "Estimations et checklists à titre indicatif, avec sources quand disponibles.",
    "L’utilisateur reste responsable de la conformité finale.",
  ],

  // ✅ Utilisé par useResolvedPricing(t) : t('pricing')
  pricing: {
    headline: "Des plans clairs, immédiatement activables",
    subhead: "FREE pour tester · 59€ 100% en ligne · 149€ visio mensuelle · 560€ pilotage hebdo",
    description:
      "Choisissez le niveau d’autonomie : self-serve ou accompagnement régulier. La veille et le digest email sont inclus dès PRO ONLINE.",
    cta: "Nous contacter",
    tiers: {
      FREE: {
        name: "FREE",
        price: "0 € / mois",
        description: "Version découverte (profil société requis).",
        features: [
          "Profil société + adresse obligatoires",
          "Simulateur (résultats à l’écran)",
          "1 PDF / mois",
          "Veille démo (historique & périmètre limités)",
          "Pas d’alertes email",
        ],
      },
      PRO_ONLINE: {
        name: "PRO ONLINE",
        price: "59 € / mois",
        description: "100% en ligne : l’outil complet + veille automatisée.",
        features: [
          "Simulateur complet (Incoterms, transport, frais)",
          "Checklists documentaires standardisées",
          "PDF illimités (ou quota très élevé)",
          "Watch Center complet (filtres, recherche, tags)",
          "Digest email hebdo automatique",
          "Historique & exports",
        ],
      },
      PRO_VISIO: {
        name: "PRO + VISIO",
        price: "149 € / mois",
        description: "Tout PRO ONLINE + 1 visio mensuelle.",
        features: [
          "Tout PRO ONLINE",
          "1 visio / mois (réservation incluse)",
          "Pré-formulaire + dépôt documents",
          "Compte-rendu PDF (template)",
          "Support prioritaire",
        ],
      },
      PILOTAGE: {
        name: "PILOTAGE HEBDO",
        price: "560 € / mois",
        description: "Tout PRO ONLINE + 1h/semaine.",
        features: [
          "Tout PRO ONLINE",
          "1h / semaine (visio)",
          "Priorisation + plan d’actions hebdo",
          "Revue risques & conformité",
          "Support prioritaire (fast track)",
        ],
      },
    },
  },

  sections: {
    whoTitle: "Pour qui ?",
    whoCards: [
      "PME en France qui exportent vers le monde entier",
      "PME en France qui importent depuis le monde entier",
      "Entreprises internationales qui vendent/expédient vers la France (TVA, douane, documents)",
    ],

    toolTitle: "Ce que l'outil fait en 5 minutes",
    toolSteps: [
      "Estimation du coût complet (transport, douane, taxes, frais annexes)",
      "Lecture Incoterm (impacts responsabilités et risques)",
      "Checklist documentaire & jalons logistiques (France ↔ Monde)",
      "Score de risque + points d'attention",
      "Rapport exportable (à partager en interne)",
    ],

    limitationsTitle: "Ce que l'outil ne peut pas confirmer seul",
    limitations: [
      "Validation TVA/DDP selon votre schéma réel",
      "Cas e-commerce (retours, marketplaces, entrepôts)",
      "Produits réglementés / contrôles spécifiques",
      "Clauses contractuelles et responsabilités réelles",
      "Sans pays (origine/destination) et sans HS, l’analyse se limite à des règles générales",
    ],
    limitationsCta: "Passer sur un plan avec visio",

    // Ajusté : plus “packs devis”, mais “accompagnement”
    consultingTitle: "Accompagnement (optionnel)",
    consultingDescription:
      "Vous pouvez rester 100% autonome (59€) ou ajouter une visio mensuelle (149€) ou un pilotage hebdo (560€).",
    consultingPacks: [
      {
        name: "PRO ONLINE",
        detail: "59€/mois · 100% self-serve + veille + digest email hebdo.",
      },
      {
        name: "PRO + VISIO",
        detail: "149€/mois · 1 visio / mois + pré-formulaire + compte-rendu PDF.",
      },
      {
        name: "PILOTAGE HEBDO",
        detail: "560€/mois · 1h / semaine · priorisation + plan d’actions.",
      },
    ],

    faqTitle: "FAQ",
    faqItems: [
      {
        question: "L'outil est-il gratuit ?",
        answer:
          "Oui : une version FREE existe (quotas + veille démo). Pour l’outil complet et la veille automatisée, choisissez PRO ONLINE (59€).",
      },
      {
        question: "La veille est incluse à partir de quel plan ?",
        answer:
          "La veille complète et le digest email hebdo sont inclus dès PRO ONLINE (59€). La version FREE propose une veille démo limitée.",
      },
      {
        question: "Dois-je forcément choisir un pays ?",
        answer:
          "Oui pour une analyse fiable : l’import/export dépend des relations, accords et traités. Sans pays, l’outil ne peut donner qu’une lecture générale.",
      },
      {
        question: "Dois-je saisir un code HS ?",
        answer:
          "Idéalement oui : le HS permet d’affiner droits, contrôles et contraintes. Sans HS, l’outil applique des règles générales (hypothèses prudentes).",
      },
      {
        question: "Est-ce que ça remplace un agent en douane ?",
        answer:
          "Non. Export Navigator fournit des estimations indicatives, des checklists et de la veille. La conformité finale dépend de votre contexte et doit être validée si nécessaire.",
      },
      {
        question: "Quelle est la prochaine étape ?",
        answer:
          "Testez le FREE, puis passez en PRO ONLINE (59€) pour débloquer l’outil complet. Si votre cas est complexe, optez pour la visio mensuelle (149€) ou le pilotage hebdo (560€).",
      },
    ],

    finalCtaTitle: "Vous avez un cas complexe ?",
    finalCtaParagraph:
      "Passez du self-serve à un accompagnement régulier : visio mensuelle ou pilotage hebdo pour sécuriser TVA, douane, documents et marge.",
    finalCtaButton: "Nous contacter",
    consultingPrice: "À partir de 149 € / mois",
  },

  toolPage: {
    headline: "Export Navigator · Outil d'estimation",
    subhead: "Estimez vos coûts, vos responsabilités et vos risques en quelques clics.",
    body:
      "L'outil analyse vos routes France ↔ Monde, vos Incoterms et vos documents, puis livre un score avec des actions clés à suivre.",
    list: [
      "Estimation coût complet (transport, douane, taxes, frais annexes)",
      "Lecture Incoterm et impacts responsabilités",
      "Checklist documentaire & jalons logistiques",
      "Score de risque avec conseils pour sécuriser",
    ],
    toolLimitationsTitle: "L'outil vous donne une estimation mais...",
    toolLimitationsBody:
      "Pour la validation TVA/DDP, les clauses contractuelles ou les cas e-commerce complexes, il faut une analyse humaine.",
    toolLimitationsList: [
      "Validation TVA/DDP selon votre schéma réel",
      "Cas e-commerce (retours, marketplaces, entrepôts)",
      "Produits réglementés / contrôles spécifiques",
      "Clauses contractuelles et responsabilités réelles",
    ],
    toolLimitationsCta: "Passer sur un plan avec visio",
    humanValidationCta: "Nous contacter",

    emptyStates: {
      missingCountry:
        "Sans pays (origine/destination), l’analyse reste générale : l’import/export dépend des relations, accords et traités. Indiquez un pays pour une estimation fiable.",
      missingHs:
        "Sans code HS, l’outil applique des conditions générales (hypothèses prudentes). Ajoutez un HS pour affiner droits, contrôles et contraintes.",
    },
  },

  // ✅ Services page (ta page Services.tsx utilise ces clés)
  servicesPage: {
    headline: "Des plans clairs pour sécuriser vos exports",
    subhead: "Self-serve ou accompagnement régulier — selon votre besoin.",
    description:
      "Simulateur, checklists, PDF et veille automatisée : vous choisissez le niveau d’autonomie (FREE, 59€, 149€ ou 560€).",
    cta: "Nous contacter",

    // ✅ labels simples (évite servicesPage.cta.pricing qui casserait si cta est une string)
    ctaPricing: "Voir les tarifs",
    ctaDetails: "Voir le détail",
    badgeRecommended: "Recommandé",

    disclaimer:
      "Indications non contractuelles — ne remplace pas un agent en douane/commissionnaire. Vous restez responsable de la conformité finale.",

    proof: {
      adv: {
        title: "ADV export",
        desc: "Checklists documentaires, rapports PDF et préparation standardisée.",
      },
      manager: {
        title: "Responsable export / ADV",
        desc: "Pilotage, historique, règles communes et partage simple avec l’équipe.",
      },
      consultant: {
        title: "Consultant export (tâches récurrentes)",
        desc: "Cadrage basique, synthèse et documents prêts à valider et diffuser.",
      },
      watch: {
        title: "Veille & conformité",
        desc: "Flux RSS, filtres, tags et digest automatique selon votre plan.",
      },
    },
  },

  watchPage: {
    headline: "Veille & ressources",
    subhead: "Recevez les signaux réglementaires et commerciaux qui impactent vos opérations France ↔ Monde.",
    body: "Alertes, fiches pratiques et digests pour anticiper risques TVA, douane, sanctions ou exigences documentaires.",
    cta: "Je m'inscris à la veille",
    cards: [
      {
        title: "Veille réglementaire",
        detail: "Suivi des actualités TVA, douane, sanctions et contrôles.",
      },
      {
        title: "Insights pratiques",
        detail: "Templates, checklists et retours d'expérience pour décider vite.",
      },
      {
        title: "Digest automatique",
        detail: "Briefing hebdo par pays/catégories à partir du plan PRO ONLINE.",
      },
    ],
  },

  aboutPage: {
    headline: "À propos",
    body:
      "Export Navigator est une plateforme d’aide à la décision import/export : coût rendu, documents, veille et accompagnement optionnel. L’objectif : réduire les erreurs et standardiser vos flux France ↔ Monde.",
    list: [
      "Coûts, Incoterms, documents, risques",
      "Veille RSS structurée et filtrable",
      "Autonome ou avec visio mensuelle / pilotage hebdo",
    ],
  },

  contactPage: {
    headline: "Contact",
    body: "Décrivez votre besoin (import ou export) et choisissez votre niveau d’accompagnement.",
    form: {
      name: "Nom / société",
      email: "Email professionnel",
      message: "Votre demande",
      submit: "Envoyer",
    },
    bookBlock: {
      title: "Accompagnement en visio",
      body: "Optez pour 1 visio / mois (149€) ou 1h / semaine (560€) selon votre niveau de complexité.",
      cta: "Découvrir les plans",
    },
  },

  footer: {
    copy:
      "Export Navigator est un outil d'aide à la décision. Les résultats sont indicatifs et doivent être validés selon votre contexte opérationnel, contractuel et réglementaire.",
  },
};

const en = {
  meta: {
    home: {
      title: "Export: express diagnosis, country watch and margins | MPL Export Navigator",
      description:
        "Get a quick export diagnostic (documents, risks, Incoterms), a first margin estimate and a country watch. Free signup to access results.",
    },
    tool: {
      title: "Export Navigator · Estimation tool",
      description:
        "France ↔ World tool: landed cost estimate, document checklists and a risk score for import/export operations.",
    },
    services: {
      title: "Export Navigator · Plans & pricing",
      description:
        "Clear plans: FREE, PRO ONLINE (€59), PRO + VIDEO (€149) and WEEKLY PILOTING (€560) to keep France ↔ World shipments compliant.",
    },
    watch: {
      title: "Export Navigator · Insights & watch",
      description:
        "Regulatory alerts and operational insights (customs, VAT, sanctions, document requirements) for cross-border teams.",
    },
    about: {
      title: "Export Navigator · About",
      description:
        "Decision-support platform for import/export: costs, documents, watch and optional coaching (France ↔ World).",
    },
    contact: {
      title: "Export Navigator · Contact",
      description:
        "Share your request and choose a coaching level (monthly video or weekly piloting).",
    },
  },

  header: {
    menu: {
      home: "Home",
      tool: "Tool",
      services: "Free offer",
      watch: "Insights",
      guides: "Guides",
      methodologie: "Methodology",
      about: "About",
      contact: "Contact",
    },
    cta: "Create free account",
    languageLabel: "Language",
    languageAria: "Switch site language",
  },

  companyProfile: {
    title: "Company profile required",
    description:
      "Before unlocking the FREE tier (quotas and demo watch), confirm your company and address. This information stays confidential and ensures accountable usage.",
    fields: {
      companyName: "Company name",
      addressLine1: "Address (line 1)",
      city: "City",
      postalCode: "Postal code",
      country: "Country",
    },
    placeholders: {
      companyName: "e.g. MPL Export Conseil",
      addressLine1: "e.g. 12 Rue de la Douane",
      city: "e.g. Paris",
      postalCode: "e.g. 75009",
      country: "Select a country",
    },
    actions: {
      save: "Confirm & unlock",
      saving: "Saving…",
      later: "Later",
    },
    success: {
      title: "Profile saved",
      description: "You can now use the FREE tier (with its quotas) and access the demo watch.",
    },
    errors: {
      missing: "Missing information",
      help: "Fill every required field to continue.",
      saveTitle: "Could not save",
      saveBody: "We could not store the profile. Try again in a few moments.",
      noTable: "The platform is still setting up. Please retry shortly.",
    },
    friendly: "Thanks for confirming — we’ll take care of the rest. 😊",
  },

  gdpr: {
    guaranteeTitle: "GDPR guarantee",
    guaranteeBody:
      "Data is hosted in the EU, encrypted at rest, and accessed only by authorized team members. You remain in control and can request deletion anytime.",
    consentTitle: "Consent preferences",
    consentBody:
      "Essential, analytics and marketing cookies activate only after you agree. You can adjust each category below and revoke consent at any moment.",
    options: {
      analytics: "Anonymous analytics",
      marketing: "Updates & invitations",
    },
    actions: {
      accept: "Accept all",
      save: "Save preferences",
    },
  },

  languagePrompt: {
    title: "Pick your language",
    body: "Would you like to continue in English or French?",
  },

  hero: {
    title: "Your digital export department for SMEs.",
    subtitle: "Costs, documents, compliance watch — without hiring.",
    paragraph:
      "Export Navigator automates a large part of recurring export work (ops, export manager, consultant on basics) while keeping final compliance decisions human and contextual.",
    ctaPrimary: "Try for free",
    ctaSecondary: "Explore the plans",
    brandLabel: "Export Navigator",
    bullets: [
      "Automates a large part of export workflows (ops, export manager, consultant on recurring tasks)",
      "Landed-cost simulator (Incoterms, transport, fees) + one-page PDF reports",
      "Standardized documentation checklists",
      "Automated compliance watch (feeds + filters + digest)",
    ],
  },

  automationProof: {
    title: "What the tool automates instead of hiring",
    items: [
      {
        title: "Export ops",
        detail: "Checklists, documents and share-ready PDFs across teams.",
      },
      {
        title: "Export manager / ADV lead",
        detail: "Standardization, quality control and histories for every lane.",
      },
      {
        title: "Export consultant (recurring basics)",
        detail: "Scoping, synthesis and templated reporting without ongoing consulting.",
      },
      {
        title: "Watch & compliance",
        detail: "RSS feeds, filters and alerts by country/HS based on your plan.",
      },
    ],
  },

  disclaimers: [
    "Non-binding information. Does not replace a licensed customs broker/forwarder.",
    "Estimates and checklists are indicative; sources provided when available.",
    "The user remains responsible for the final compliance decision.",
  ],

  pricing: {
    headline: "Clear plans you can activate instantly",
    subhead: "FREE to test · €59 self-serve · €149 monthly video · €560 weekly piloting",
    description:
      "Choose autonomy level: self-serve or regular coaching. Full watch + weekly digest are included from PRO ONLINE.",
    cta: "Contact us",
    tiers: {
      FREE: {
        name: "FREE",
        price: "€0 / month",
        description: "Discovery tier (company profile required).",
        features: [
          "Company + address required",
          "Simulator (screen results)",
          "1 PDF / month",
          "Demo watch (limited history & scope)",
          "No email alerts",
        ],
      },
      PRO_ONLINE: {
        name: "PRO ONLINE",
        price: "€59 / month",
        description: "100% self-serve: full tool + automated watch.",
        features: [
          "Full simulator (Incoterms, transport, fees)",
          "Standard documentation checklists",
          "Unlimited PDFs (or very high quota)",
          "Full Watch Center (filters, search, tags)",
          "Automated weekly email digest",
          "History & exports",
        ],
      },
      PRO_VISIO: {
        name: "PRO + VIDEO",
        price: "€149 / month",
        description: "Everything in PRO ONLINE + 1 monthly video session.",
        features: [
          "Everything in PRO ONLINE",
          "1 video session / month (booking included)",
          "Pre-call form + document upload",
          "Meeting summary PDF template",
          "Priority support",
        ],
      },
      PILOTAGE: {
        name: "WEEKLY PILOTING",
        price: "€560 / month",
        description: "Everything in PRO ONLINE + 1 hour per week.",
        features: [
          "Everything in PRO ONLINE",
          "1 hour / week (video)",
          "Weekly prioritization & action plan",
          "Risk & compliance review",
          "Priority support (fast track)",
        ],
      },
    },
  },

  sections: {
    whoTitle: "Who it's for",
    whoCards: [
      "SMEs in France exporting worldwide",
      "SMEs in France importing from anywhere",
      "International businesses shipping/selling into France (VAT, customs, documentation)",
    ],

    toolTitle: "What the tool does in 5 minutes",
    toolSteps: [
      "Landed cost estimate (freight, duties, taxes, fees)",
      "Incoterm guidance (responsibilities and risk)",
      "Document checklist & shipment milestones (France ↔ World)",
      "Risk score with explanations",
      "Shareable first-analysis report",
    ],

    limitationsTitle: "What the tool cannot confirm alone",
    limitations: [
      "VAT/DDP validation based on your real setup",
      "E-commerce scenarios (returns, marketplaces, warehouses)",
      "Regulated goods and specific controls",
      "Contract clauses and real responsibilities",
      "Without country and HS code, the analysis stays generic",
    ],
    limitationsCta: "Upgrade to a plan with coaching",

    consultingTitle: "Coaching (optional)",
    consultingDescription:
      "Stay self-serve (€59) or add monthly video (€149) or weekly piloting (€560).",
    consultingPacks: [
      {
        name: "PRO ONLINE",
        detail: "€59/month · self-serve + watch + weekly email digest.",
      },
      {
        name: "PRO + VIDEO",
        detail: "€149/month · 1 call/month + intake form + PDF summary.",
      },
      {
        name: "WEEKLY PILOTING",
        detail: "€560/month · 1h/week · prioritization + action plan.",
      },
    ],

    faqTitle: "FAQ",
    faqItems: [
      {
        question: "Is the tool free?",
        answer:
          "Yes: a FREE tier exists (quotas + demo watch). For the full tool and automated watch, choose PRO ONLINE (€59).",
      },
      {
        question: "When is the full watch included?",
        answer:
          "Full Watch Center and weekly email digest are included from PRO ONLINE (€59). FREE offers a limited demo watch.",
      },
      {
        question: "Do I need to select a country?",
        answer:
          "Yes for reliable results: trade depends on agreements and treaties. Without a country, only general guidance is possible.",
      },
      {
        question: "Do I need an HS code?",
        answer:
          "Ideally yes: HS refines duties, controls and constraints. Without HS, the tool uses general assumptions.",
      },
      {
        question: "Does this replace a customs broker?",
        answer:
          "No. Export Navigator provides indicative estimates, checklists and a watch feed. Final compliance depends on your context and may require validation.",
      },
      {
        question: "What should I do next?",
        answer:
          "Try FREE, then upgrade to PRO ONLINE (€59). For complex cases, choose monthly coaching (€149) or weekly piloting (€560).",
      },
    ],

    finalCtaTitle: "Facing a complex case?",
    finalCtaParagraph:
      "Move from self-serve to regular coaching: monthly video or weekly piloting to secure VAT, customs, documents and margins.",
    finalCtaButton: "Contact us",
    consultingPrice: "Starting from €149 / month",
  },

  toolPage: {
    headline: "Export Navigator · Estimate tool",
    subhead: "Get a quick landed cost, responsibilities and risk score.",
    body:
      "The tool analyzes your France ↔ World routing, Incoterms and documents to produce a score with clear next actions.",
    list: [
      "Landed cost estimate (freight, duties, taxes, fees)",
      "Incoterm guidance (responsibilities and risks)",
      "Document checklist & shipment milestones",
      "Risk score with explanations",
    ],
    toolLimitationsTitle: "The tool gives you a first answer but...",
    toolLimitationsBody: "VAT/DDP validation, contract clauses or complex e-commerce cases may still need a human review.",
    toolLimitationsList: [
      "VAT/DDP validation based on your real setup",
      "E-commerce scenarios (returns, marketplaces, warehouses)",
      "Regulated goods and specific controls",
      "Contract clauses and real responsibilities",
    ],
    toolLimitationsCta: "Upgrade to a plan with coaching",
    humanValidationCta: "Contact us",

    emptyStates: {
      missingCountry:
        "Without a country (origin/destination), results stay generic: trade depends on agreements and treaties. Select a country for a reliable estimate.",
      missingHs:
        "Without an HS code, the tool applies general assumptions. Add an HS code to refine duties, controls and constraints.",
    },
  },

  servicesPage: {
    headline: "Clear plans to secure your exports",
    subhead: "Self-serve or regular coaching — choose your level.",
    description:
      "Simulator, checklists, PDFs and automated watch: pick the autonomy level (FREE, €59, €149 or €560).",
    cta: "Contact us",
    ctaPricing: "See pricing",
    ctaDetails: "View details",
    badgeRecommended: "Recommended",
    disclaimer:
      "Non-binding information — does not replace a customs broker. You remain responsible for final compliance.",
    proof: {
      adv: {
        title: "Export ops",
        desc: "Document checklists, PDF reports and standardized preparation.",
      },
      manager: {
        title: "Export manager",
        desc: "Tracking, history, shared rules and easy team handoff.",
      },
      consultant: {
        title: "Consultant (recurring basics)",
        desc: "Basic framing, synthesis and ready-to-share documents.",
      },
      watch: {
        title: "Watch & compliance",
        desc: "RSS feeds, filters, tags and an automated digest based on your plan.",
      },
    },
  },

  watchPage: {
    headline: "Insights & watch",
    subhead: "Receive regulatory signals and practical resources for France ↔ World operations.",
    body: "Alerts, factsheets and digests to anticipate VAT, customs, sanctions or document requirements.",
    cta: "Subscribe to the watch",
    cards: [
      {
        title: "Regulatory watch",
        detail: "Updates on customs, VAT and compliance signals that impact cross-border operations.",
      },
      {
        title: "Practical insights",
        detail: "Templates, checklists and field cases to operationalize decisions.",
      },
      {
        title: "Automated digest",
        detail: "Weekly briefings by country/category from PRO ONLINE.",
      },
    ],
  },

  aboutPage: {
    headline: "About",
    body:
      "Export Navigator is a decision-support platform for import/export: landed cost, documents, watch and optional coaching. The goal: reduce errors and standardize France ↔ World flows.",
    list: [
      "Costs, Incoterms, documents, risks",
      "Structured and filterable RSS watch",
      "Self-serve or monthly/weekly coaching",
    ],
  },

  contactPage: {
    headline: "Contact",
    body: "Describe your request (import or export) and pick your coaching level.",
    form: {
      name: "Name / company",
      email: "Work email",
      message: "Your request",
      submit: "Send",
    },
    bookBlock: {
      title: "Coaching options",
      body: "Choose 1 monthly video (€149) or 1h/week (€560) depending on complexity.",
      cta: "Explore the plans",
    },
  },

  footer: {
    copy:
      "Export Navigator is a decision-support tool. Results are indicative and must be validated based on your operational, contractual and regulatory context.",
  },
};

export const translations = { fr, en } as const;

const getNestedValue = (obj: Record<string, any>, path: string) =>
  path
    .split(".")
    .reduce((acc, part) => (acc && typeof acc === "object" ? acc[part] : undefined), obj);

export { getNestedValue };

export type TranslationValue = ReturnType<typeof getNestedValue>;
