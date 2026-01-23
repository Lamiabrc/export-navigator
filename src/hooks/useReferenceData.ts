import { useCallback, useEffect, useState } from "react";
import type { Destination, Incoterm, Zone } from "@/types";
import { REFERENCE_OVERRIDES_KEY } from "@/lib/constants/storage";

export interface IncotermReference {
  code: Incoterm | string;
  description: string;
  payerTransport: "Fournisseur" | "Client" | string;
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
  mode: "Depositaire (stock local)" | "Envoi direct depuis metropole";
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
      code: "EXW",
      description: "Ex Works – client prend en charge des la sortie entrepot",
      payerTransport: "Client",
      notes: "Pas de dedouanement export par le vendeur.",
      obligations: ["Mise a disposition marchandise", "Assistance documents commerciaux"],
    },
    {
      code: "FCA",
      description: "Free Carrier – remise au transporteur designe",
      payerTransport: "Client",
      notes: "Dedouanement export par le vendeur.",
      obligations: ["Dedouanement export", "Chargement camion si en entrepot vendeur"],
    },
    {
      code: "DAP",
      description: "Delivered At Place – livraison au lieu convenu",
      payerTransport: "Fournisseur",
      notes: "Import a charge client.",
      obligations: ["Transport principal paye", "Gestion transport local si prevu"],
    },
    {
      code: "DDP",
      description: "Delivered Duty Paid – vendeur supporte tous les couts",
      payerTransport: "Fournisseur",
      notes: "Inclut droits/TVA import.",
      obligations: ["Transport principal + import", "Paiement droits/TVA", "Formalites douane import"],
    },
  ],
  destinations: [
    {
      destination: "France metropolitaine",
      zone: "UE",
      tvaRegime: "TVA 20% / autoliquidation B2B possible",
      taxesPossibles: ["eco-contributions", "frais dossier transporteur"],
      flags: ["Mentionner TVA intra si B2B", "Controler eco-participations"],
      documents: ["Facture", "BL signe"],
      restrictions: "Pas de controle specifique identifie sur ce segment.",
    },
    {
      destination: "International (hors UE)",
      zone: "Hors UE",
      tvaRegime: "TVA import selon pays",
      taxesPossibles: ["droits de douane", "taxes locales", "frais de dossier"],
      flags: ["Verifier HS code avant devis", "Prevoir delais douane"],
      documents: ["Facture detaillee", "Declaration export", "Packing list"],
      restrictions: "Adapter incoterm et declarant selon pays.",
    },
    {
      destination: "Suisse",
      zone: "Hors UE",
      tvaRegime: "TVA import 7.7% collectee localement",
      taxesPossibles: ["droits selon HS", "frais dossier transit", "TVA import"],
      flags: ["Certificat d'origine conseille", "Facture en CHF appreciee"],
      documents: ["Facture commerciale", "EUR.1 ou declaration origine si applicable"],
      restrictions: "Valoriser transport pour calcul TVA import.",
    },
    {
      destination: "Espagne / Portugal",
      zone: "UE",
      tvaRegime: "TVA intra (autoliquidation) ou 0% si preuve export Canaries",
      taxesPossibles: ["frais de dossier transit", "eco-contributions locales"],
      flags: ["Adresse complete et N TVA requis", "Canaries = regime export"],
      documents: ["Facture", "Preuve de livraison/transport"],
      restrictions: "Valider incoterm avec le client (DAP souvent privilegie).",
    },
  ],
  chargesTaxes: [
    {
      name: "Transit / frais dossier",
      payer: "Client sauf accord commercial",
      trigger: "Transport international ou formalites douane",
      comment: "Toujours refacturer si EXW/FCA, verifier seuils en DDP.",
      mandatoryDocs: ["Facture transit / declarant", "Preuve passage douane"],
      scope: "Toutes zones",
    },
    {
      name: "Droits de douane",
      payer: "Client sauf DDP",
      trigger: "Import hors UE selon HS",
      comment: "Anticiper impact prix de vente pour DDP.",
      mandatoryDocs: ["Declaration en douane", "Calcul droits"],
      scope: "Hors UE",
    },
    {
      name: "TVA import",
      payer: "Client",
      trigger: "Importation (DDP = vendeur avance)",
      comment: "Autoliquidation parfois possible en UE, sinon transit facture.",
      mandatoryDocs: ["Declaration TVA import", "Decompte douane"],
      scope: "Hors UE",
    },
  ],
  cheatSheets: [
    {
      title: "International",
      reminders: [
        "Verifier HS code + origine avant devis.",
        "Adapter incoterm et droits import selon pays.",
        "Prevoir marge de delai douane.",
      ],
      documents: ["Facture commerciale detaillee", "Declaration export", "Preuve livraison"],
      warning: "Verifier sanctions et exigences documentaires selon pays.",
    },
    {
      title: "UE",
      reminders: [
        "Numero TVA client obligatoire pour facturation HT.",
        "Preuve transport (CMR/BL) necessaire pour 0% TVA.",
        "Incoterms FCA/DAP privilegies pour maitrise transport.",
      ],
      documents: ["Facture", "Preuve transport", "EORI vendeur"],
    },
    {
      title: "Suisse",
      reminders: [
        "Valoriser transport pour calcul TVA import 7.7%.",
        "Proposer DAP par defaut, DDP possible via transit dedie.",
        "Origine preferentielle utile pour reduire droits.",
      ],
      documents: ["Facture", "EUR.1 ou declaration d'origine", "Instruction au transitaire"],
      warning: "Refus de livraison sans valeur douane claire sur facture.",
    },
  ],
  logistics: [
    {
      mode: "Depositaire (stock local)",
      bestFor: "Livraison express en hors UE avec stock tampon",
      leadTime: "24-72h selon zone",
      cutoffs: "M-1 : reassort maritime / M-2 : reassort aerien si urgent",
      responsibilities: ["Suivi stock", "Gestion douane import", "Facturation locale si applicable"],
      notes: "Reduit couts transport unitaire mais immobilise du stock.",
    },
    {
      mode: "Envoi direct depuis metropole",
      bestFor: "Commandes ponctuelles / faible volume",
      leadTime: "4-12 jours selon mode (aerien vs maritime)",
      cutoffs: "J-1 12h : cut-off preparation",
      responsibilities: ["Preparer colis avec HS code", "Partager facture + packing list", "Informer client incoterm"],
      notes: "Couts variables ; verifier impact droits et taxes avant devis.",
    },
  ],
  nomenclature: [
    {
      hsCode: "6307",
      label: "Articles textiles confectionnes",
      usages: ["Accessoires", "Textiles techniques"],
      documents: ["Fiche technique", "Declaration conformite"],
      taricUrl: "https://ec.europa.eu/taxation_customs/dds2/taric/measures.jsp?Taric=6307",
      taresUrl: "https://xtares.admin.ch/tares/login/loginFormFiller.do;jsessionid=",
    },
    {
      hsCode: "6212",
      label: "Accessoires textiles et ceintures",
      usages: ["Accessoires de maintien", "Textiles renforts"],
      documents: ["Notice utilisation", "Fiche technique"],
      taricUrl: "https://ec.europa.eu/taxation_customs/dds2/taric/measures.jsp?Taric=6212",
      taresUrl: "https://xtares.admin.ch/tares/login/loginFormFiller.do;hs=6212",
    },
    {
      hsCode: "9021",
      label: "Articles techniques rigides",
      usages: ["Pieces techniques", "Accessoires"],
      documents: ["Certificat conformite", "Notice"],
      taricUrl: "https://ec.europa.eu/taxation_customs/dds2/taric/measures.jsp?Taric=9021",
      taresUrl: "https://xtares.admin.ch/tares/login/loginFormFiller.do;hs=9021",
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
    const raw = localStorage.getItem(REFERENCE_OVERRIDES_KEY);
    if (!raw) {
      setIsLoaded(true);
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      setReferenceData(withDefaults(parsed));
    } catch {
      setReferenceData(defaultReferenceData);
    } finally {
      setIsLoaded(true);
    }
  }, [withDefaults]);

  const save = useCallback((next: ReferenceData) => {
    setReferenceData(next);
    localStorage.setItem(REFERENCE_OVERRIDES_KEY, JSON.stringify(next));
  }, []);

  const reset = useCallback(() => {
    setReferenceData(defaultReferenceData);
    localStorage.removeItem(REFERENCE_OVERRIDES_KEY);
  }, []);

  return { referenceData, save, reset, isLoaded };
};
