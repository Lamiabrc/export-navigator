export const marketingTranslations = {
  fr: {
    meta: {
      home: {
        title: "Export Navigator · Optimisez vos exports",
        description:
          "Optimisez vos opérations import/export, estimez le coût réel et détectez les incohérences avant de lancer vos expéditions.",
      },
    },
    heroLanding: {
      title: "Optimisez vos opérations import/export. Calculez vos coûts réels.",
      subtitle: "Vérifiez la fiabilité d’une facture, estimez les coûts annexes, et sécurisez vos décisions.",
      ctaPrimary: "Lancer une estimation gratuite",
      ctaSecondary: "Voir les offres VIP",
      featureCards: [
        {
          title: "Coût réel rendu (landed cost)",
          description: "Tous les postes de dépense — transport, assurances, droits, TVA et frais annexes — consolidés en un seul chiffre.",
        },
        {
          title: "Fiabilité facture et incohérences",
          description: "Score automatique, alertes sur les totaux, les incoterms et les variations, avec recommandations concrètes.",
        },
        {
          title: "Veille et conformité",
          description: "Sources officielles, jalons logistiques et rappels de conformité pour sécuriser vos expéditions.",
        },
      ],
    },
    pricing: {
      headline: "Choisissez la maturité qui vous libère",
      subhead: "Plans alignés sur vos volumes, vos équipes et votre besoin de validation humaine.",
      description: "Chaque plan combine simulations, historique, alertes et assistance pour transformer l’outil en cockpit décisionnel.",
      tiers: {
        FREE: {
          name: "FREE",
          price: "Gratuit",
          description: "Accès public, 3 simulations/jour, résultats simplifiés sans historique.",
          features: [
            "Estimations publics simplifiées",
            "Checklist basique et score de risque",
            "Veille en lecture seule",
            "Aucun stockage d’historique",
          ],
        },
        PRO: {
          name: "PRO",
          price: "290 €/mois",
          description: "Historique, veille personnalisée et résultats détaillés pour piloter vos équipes.",
          features: [
            "Historique complet des simulations",
            "Veille et alertes prioritaires",
            "Résultats détaillés (Incoterms, documents, risques)",
            "Quota 30 simulations/jour",
          ],
        },
        VIP: {
          name: "VIP",
          price: "690 €/mois",
          description: "Tout PRO plus rentabilité, vérifications facture, exports PDF/Excel et support proactif.",
          features: [
            "Rentabilité et coût complet automatisé",
            "Vérification facture import et cohérences",
            "Exports PDF/Excel et reporting premium",
            "Quota 300 simulations/jour",
          ],
        },
      },
      cta: "Voir les conditions VIP",
    },
    importWizard: {
      title: "Module importateurs · Fiabilité facture",
      subtitle:
        "Quatre étapes guidées pour scénariser vos factures, calculer le landed cost et détecter les incohérences critiques.",
      steps: ["Facture", "Transport et annexes", "Droits et taxes", "Résultats"],
      scoreLabel: "Score de fiabilité",
      resultLabel: "Coût réel estimé",
      warningsTitle: "Drapeaux d’attention",
      actionsTitle: "Actions recommandées",
      saveButton: "Valider et enregistrer",
      usageLabel: "Simulations utilisées aujourd’hui",
      warnings: {
        missingSupplier: "Fournisseur ou pays manquant",
        missingIncoterm: "Incoterm absent ou incertain",
        mismatchTotals: "Totaux facturés vs lignes incohérents",
        unexpectedFreight: "Frais logistiques inclus malgré un incoterm EXW/FCA",
        lowUnitPrice: "Prix unitaire anormalement bas",
      },
      actions: {
        askSupplier: "Demandez au fournisseur de confirmer les totaux et devises.",
        documentCheck: "Vérifiez contrats, Incoterms et clauses DDP/TVA.",
        consolidate: "Regroupez les lignes ou vérifiez les remises massives.",
        humanReview: "Réservez une analyse humaine si vous restez en doute.",
      },
    },
    exportCosting: {
      title: "Module exportateurs · Coût complet et rentabilité",
      subtitle:
        "Renseignez vos coûts logistiques, vos droits et vos aspirations de vente pour évaluer vos marges et seuils critiques.",
      summaryLabel: "Synthèse coûts",
      profitabilityTitle: "Bloc rentabilité VIP",
      profitabilitySubtitle: "Marge, seuil de rentabilité et sensibilité aux variations fret/droits.",
      cta: "Calculer la simulation",
      sensitivityLabel: "Variations clés",
    },
    gating: {
      title: "Passez à la vitesse supérieure",
      body: "Les plans PRO/VIP débloquent les historiques, la veille proactive et la validation humaine indispensable aux cas complexes.",
      cta: "Découvrir les plans",
      planLabels: {
        FREE: "Freemium",
        PRO: "Pro",
        VIP: "VIP",
      },
    },
    history: {
      title: "Historique des simulations",
      empty: "Aucune simulation enregistrée pour le moment.",
    },
    quotas: {
      usage: "%s sur %s simulations utilisées aujourd’hui",
      limitReached: "Quota atteint, passez en PRO/VIP ou attendez demain.",
    },
  },
  en: {
    meta: {
      home: {
        title: "Export Navigator · Real landed cost intelligence",
        description:
          "Capture invoice consistency, landed cost detail and compliance alerts before you validate customs, VAT or contracts.",
      },
    },
    heroLanding: {
      title: "Optimize your import/export operations. Estimate your real landed costs.",
      subtitle: "Validate invoice consistency, estimate ancillary costs, and secure decisions.",
      ctaPrimary: "Start a free estimate",
      ctaSecondary: "See VIP plans",
      featureCards: [
        {
          title: "Real landed cost",
          description: "Freight, duties, VAT, insurances and ancillary costs consolidated into a single picture.",
        },
        {
          title: "Invoice consistency checks",
          description: "Score, alerts and anomaly detection across totals, Incoterms and price variations.",
        },
        {
          title: "Monitoring and compliance",
          description: "Official sources, shipment milestones and compliance reminders.",
        },
      ],
    },
    pricing: {
      headline: "Choose the tier that scales with you",
      subhead: "Plans built for freemium agility, proactive monitoring and VIP-grade validation.",
      description: "Each tier merges simulations, history, alerts and human validation to keep your flow safe.",
      tiers: {
        FREE: {
          name: "FREE",
          price: "0 €",
          description: "Public access, 3 simulations/day, simplified outputs without history.",
          features: [
            "Simplified landed cost estimate",
            "Checklist and risk score",
            "Watchlist digest",
            "No saved history",
          ],
        },
        PRO: {
          name: "PRO",
          price: "290 €/month",
          description: "History, tailored monitoring and detailed results for team alignment.",
          features: [
            "Full simulation history",
            "Priority watch alerts",
            "Detailed breakdowns (Incoterm, docs, risks)",
            "30 simulations/day quota",
          ],
        },
        VIP: {
          name: "VIP",
          price: "690 €/month",
          description: "Everything PRO plus profitability, invoice verification, PDF/Excel exports and proactive support.",
          features: [
            "End-to-end profitability and costing",
            "Invoice and VAT verification",
            "Premium reporting plus exports",
            "300 simulations/day quota",
          ],
        },
      },
      cta: "See VIP advantages",
    },
    importWizard: {
      title: "Importers · Invoice reliability",
      subtitle:
        "Four guided steps to capture invoices, compute landed cost and flag critical inconsistencies before validation.",
      steps: ["Invoice", "Transport and extras", "Duties and taxes", "Outputs"],
      scoreLabel: "Reliability score",
      resultLabel: "Estimated landed cost",
      warningsTitle: "Watch flags",
      actionsTitle: "Recommended actions",
      saveButton: "Save this simulation",
      usageLabel: "Simulations used today",
      warnings: {
        missingSupplier: "Supplier or country missing",
        missingIncoterm: "Incoterm unspecified",
        mismatchTotals: "Invoice total mismatches item-level sum",
        unexpectedFreight: "Logistics costs included with EXW/FCA",
        lowUnitPrice: "Unit price looks unusually low",
      },
      actions: {
        askSupplier: "Ask the supplier to confirm totals and currency.",
        documentCheck: "Review contracts, Incoterms and DDP/VAT clauses.",
        consolidate: "Group lines or double-check bulk discounts.",
        humanReview: "Book a human review if doubts remain.",
      },
    },
    exportCosting: {
      title: "Exporters · Costing and profitability",
      subtitle:
        "Feed your logistics, duties and pricing to assess margins, break-even and sensitivity before quoting.",
      summaryLabel: "Cost breakdown",
      profitabilityTitle: "VIP profitability block",
      profitabilitySubtitle: "Margin, break-even and sensitivity to freight/tax swings.",
      cta: "Run the simulation",
      sensitivityLabel: "Key levers",
    },
    gating: {
      title: "Upgrade for the full decision stack",
      body: "PRO/VIP unlock history, proactive monitoring and expert validation for VAT, customs and contracts.",
      cta: "Review the plans",
      planLabels: {
        FREE: "Freemium",
        PRO: "Pro",
        VIP: "VIP",
      },
    },
    history: {
      title: "Simulation history",
      empty: "No saved simulations yet.",
    },
    quotas: {
      usage: "%s out of %s simulations used today",
      limitReached: "Daily quota reached, upgrade or wait until tomorrow.",
    },
  },
} as const;
