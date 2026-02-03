export const marketingTranslations = {
  fr: {
    meta: {
      home: {
        title: "MPL Export Conseil · France ↔ Monde — coûts, conformité, décisions",
        description:
          "Outil d’aide à la décision pour importer en France ou exporter depuis la France vers le monde entier : coût complet (landed cost), Incoterms, TVA, droits, documents et veille internationale sur sources officielles.",
      },
    },

    heroLanding: {
      title: "Le département export digital des PME.",
      subtitle: "Simulation, documents, conformité et veille — sans recruter, sans multiplier les outils.",
      ctaPrimary: "Tester gratuitement",
      ctaSecondary: "Découvrir les plans",
      proofDescription:
        "Voilà comment la plateforme remplace les tâches routinières de l’ADV, du responsable export et du consultant sur les routines.",
      proofTitle: "Ce que l’outil automatise (au lieu d’embaucher)",
      proofItems: [
        {
          title: "ADV export",
          description: "Checklists, documents et PDF prêts à partager avec vos opérationnels.",
        },
        {
          title: "Responsable export / ADV",
          description: "Standardisation, contrôle et historiques pour piloter vos flux.",
        },
        {
          title: "Consultant export (taches récurrentes)",
          description: "Cadrage, synthèse et rapports sans mobiliser un consultant trop souvent.",
        },
        {
          title: "Veille & conformité",
          description: "Flux RSS, filtres et alertes par pays/HS selon votre plan.",
        },
      ],
      bullets: [
        "Automatise une grande partie du travail d’un service export (ADV, responsable, consultant sur tâches récurrentes)",
        "Simulateur coût rendu (Incoterms, transport, frais) + rapports PDF",
        "Checklists documentaires standardisées",
        "Veille réglementaire automatisée (flux + filtres + digest)",
      ],
      disclaimers: [
        "Ne remplace pas un agent en douane/commissionnaire.",
        "Estimations et checklists à titre indicatif, sources fournies quand disponibles.",
        "L’utilisateur reste responsable de la conformité finale.",
      ],
    },

    pricing: {
      headline: "Choisissez la maturité qui vous libère",
      subhead: "Plans alignés sur vos volumes, vos équipes et votre besoin de validation humaine.",
      description:
        "Chaque plan combine simulations, alertes et assistance. La destination (pays) et le produit (HS) restent la clé : sans eux, on applique des règles générales.",
      tiers: {
        FREE: {
          name: "FREE",
          price: "Gratuit",
          description: "Accès public, 3 simulations/jour, résultats synthétiques (sans historique).",
          features: [
            "Estimations publiques simplifiées",
            "Checklist basique + score de risque",
            "Veille en lecture seule",
            "Aucun historique sauvegardé",
          ],
        },
        PRO: {
          name: "PRO",
          price: "290 €/mois",
          description: "Résultats détaillés, veille ciblée, et historique pour piloter vos flux.",
          features: [
            "Historique complet des simulations",
            "Veille et alertes prioritaires (pays/secteurs)",
            "Résultats détaillés (Incoterms, documents, risques)",
            "Quota 30 simulations/jour",
          ],
        },
        VIP: {
          name: "VIP",
          price: "690 €/mois",
          description: "Tout PRO + rentabilité, vérifications avancées et support proactif.",
          features: [
            "Rentabilité et coût complet automatisé",
            "Contrôles avancés (facture, TVA, cohérences)",
            "Exports PDF/Excel et reporting premium",
            "Quota 300 simulations/jour",
          ],
        },
      },
      cta: "Voir les conditions VIP",
    },

    importWizard: {
      title: "Import vers la France · Contrôle et cohérence",
      subtitle:
        "Un parcours guidé pour repérer les incohérences et estimer un coût complet. Sans pays, impossible d’être fiable : l’export dépend des relations, accords et traités.",
      steps: ["Facture", "Transport et annexes", "Droits et taxes", "Résultats"],
      scoreLabel: "Score de cohérence",
      resultLabel: "Coût complet estimé",
      warningsTitle: "Drapeaux d’attention",
      actionsTitle: "Actions recommandées",
      saveButton: "Télécharger le rapport",
      usageLabel: "Simulations utilisées aujourd’hui",
      warnings: {
        missingSupplier: "Fournisseur ou pays (origine/destination) manquant",
        missingIncoterm: "Incoterm absent ou à confirmer",
        mismatchTotals: "Totaux facturés vs lignes incohérents",
        unexpectedFreight: "Frais logistiques inclus malgré un Incoterm EXW/FCA",
        lowUnitPrice: "Prix unitaire anormalement bas",
      },
      actions: {
        askSupplier: "Demandez au fournisseur de confirmer totaux, devise et conditions.",
        documentCheck: "Vérifiez contrat, Incoterms et clauses TVA/douanes.",
        consolidate: "Regroupez les lignes ou vérifiez remises/avoirs.",
        humanReview: "Réservez une analyse humaine si le cas est sensible.",
      },
    },

    exportCosting: {
      title: "Devis export · Coût complet et seuils de décision",
      subtitle:
        "Renseignez pays, Incoterm, mode de transport et vos coûts : l’outil estime le coût complet et vous aide à cadrer votre prix.",
      summaryLabel: "Synthèse coûts",
      profitabilityTitle: "Bloc rentabilité VIP",
      profitabilitySubtitle: "Marge, seuil de rentabilité et sensibilité aux variations fret/droits.",
      cta: "Calculer la simulation",
      sensitivityLabel: "Variations clés",
    },

    gating: {
      title: "Passez à la vitesse supérieure",
      body:
        "Le département export digital (PRO/VISIO/PILOTAGE) débloque l’historique, la veille ciblée (pays/secteurs) et la validation humaine — indispensable dès qu’il y a TVA, douane, sanctions ou clauses complexes.",
      cta: "Découvrir les plans",
      planLabels: {
        FREE: "Freemium",
        PRO_ONLINE: "PRO 59€",
        PRO_VISIO: "PRO + VISIO 149€",
        PILOTAGE_HEBDO: "Pilotage Hebdo 560€",
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
        title: "MPL Export Conseil · France ↔ World — costing, compliance, decisions",
        description:
          "Decision support tool to import into France or export from France worldwide: real landed cost, Incoterms, VAT, duties, documents and international monitoring from official sources.",
      },
    },

    heroLanding: {
      title: "Your digital export department for SMEs.",
      subtitle: "Costs, documents, compliance watch — without hiring.",
      ctaPrimary: "Try for free",
      ctaSecondary: "See the plans",
      proofDescription:
        "This is how the platform removes routine workloads from your ADV, export manager and consultant.",
      proofTitle: "What the tool automates instead of hiring",
      proofItems: [
        {
          title: "Export back-office",
          description: "Checklists, documents and PDFs ready to share across teams.",
        },
        {
          title: "Export manager / ADV lead",
          description: "Standardization, quality control and history logs for every flow.",
        },
        {
          title: "Export consultant (repeating tasks)",
          description: "Scoping, synthesis and templated reporting without overloading consultants.",
        },
        {
          title: "Watch & compliance",
          description: "RSS feeds, filters and alerts by country/HS tailored to your plan.",
        },
      ],
      bullets: [
        "Automates a large part of export work (ADV, manager, consultant on recurring tasks)",
        "Landed-cost simulator (Incoterms, transport, fees) + PDF reports",
        "Standardized documentation checklists",
        "Automated compliance watch (feeds + filters + digest)",
      ],
      disclaimers: [
        "Does not replace a licensed customs agent/forwarder.",
        "Estimates and checklists are indicative; sources provided when available.",
        "The user remains responsible for the final compliance decision.",
      ],
    },

    pricing: {
      headline: "Choose the tier that scales with you",
      subhead: "Plans built for volumes, teams and expert validation when needed.",
      description:
        "Each tier blends simulations, alerts and assistance. Country and HS remain key: without them, only general rules apply.",
      tiers: {
        FREE: {
          name: "FREE",
          price: "0 €",
          description: "Public access, 3 simulations/day, simplified outputs (no history).",
          features: [
            "Simplified public estimates",
            "Checklist + basic risk score",
            "Read-only monitoring",
            "No saved history",
          ],
        },
        PRO: {
          name: "PRO",
          price: "290 €/month",
          description: "Detailed outputs, targeted monitoring, and history for team alignment.",
          features: [
            "Full simulation history",
            "Priority monitoring alerts (country/sector)",
            "Detailed breakdowns (Incoterm, docs, risks)",
            "30 simulations/day quota",
          ],
        },
        VIP: {
          name: "VIP",
          price: "690 €/month",
          description: "Everything PRO plus profitability, deeper checks and proactive support.",
          features: [
            "End-to-end profitability and costing",
            "Advanced checks (invoice/VAT/consistency)",
            "Premium reporting + PDF/Excel exports",
            "300 simulations/day quota",
          ],
        },
      },
      cta: "See VIP advantages",
    },

    importWizard: {
      title: "Import into France · Checks and consistency",
      subtitle:
        "A guided flow to flag inconsistencies and estimate landed cost. Without a country, results can’t be reliable: trade depends on agreements and treaties.",
      steps: ["Invoice", "Transport and extras", "Duties and taxes", "Outputs"],
      scoreLabel: "Consistency score",
      resultLabel: "Estimated landed cost",
      warningsTitle: "Watch flags",
      actionsTitle: "Recommended actions",
      saveButton: "Download the report",
      usageLabel: "Simulations used today",
      warnings: {
        missingSupplier: "Supplier or country (origin/destination) missing",
        missingIncoterm: "Incoterm unspecified or uncertain",
        mismatchTotals: "Invoice total mismatches item-level sum",
        unexpectedFreight: "Logistics costs included with EXW/FCA",
        lowUnitPrice: "Unit price looks unusually low",
      },
      actions: {
        askSupplier: "Ask the supplier to confirm totals, currency and terms.",
        documentCheck: "Review contracts, Incoterms and VAT/customs clauses.",
        consolidate: "Group lines or double-check discounts/credit notes.",
        humanReview: "Book a human review if the case is sensitive.",
      },
    },

    exportCosting: {
      title: "Export quoting · Landed cost and decision thresholds",
      subtitle:
        "Provide country, Incoterm, transport mode and costs: the tool estimates landed cost and helps frame your pricing.",
      summaryLabel: "Cost breakdown",
      profitabilityTitle: "VIP profitability block",
      profitabilitySubtitle: "Margin, break-even and sensitivity to freight/tax swings.",
      cta: "Run the simulation",
      sensitivityLabel: "Key levers",
    },

    gating: {
      title: "Upgrade for the full decision stack",
      body:
        "The digital export department (PRO/VISIO/PILOTAGE) unlocks history, targeted watch (country/sector) and human validation — essential when VAT, customs, sanctions or contract clauses get complex.",
      cta: "Review the plans",
      planLabels: {
        FREE: "Freemium",
        PRO_ONLINE: "PRO 59€",
        PRO_VISIO: "PRO + VISIO 149€",
        PILOTAGE_HEBDO: "Pilotage Hebdo 560€",
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
