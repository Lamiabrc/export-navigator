export type LanguageCode = "fr" | "en";

const fr = {
  meta: {
    home: {
      title: "Export Navigator · France ↔ Monde — Décidez mieux",
      description:
        "Export Navigator vous donne une première lecture import/export (coût complet, Incoterms, documents, risques) puis vous oriente vers une validation humaine selon votre contexte (TVA, douane, contrats).",
    },
    tool: {
      title: "Export Navigator · Outil d'évaluation",
      description:
        "Outil public France ↔ Monde : estimation du coût complet, checklists et score de risque pour vos opérations import/export.",
    },
    services: {
      title: "Export Navigator · Offre de conseil",
      description:
        "Packs diagnostic, process import/export et pilotage mensuel pour sécuriser vos flux depuis/vers la France et le monde.",
    },
    watch: {
      title: "Export Navigator · Veille & ressources",
      description:
        "Veille réglementaire et insights import/export (douane, TVA, sanctions, exigences documentaires) pour anticiper les risques.",
    },
    about: {
      title: "Export Navigator · À propos",
      description: "Consultante indépendante en import/export, formalités douanières, TVA et sécurisation opérationnelle (France ↔ Monde).",
    },
    contact: {
      title: "Export Navigator · Contact",
      description: "Réservez un diagnostic de 20 minutes ou posez vos questions import/export (TVA, douane, Incoterms, documents).",
    },
  },

  header: {
    menu: {
      home: "Accueil",
      tool: "Outil",
      services: "Offre",
      watch: "Veille",
      about: "À propos",
      contact: "Contact",
    },
    cta: "Demander un diagnostic",
    languageLabel: "Langue",
    languageAria: "Changer la langue du site",
  },

  companyProfile: {
    title: "Profil société requis",
    description:
      "Avant de profiter de la version FREE (simulations, rapports limités, watch demo), confirmez votre société et son adresse. Cette donnée reste confidentielle et sécurise l'accès à l'outil.",
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
      description: "Tu peux maintenant utiliser la version FREE (quotas limités) et retrouver ta veille.",
    },
    errors: {
      missing: "Informations manquantes",
      help: "Complète tous les champs obligatoires pour continuer.",
      saveTitle: "Erreur lors de la sauvegarde",
      saveBody: "Impossible d'enregistrer les informations. Réessaie dans quelques instants.",
    },
    friendly: "Merci de confirmer, on s’occupe du reste. 😊",
  },
  gdpr: {
    guaranteeTitle: "Garantie RGPD",
    guaranteeBody:
      "Vos données sont stockées sur des serveurs européens, chiffrées au repos et accessibles uniquement par nos équipes autorisées. Vous gardez le contrôle, demandez la suppression ou la rectification à tout moment.",
    consentTitle: "Paramètres de consentement",
    consentBody:
      "On active les cookies essentiels, analytiques et marketing seulement avec ton consentement. Tu peux ajuster les catégories ci-dessous, et tout est réversible.",
    options: {
      analytics: "Statistiques anonymes",
      marketing: "Mises à jour & invitations",
    },
    actions: {
      accept: "Tout accepter",
      save: "Sauvegarder mes choix",
    },
  },

  hero: {
    title: "France ↔ Monde : maîtrisez vos coûts. Décidez mieux.",
    subtitle: "Export Navigator vous donne une première lecture (coût complet, Incoterms, documents, risques).",
    paragraph:
      "Ensuite, je vous accompagne pour valider votre montage (douane / TVA / DDP), sécuriser vos documents et protéger votre marge, en import comme en export.",
    ctaPrimary: "Lancer une simulation",
    ctaSecondary: "Réserver un diagnostic (20 min)",
    brandLabel: "Export Navigator",
  },

  sections: {
    whoTitle: "Pour qui ?",
    whoCards: [
      "PME en France qui exportent vers le monde entier",
      "PME en France qui importent depuis le monde entier",
      "Entreprises internationales qui vendent/expédient vers la France (et doivent cadrer TVA, douane, documents)",
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
    limitationsCta: "Valider mon opération avec une consultante",

    consultingTitle: "Offre de consulting",
    consultingDescription:
      "Des packs modulables pour couvrir les premiers diagnostics, industrialiser vos process et piloter vos flux régulièrement.",
    consultingPacks: [
      {
        name: "Diagnostic Express",
        detail: "1–2 semaines : audit flux, risques et plan d'actions immédiats.",
      },
      {
        name: "Process Import/Export",
        detail: "3–6 semaines : checklists, jalons, documents et formations ciblées.",
      },
      {
        name: "Pilotage Mensuel",
        detail: "Revue des flux, écarts, support décisionnel et option veille continue.",
      },
    ],

    faqTitle: "FAQ",
    faqItems: [
      {
        question: "L'outil est-il gratuit ?",
        answer: "Oui, la simulation en ligne est gratuite ; les interventions humaines sont sur devis.",
      },
      {
        question: "Dois-je forcément choisir un pays ?",
        answer:
          "Oui pour une analyse fiable : l’import/export dépend des relations, accords et traités. Sans pays, l’outil ne peut donner qu’une lecture générale.",
      },
      {
        question: "Dois-je saisir un code HS ?",
        answer:
          "Idéalement oui : le HS permet d’affiner droits, contrôles et contraintes. Sans HS, l’outil applique des règles générales (conditions de base).",
      },
      {
        question: "Comment se déroule le diagnostic ?",
        answer: "Nous échangeons 20 minutes pour confirmer vos risques, puis je vous propose un plan clair.",
      },
      {
        question: "Fournissez-vous des livrables ?",
        answer: "Oui : rapport synthétique exportable, checklists et plan d'actions validés par mes soins.",
      },
      {
        question: "Quelle est la prochaine étape ?",
        answer: "Réservez un diagnostic pour valider les chiffres et sécuriser vos documents avant expédition.",
      },
    ],

    finalCtaTitle: "Vous avez un cas complexe ?",
    finalCtaParagraph: "Passons ensemble à la validation humaine pour sécuriser votre TVA, vos documents et votre marge.",
    finalCtaButton: "Réserver un appel",
    consultingPrice: "À partir de 2 200 €",
  },

  toolPage: {
    headline: "Export Navigator · Outil d'estimation",
    subhead: "Estimez vos coûts, vos responsabilités et vos risques en quelques clics.",
    body:
      "L'outil public analyse vos routes France ↔ Monde, vos Incoterms et vos documents, puis livre un score avec des actions clés à suivre.",
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
    toolLimitationsCta: "Valider mon opération avec une consultante",
    humanValidationCta: "Valider mon opération (20 min)",

    // ✅ Messages prêts à l'emploi (si tu veux les afficher quand champs vides)
    emptyStates: {
      missingCountry:
        "Sans pays (origine/destination), l’analyse reste générale : l’import/export dépend des relations, accords et traités. Indiquez un pays pour une estimation fiable.",
      missingHs:
        "Sans code HS, l’outil applique des conditions générales (hypothèses prudentes). Ajoutez un HS pour affiner droits, contrôles et contraintes.",
    },
  },

  servicesPage: {
    headline: "Pack consulting Export Navigator",
    subhead: "Choisissez la durée et le niveau d'accompagnement dont vos équipes ont besoin.",
    description:
      "Diagnostic express, paramétrage de vos processus import/export et pilotage mensuel pour sécuriser chaque expédition (France ↔ Monde).",
    packs: [
      "Diagnostic Express · 1–2 semaines · Audit flux, risques et plan d'actions",
      "Process Import/Export · 3–6 semaines · Checklists, jalons et formation",
      "Pilotage Mensuel · Revue flux, écarts et support décisionnel (option veille)",
    ],
    cta: "Parler à la consultante",
  },

  watchPage: {
    headline: "Veille & ressources",
    subhead: "Recevez les signaux réglementaires et commerciaux qui impactent vos opérations France ↔ Monde.",
    body: "Newsletter, fiches pratiques et alertes pour anticiper les risques TVA, douane, sanctions ou exigences documentaires.",
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
        title: "Newsletter",
        detail: "Briefing mensuel sur tarifs, DDP, Incoterms et conformité marketplace.",
      },
    ],
  },

  aboutPage: {
    headline: "À propos",
    body:
      "Je suis consultante en import/export, formalités, TVA et douane depuis plus de 10 ans. J'aide les PME à sécuriser leurs flux France ↔ Monde sans se noyer dans la réglementation.",
    list: [
      "Expertise douane, TVA, Incoterms, DDP",
      "Méthodologie factuelle : diagnostic, plan d'actions, pilotage",
      "Accompagnement à distance comme sur site",
    ],
  },

  contactPage: {
    headline: "Contact",
    body: "Décrivez votre opération (import ou export), joignez vos documents et réservez un créneau de diagnostic rapide.",
    form: {
      name: "Nom / société",
      email: "Email professionnel",
      message: "Votre demande",
      submit: "Envoyer et réserver",
    },
    bookBlock: {
      title: "Réserver un appel 20 min",
      body: "Je vous rappelle pour valider vos risques TVA, douane et DDP avant toute expédition.",
      cta: "Choisir un créneau",
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
      title: "Export Navigator · France ↔ World — Decide better",
      description:
        "Export Navigator provides a first look at import/export costs, Incoterms, documents and risks, then guides you to human validation based on your VAT, customs and contractual setup.",
    },
    tool: {
      title: "Export Navigator · Estimation tool",
      description:
        "Public tool France ↔ World: landed cost estimate, document checklists and a risk score for import/export operations.",
    },
    services: {
      title: "Export Navigator · Services",
      description:
        "Express diagnostic, import/export process setup and monthly reviews to keep shipments compliant (France ↔ World).",
    },
    watch: {
      title: "Export Navigator · Insights & watch",
      description:
        "Regulatory alerts and operational insights (customs, VAT, sanctions, document requirements) for cross-border teams.",
    },
    about: {
      title: "Export Navigator · About",
      description: "Independent import/export consultant covering customs, VAT and operational compliance (France ↔ World).",
    },
    contact: {
      title: "Export Navigator · Contact",
      description: "Book a 20-minute diagnostic call or share your import/export request (VAT, customs, Incoterms, docs).",
    },
  },

  header: {
    menu: {
      home: "Home",
      tool: "Tool",
      services: "Services",
      watch: "Insights",
      about: "About",
      contact: "Contact",
    },
    cta: "Book a diagnostic",
    languageLabel: "Language",
    languageAria: "Switch site language",
  },

  companyProfile: {
    title: "Company profile required",
    description:
      "Before unlocking the FREE tier (limited simulations, demo watch), confirm your company and address. This information stays confidential and ensures accountable usage.",
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
      description: "You can now use the FREE tier (with its quotas) and access your watch preview.",
    },
    errors: {
      missing: "Missing information",
      help: "Fill every required field to continue.",
      saveTitle: "Could not save",
      saveBody: "We could not store the profile. Try again in a few moments.",
    },
    friendly: "Thanks for confirming, we’ll take care of the rest. 😊",
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

  hero: {
    title: "France ↔ World: control costs. Decide better.",
    subtitle: "Export Navigator gives you a first answer (landed cost, Incoterms, documents, risks).",
    paragraph:
      "Then I help you validate your customs/VAT setup, secure documentation, and protect margins — for imports and exports.",
    ctaPrimary: "Run a free simulation",
    ctaSecondary: "Book a 20-min diagnostic call",
    brandLabel: "Export Navigator",
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
      "Without country and HS code, the analysis stays at a general-rules level",
    ],
    limitationsCta: "Validate my shipment with a consultant",

    consultingTitle: "Consulting offer",
    consultingDescription:
      "Modular packs to secure first diagnostics, industrialize documents and keep a human in the loop.",
    consultingPacks: [
      {
        name: "Express Diagnostic",
        detail: "1–2 weeks · Flow audit, risks, and an immediate action plan.",
      },
      {
        name: "Import/Export Process Setup",
        detail: "3–6 weeks · Checklists, milestones, documentation, and training.",
      },
      {
        name: "Monthly Operations Review",
        detail: "Flow review, gap tracking, and decision support with optional monitoring.",
      },
    ],

    faqTitle: "FAQ",
    faqItems: [
      {
        question: "Is the tool free?",
        answer: "Yes, the online simulation is free; human interventions are quoted separately.",
      },
      {
        question: "Do I need to select a country?",
        answer:
          "Yes for reliable results: trade depends on relationships, agreements and treaties. Without a country, only general guidance is possible.",
      },
      {
        question: "Do I need an HS code?",
        answer:
          "Ideally yes: HS refines duties, controls and constraints. Without HS, the tool uses general assumptions (baseline conditions).",
      },
      {
        question: "What happens during the diagnostic?",
        answer: "A 20-minute call validates your risks and delivers a clear action list.",
      },
      {
        question: "Do you deliver documents?",
        answer: "Yes: reports, checklists and action plans validated with you.",
      },
      {
        question: "What should I do after the report?",
        answer: "Book a validation call to lock in VAT/customs/documents before you ship.",
      },
    ],

    finalCtaTitle: "Facing a complex case?",
    finalCtaParagraph: "Let’s move from automation to human validation to secure VAT, customs, documents and margins.",
    finalCtaButton: "Schedule a call",
    consultingPrice: "Starting from €2,200",
  },

  toolPage: {
    headline: "Export Navigator · Estimate tool",
    subhead: "Get a quick landed cost, responsibilities and risk score.",
    body:
      "The public tool analyzes your France ↔ World routing, Incoterms and documents to produce a score with clear next actions.",
    list: [
      "Landed cost estimate (freight, duties, taxes, fees)",
      "Incoterm guidance (responsibilities and risks)",
      "Document checklist & shipment milestones",
      "Risk score with explanations",
    ],
    toolLimitationsTitle: "The tool gives you a first answer but...",
    toolLimitationsBody: "VAT/DDP validation, contract clauses or complex e-commerce cases still need a human review.",
    toolLimitationsList: [
      "VAT/DDP validation based on your real setup",
      "E-commerce scenarios (returns, marketplaces, warehouses)",
      "Regulated goods and specific controls",
      "Contract clauses and real responsibilities",
    ],
    toolLimitationsCta: "Validate my shipment with a consultant",
    humanValidationCta: "Validate my operation (20 min)",

    // ✅ Ready-to-use messages (if you want to show them when fields are empty)
    emptyStates: {
      missingCountry:
        "Without a country (origin/destination), results stay generic: trade depends on agreements and treaties. Select a country for a reliable estimate.",
      missingHs:
        "Without an HS code, the tool applies general assumptions (baseline conditions). Add an HS code to refine duties, controls and constraints.",
    },
  },

  servicesPage: {
    headline: "Consulting packs",
    subhead: "Select the duration and level of involvement your team needs.",
    description:
      "Express diagnostic, process industrialization and monthly monitoring to keep every shipment compliant (France ↔ World).",
    packs: [
      "Express Diagnostic · 1–2 weeks · Flow audits, risk mapping and action planning",
      "Import/Export Process Setup · 3–6 weeks · Checklists, milestones, documents and training",
      "Monthly Operations Review · Flow reviews, gap tracking and decision support (monitoring option)",
    ],
    cta: "Talk to the consultant",
  },

  watchPage: {
    headline: "Insights & watch",
    subhead: "Receive regulatory signals and practical resources for France ↔ World operations.",
    body: "Newsletter, factsheets and alerts to anticipate VAT, customs, sanctions or document requirements.",
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
        title: "Newsletter",
        detail: "A monthly briefing on tariffs, DDP, Incoterms and marketplace compliance.",
      },
    ],
  },

  aboutPage: {
    headline: "About",
    body:
      "I am an import/export and customs/VAT consultant with 10+ years of field experience. I help SMEs secure France ↔ World flows without drowning in rules.",
    list: [
      "Customs, VAT, Incoterms and DDP expertise",
      "Fact-based methodology: audit, plan, pilot",
      "Remote or on-site support",
    ],
  },

  contactPage: {
    headline: "Contact",
    body: "Describe your shipment (import or export), attach key documents and book a diagnostic slot.",
    form: {
      name: "Name / company",
      email: "Work email",
      message: "Your request",
      submit: "Send and book",
    },
    bookBlock: {
      title: "Book a 20-min call",
      body: "I will confirm your VAT, customs and DDP setup before you ship.",
      cta: "Pick a slot",
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
