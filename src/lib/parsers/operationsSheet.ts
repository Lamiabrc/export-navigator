import type { OperationEntry, OperationZone } from '../../types/operations.js';

const MONTH_MAP: Record<string, string> = {
  janv: '01',
  févr: '02',
  fevr: '02',
  mars: '03',
  avr: '04',
  avril: '04',
  mai: '05',
  juin: '06',
  juil: '07',
  juill: '07',
  août: '08',
  aout: '08',
  sept: '09',
  septem: '09',
  oct: '10',
  nov: '11',
  déc: '12',
  dec: '12',
};

const isBlank = (v: unknown) => v === null || v === undefined || `${v}`.trim() === '' || `${v}`.trim() === '/' || `${v}`.trim() === '#N/A' || `${v}`.trim() === '0';

const normalizeString = (v: unknown): string | null => {
  if (isBlank(v)) return null;
  return `${v}`.trim();
};

const normalizeNumber = (v: unknown): number | null => {
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  if (typeof v === 'string') {
    const cleaned = v.replace(/[^\d.-]/g, '');
    const num = Number(cleaned);
    return Number.isFinite(num) ? num : null;
  }
  return null;
};

const parseDateLoose = (value: unknown): Date | null => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (isBlank(value)) return null;
  const raw = `${value}`.trim().toLowerCase();

  // Replace month names with numbers
  const replaced = raw.replace(/([a-zàâäéèêëîïôöùûüç]+)/gi, (m) => {
    const key = m.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return MONTH_MAP[key] ?? m;
  });

  // Try DD-MM or DD/MM/YYYY
  const parsed = Date.parse(replaced);
  if (!Number.isNaN(parsed)) return new Date(parsed);
  return null;
};

const splitMultiValue = (value: string | null): string[] => {
  if (!value) return [];
  return value
    .split(/\r?\n|\/|\+|;/)
    .map((s) => s.trim())
    .filter(Boolean);
};

const normalizeColis = (raw: string | null) => {
  if (!raw) return { count: null, raw: null, nonStandard: false };
  const match = raw.match(/\d+/g);
  const count = match ? Number(match[0]) : null;
  const nonStandard = !match || /palette|pal/i.test(raw);
  return { count: Number.isFinite(count) ? count : null, raw, nonStandard };
};

const normalizeIncoterm = (raw: string | null, zone: OperationZone, comment: string | null): string | null => {
  if (raw) {
    const upper = raw.trim().toUpperCase();
    if (['DDP', 'DAP', 'EXW', 'FOB', 'CIF', 'CFR'].includes(upper)) return upper;
  }
  if (zone === 'DROM') return 'DDP';
  if (comment && /affret|ubipharm/i.test(comment)) return 'EXW';
  return raw ? raw.toUpperCase() : null;
};

const detectType = (comment: string | null, bl: string[]): OperationEntry['type'] => {
  const combined = `${comment ?? ''} ${bl.join(' ')}`.toLowerCase();
  if (/dotation|don/.test(combined)) return 'dotation';
  if (/renvoi|retour/.test(combined)) return 'renvoi';
  if (/annul/.test(combined)) return 'annulee';
  return 'commande';
};

const zoneFromIle = (ile: string | null): OperationZone => {
  if (!ile) return 'AUTRE';
  const lower = ile.toLowerCase();
  if (/(guadeloupe|martinique|réunion|reunion|mayotte)/.test(lower)) return 'DROM';
  return 'AUTRE';
};

const normalizeDelai = (value: unknown): number | null => {
  const num = normalizeNumber(value);
  if (num === null) return null;
  if (num < 0 || num > 120) return null;
  return num;
};

const normalizeTracking = (value: string | null): { tracking: string | null; nonStandard: boolean } => {
  if (!value) return { tracking: null, nonStandard: false };
  const trimmed = value.trim();
  if (/^affret/i.test(trimmed)) return { tracking: trimmed, nonStandard: true };
  if (/^1g/i.test(trimmed)) return { tracking: trimmed, nonStandard: false };
  return { tracking: trimmed, nonStandard: true };
};

export type RawOperationRow = {
  'N° BL/ Commande X3'?: string;
  'N° client X3'?: string;
  'Raison Sociale'?: string;
  'Ile'?: string;
  'Adresse mail'?: string;
  'Date saisie CRM ou Sage'?: string | number | Date;
  'Date Transmission LOG'?: string | number | Date;
  'Date fin de prépa'?: string | number | Date;
  'Nombres de colis'?: string | number;
  'Date de départ SME'?: string | number | Date;
  'Numéro de suivi GEODIS'?: string;
  'Récépissé'?: string | number;
  'Délai total traitement cde by SME'?: string | number;
  'INCOTERM'?: string;
  'Montant transport Geodis'?: string | number;
  'Numéro de FA'?: string;
  'Commentaires'?: string;
};

export const normalizeOperationRow = (row: RawOperationRow): OperationEntry => {
  const blList = splitMultiValue(normalizeString(row['N° BL/ Commande X3']));
  const zone = zoneFromIle(normalizeString(row['Ile']));
  const commentaires = normalizeString(row['Commentaires']);
  const incoterm = normalizeIncoterm(normalizeString(row['INCOTERM']), zone, commentaires);
  const { tracking, nonStandard: trackingNonStandard } = normalizeTracking(normalizeString(row['Numéro de suivi GEODIS']));
  const factures = splitMultiValue(normalizeString(row['Numéro de FA']));

  const colis = normalizeColis(normalizeString(row['Nombres de colis']));
  const delai = normalizeDelai(row['Délai total traitement cde by SME']);

  const entry: OperationEntry = {
    bl: blList,
    clientCode: normalizeString(row['N° client X3']),
    clientName: normalizeString(row['Raison Sociale']),
    ile: normalizeString(row['Ile']),
    zone,
    email: normalizeString(row['Adresse mail']),
    dates: {
      saisie: parseDateLoose(row['Date saisie CRM ou Sage']),
      transmission: parseDateLoose(row['Date Transmission LOG']),
      finPrepa: parseDateLoose(row['Date fin de prépa']),
      depart: parseDateLoose(row['Date de départ SME']),
    },
    colis,
    tracking,
    reception: normalizeString(row['Récépissé']),
    delaiTotal: delai,
    incoterm,
    transportMontant: normalizeNumber(row['Montant transport Geodis']),
    factures,
    commentaires,
    flags: {
      dateSaisieMissing: !parseDateLoose(row['Date saisie CRM ou Sage']),
      dateDepartMissing: !parseDateLoose(row['Date de départ SME']),
      delaiInvalide: delai === null && !isBlank(row['Délai total traitement cde by SME']),
      colisNonStandard: colis.nonStandard,
      trackingNonStandard,
      facturesMultiples: factures.length > 1,
    },
    type: detectType(commentaires, blList),
  };

  return entry;
};

export const normalizeSheet = (rows: RawOperationRow[]): OperationEntry[] => {
  return rows.map(normalizeOperationRow);
};
