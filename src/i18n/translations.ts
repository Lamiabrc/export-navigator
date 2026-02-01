export type LanguageCode = "fr" | "en";

const fr = {
  meta: {
    home: {
      title: "Export Navigator · Maîtrisez vos exports",
      description:
        "Export Navigator livre une première analyse coûts, Incoterms, documents et risques, puis vous oriente vers une validation humaine.",
    },
    tool: {
      title: "Export Navigator · Outil d'évaluation",
      description: "Outil public : estimation des coûts, checklists et score de risque pour vos opérations export.",
    },
    services: {
      title: "Export Navigator · Offre de conseil",
      description: "Pack diagnostic, process export et pilotage mensuel pour sécuriser vos flux.",
    },
    watch: {
      title: "Export Navigator · Veille & ressources",
      description: "Veille réglementaire et insights export pour anticiper les risques.",
    },
    about: {
      title: "Export Navigator · À propos",
      description: "Consultante indépendante en import/export, formalités douanières et TVA.",
    },
    contact: {
      title: "Export Navigator · Contact",
      description: "Réservez un diagnostic de 20 minutes ou envoyez vos questions opérationnelles.",
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
  hero: {
    title: "Maîtrisez vos exports. Dépensez moins. Décidez mieux.",
    subtitle: "Export Navigator vous donne une première analyse (coûts, Incoterms, documents, risques).",
    paragraph:
      "Ensuite, je vous accompagne pour valider votre montage (douane / TVA / DDP), sécuriser vos documents et protéger votre marge.",
    ctaPrimary: "Lancer une simulation",
    ctaSecondary: "Réserver un diagnostic (20 min)",
    brandLabel: "Export Navigator",
  },
  sections: {
    whoTitle: "Pour qui ?",
    whoCards: [
      "PME françaises qui exportent vers l'Europe",
      "PME françaises qui exportent hors UE",
      "PME internationales qui vendent en Europe",
    ],
    toolTitle: "Ce que l'outil fait en 5 minutes",
    toolSteps: [
      "Estimation du prix de revient (transport, douane, frais)",
      "Recommandation Incoterm (impacts responsabilités)",
      "Checklist documentaire & jalons logistiques",
      "Score de risque + points d'attention",
      "Rapport exportable (à partager en interne)",
    ],
    limitationsTitle: "Ce que l'outil ne peut pas confirmer seul",
    limitations: [
      "Validation TVA/DDP selon votre schéma réel",
      "Cas e-commerce (retours, marketplaces, entrepôts)",
      "Produits réglementés / contrôles spécifiques",
      "Clauses contractuelles et responsabilités réelles",
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
        name: "Process Export",
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
        answer: "Oui, la simulation en ligne est gratuite, les interventions humaines sont sur devis.",
      },
      {
        question: "Puis-je exporter depuis plusieurs sites ?",
        answer: "L'outil capture rapidement vos destinations et scénarios. Le suivi humain prend en compte chaque site.",
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
        answer: "Réservez un diagnostic pour valider les chiffres et sécuriser vos documents avant envoi.",
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
    body: "L'outil public analyse vos routes, vos Incoterms et vos documents, puis livre un score avec des actions clés à suivre.",
    list: [
      "Estimation coût complet (transport, douane, frais annexes)",
      "Recommandation Incoterm et impacts responsabilités",
      "Checklist documentaire & jalons logistiques",
      "Score de risque avec conseils pour sécuriser",
    ],
    toolLimitationsTitle: "L'outil vous donne une estimation mais...",
    toolLimitationsBody: "Pour la validation TVA/DDP, les clauses contractuelles ou les cas e-commerce complexes, il faut une analyse humaine.",
    toolLimitationsList: [
      "Validation TVA/DDP selon votre schéma réel",
      "Cas e-commerce (retours, marketplaces, entrepôts)",
      "Produits réglementés / contrôles spécifiques",
      "Clauses contractuelles et responsabilités réelles",
    ],
    toolLimitationsCta: "Valider mon opération avec une consultante",
    humanValidationCta: "Valider mon opération (20 min)",
  },
  servicesPage: {
    headline: "Pack consulting Export Navigator",
    subhead: "Choisissez la durée et le niveau d'accompagnement dont vos équipes ont besoin.",
    description: "Diagnostic express, paramétrage de vos processus export et pilotage mensuel pour sécuriser chaque expédition.",
    packs: [
      "Diagnostic Express · 1–2 semaines · Audit flux, risques et plan d'actions",
      "Process Export · 3–6 semaines · Checklists, jalons et formation",
      "Pilotage Mensuel · Revue flux, écarts et support décisionnel (option veille)",
    ],
    cta: "Parler à la consultante",
  },
  watchPage: {
    headline: "Veille & ressources",
    subhead: "Recevez les signaux réglementaires et commerciaux qui impactent vos exportations.",
    body: "Newsletter, fiches pratiques et alertes pour anticiper les risques TVA, douane ou sanitaire.",
    cta: "Je m'inscris à la veille",
    cards: [
      {
        title: "Veille réglementaire",
        detail: "Suivi des actualités TVA, douane, sanctions et contrôles sanitaires.",
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
      "Je suis consultante en import/export, formalités, TVA et douane depuis plus de 10 ans. J'aide les PME à sécuriser leurs flux sans se noyer dans la réglementation.",
    list: [
      "Expertise douane, TVA, Incoterms, DDP",
      "Méthodologie factuelle : diagnostic, plan d'actions, pilotage",
      "Accompagnement à distance comme sur site",
    ],
  },
  contactPage: {
    headline: "Contact",
    body: "Décrivez votre opération, joignez vos documents et réservez un créneau de diagnostic rapide.",
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
      "Export Navigator est un outil d'aide à la décision. Les résultats sont indicatifs et doivent être validés selon votre contexte opérationnel et réglementaire.",
  },
};

const en = {
  meta: {
    home: {
      title: "Export Navigator · Master your exports",
      description: "Export Navigator delivers a first look at costs, Incoterms, documents, and risks before you book human validation.",
    },
    tool: {
      title: "Export Navigator · Estimation tool",
      description: "Free tool: landed cost estimate, documentation checklist, and risk score for your export operations.",
    },
    services: {
      title: "Export Navigator · Services",
      description: "Express diagnostic, process setup, and monthly reviews to keep your shipments compliant.",
    },
    watch: {
      title: "Export Navigator · Insights & watch",
      description: "Regulatory alerts and commercial insights for cross-border teams.",
    },
    about: {
      title: "Export Navigator · About",
      description: "Independent consultant in import/export, customs, and VAT compliance.",
    },
    contact: {
      title: "Export Navigator · Contact",
      description: "Book a 20-minute diagnostic call or share your export project.",
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
  hero: {
    title: "Master your exports. Spend less. Decide better.",
    subtitle: "Export Navigator gives you a first answer (costs, Incoterms, documents, risks).",
    paragraph: "Then I help you validate your customs/VAT setup, secure documentation, and protect your margins.",
    ctaPrimary: "Run a free simulation",
    ctaSecondary: "Book a 20-min diagnostic call",
    brandLabel: "Export Navigator",
  },
  sections: {
    whoTitle: "Who it's for",
    whoCards: [
      "French SMEs exporting to Europe",
      "French SMEs exporting outside the EU",
      "International SMEs selling into Europe",
    ],
    toolTitle: "What the tool does in 5 minutes",
    toolSteps: [
      "Landed cost estimate (freight, duties, fees)",
      "Incoterm guidance (responsibilities and risks)",
      "Document checklist & shipment milestones",
      "Risk score with explanations",
      "Shareable first-analysis report",
    ],
    limitationsTitle: "What the tool cannot confirm alone",
    limitations: [
      "VAT/DDP validation based on your real setup",
      "E-commerce scenarios (returns, marketplaces, warehouses)",
      "Regulated goods and specific controls",
      "Contract clauses and real responsibilities",
    ],
    limitationsCta: "Validate my shipment with a consultant",
    consultingTitle: "Consulting offer",
    consultingDescription:
      "Modular packs to secure your first diagnostics, industrialize your documents, and keep a human in the loop.",
    consultingPacks: [
      {
        name: "Express Diagnostic",
        detail: "1–2 weeks · Flow audit, risks, and an immediate action plan.",
      },
      {
        name: "Export Process Setup",
        detail: "3–6 weeks · Checklists, milestones, documentation, and training.",
      },
      {
        name: "Monthly Operations Review",
        detail: "Flux review, gap tracking, and decision support with optional monitoring.",
      },
    ],
    faqTitle: "FAQ",
    faqItems: [
      {
        question: "Is the tool free?",
        answer: "Yes, the online simulation is free, human interventions are quoted separately.",
      },
      {
        question: "Can I use it for multiple locations?",
        answer: "The tool captures multiple routes; the follow-up includes each site impact.",
      },
      {
        question: "What happens during the diagnostic?",
        answer: "A 20-minute call validates your risks and delivers a clear next step list.",
      },
      {
        question: "Do you deliver documents?",
        answer: "Yes: reports, checklists, and action plans validated with you.",
      },
      {
        question: "What should I do after the report?",
        answer: "Book a validation call to lock in your TVA/Customs setup before shipment.",
      },
    ],
    finalCtaTitle: "Facing a complex case?",
    finalCtaParagraph: "Let's move from automation to human validation to secure your customs, VAT and documentation.",
    finalCtaButton: "Schedule a call",
    consultingPrice: "Starting from €2,200",
  },
  toolPage: {
    headline: "Export Navigator · Estimate tool",
    subhead: "Get a quick landed cost, responsibilities and risk score.",
    body: "The public tool analyzes your routing, Incoterms and documents to produce a score with clear actions.",
    list: [
      "Landed cost estimate (freight, duties, fees)",
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
  },
  servicesPage: {
    headline: "Consulting packs",
    subhead: "Select the duration and level of involvement your team needs.",
    description: "Express diagnostic, process industrialization and monthly monitoring to keep every shipment compliant.",
    packs: [
      "Express Diagnostic · 1–2 weeks · Flow audits, risk mapping and action planning",
      "Export Process Setup · 3–6 weeks · Checklists, milestones, documents and training",
      "Monthly Operations Review · Flow reviews, gap tracking and decision support (monitoring option)",
    ],
    cta: "Talk to the consultant",
  },
  watchPage: {
    headline: "Insights & watch",
    subhead: "Receive regulatory signals and practical resources for export teams.",
    body: "Newsletter, factsheets and alerts to anticipate VAT, customs or sanitary issues.",
    cta: "Subscribe to the watch",
    cards: [
      {
        title: "Regulatory watch",
        detail: "Updates on customs, VAT and compliance signals that impact your exports.",
      },
      {
        title: "Practical insights",
        detail: "Templates, checklists and field cases to operationalize your decisions.",
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
      "I am an import/export and customs/VAT consultant with 10+ years of field experience. I help SMEs secure their flows without drowning in rules.",
    list: [
      "Customs, VAT, Incoterms and DDP expertise",
      "Fact-based methodology: audit, plan, pilot",
      "Remote or on-site support",
    ],
  },
  contactPage: {
    headline: "Contact",
    body: "Describe your shipment, attach key documents and book a diagnostic slot.",
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
      "Export Navigator is a decision-support tool. Results are indicative and must be validated based on your operational and regulatory context.",
  },
};

export const translations = { fr, en } as const;

const getNestedValue = (obj: Record<string, any>, path: string) =>
  path
    .split(".")
    .reduce((acc, part) => (acc && typeof acc === "object" ? acc[part] : undefined), obj);

export { getNestedValue };

export type TranslationValue = ReturnType<typeof getNestedValue>;
