export type OperationZone = 'DROM' | 'AUTRE';

export interface OperationFlags {
  dateSaisieMissing?: boolean;
  dateDepartMissing?: boolean;
  delaiInvalide?: boolean;
  colisNonStandard?: boolean;
  trackingNonStandard?: boolean;
  facturesMultiples?: boolean;
}

export interface OperationEntry {
  bl: string[];
  clientCode: string | null;
  clientName: string | null;
  ile: string | null;
  zone: OperationZone;
  email: string | null;
  dates: {
    saisie: Date | null;
    transmission: Date | null;
    finPrepa: Date | null;
    depart: Date | null;
  };
  colis: {
    count: number | null;
    raw: string | null;
    nonStandard: boolean;
  };
  tracking: string | null;
  reception: string | null;
  delaiTotal: number | null;
  incoterm: 'DDP' | 'DAP' | 'EXW' | string | null;
  transportMontant: number | null;
  factures: string[];
  commentaires: string | null;
  flags: OperationFlags;
  type?: 'commande' | 'dotation' | 'renvoi' | 'annulee';
}
