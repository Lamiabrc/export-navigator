import { FLOWS_KEY } from '@/lib/constants/storage';
import { mockFlows } from '@/data/mockData';
import type { Flow, Destination, Incoterm, TransportMode, FlowStatus, ChecklistStatus } from '@/types';

const parseNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
};

const parseString = (row: Record<string, unknown>, keys: string[], fallback = ''): string => {
  for (const key of keys) {
    const val = row[key];
    if (typeof val === 'string' && val.trim() !== '') return val.trim();
  }
  return fallback;
};

const parseDate = (value: unknown): string => {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' && value.trim()) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return new Date().toISOString();
};

const normalizeIncoterm = (value: string): Incoterm => {
  const upper = value.toUpperCase();
  if (upper === 'EXW' || upper === 'FCA' || upper === 'DAP' || upper === 'DDP') return upper as Incoterm;
  return 'DAP';
};

const normalizeTransport = (value: string): TransportMode => {
  const map: Record<string, TransportMode> = {
    ROUTIER: 'Routier',
    MARITIME: 'Maritime',
    AERIEN: 'Aerien',
    EXPRESS: 'Express',
    FERROVIAIRE: 'Ferroviaire',
  };
  const key = value.toUpperCase();
  return map[key] ?? 'Routier';
};

const normalizeDestination = (value: string): Destination => {
  const known: Destination[] = ['Guadeloupe', 'Martinique', 'Guyane', 'Reunion', 'Mayotte', 'Belgique', 'Espagne', 'Luxembourg', 'Suisse'];
  const found = known.find((d) => d.toLowerCase() === value.toLowerCase());
  return found ?? 'Belgique';
};

const normalizeStatus = (value: string): FlowStatus => {
  const normalized = value.toLowerCase();
  if (normalized === 'termine') return 'termine';
  if (normalized === 'bloque') return 'bloque';
  if (normalized === 'non_demarre') return 'non_demarre';
  return 'en_cours';
};

const normalizeChecklist = (value: string): ChecklistStatus => {
  const normalized = value.toLowerCase();
  if (normalized === 'ok') return 'ok';
  if (normalized === 'na' || normalized === 'n/a') return 'na';
  if (normalized === 'bloque') return 'bloque';
  return 'a_faire';
};

export const mapExcelRowToFlow = (row: Record<string, unknown>): Flow | null => {
  const flowCode = parseString(row, ['flow_code', 'Flow Code', 'Code', 'Référence flux']);
  if (!flowCode) {
    return null;
  }

  const incoterm = normalizeIncoterm(parseString(row, ['Incoterm'], 'DAP'));
  const transportMode = normalizeTransport(parseString(row, ['Transport', 'Mode'], 'Routier'));
  const destination = normalizeDestination(parseString(row, ['Destination', 'Pays'], 'Belgique'));
  const createdAt = parseDate(row['Créé le'] ?? row['created_at'] ?? row['Created At']);
  const updatedAt = parseDate(row['Mis à jour'] ?? row['updated_at'] ?? row['Updated At'] ?? createdAt);

  return {
    id: crypto.randomUUID(),
    flow_code: flowCode,
    created_at: createdAt,
    updated_at: updatedAt,
    created_by: parseString(row, ['Créé par', 'created_by', 'Auteur'], 'import_excel'),
    client_name: parseString(row, ['Client', 'client_name'], 'Client Excel'),
    destination,
    zone: destination === 'Belgique' ? 'UE' : destination === 'Suisse' ? 'Hors UE' : 'DROM',
    incoterm,
    incoterm_place: parseString(row, ['Lieu Incoterm', 'incoterm_place', 'Lieu'], ''),
    transport_mode: transportMode,
    weight: parseNumber(row['Poids'] ?? row['weight']),
    product_type: (parseString(row, ['Produit', 'product_type']).toLowerCase() === 'lppr' ? 'lppr' : 'standard') as Flow['product_type'],
    margin: parseNumber(row['Marge'] ?? row['margin'] ?? undefined, undefined),
    departure_date: parseDate(row['Départ'] ?? row['departure_date'] ?? row['Departure']),
    delivery_date: parseDate(row['Livraison'] ?? row['delivery_date'] ?? row['Delivery']),
    goods_value: parseNumber(row['Valeur'] ?? row['goods_value'] ?? row['Value'], 0),
    cost_transport: parseNumber(row['Transport'] ?? row['cost_transport'], 0),
    cost_customs_clearance: parseNumber(row['Douane'] ?? row['cost_customs_clearance'], 0),
    cost_duties: parseNumber(row['Droits'] ?? row['cost_duties'], 0),
    cost_import_vat: parseNumber(row['TVA import'] ?? row['cost_import_vat'], 0),
    cost_octroi_mer: parseNumber(row['OM'] ?? row['cost_octroi_mer'], 0),
    cost_octroi_mer_regional: parseNumber(row['OMR'] ?? row['cost_octroi_mer_regional'], 0),
    cost_other: parseNumber(row['Autres'] ?? row['cost_other'], 0),
    prix_revient_estime: parseNumber(row['PR Estimé'] ?? row['prix_revient_estime'], undefined),
    prix_vente_conseille: parseNumber(row['PVC'] ?? row['prix_vente_conseille'], undefined),
    charges_fournisseur_estimees: parseNumber(row['Charges Fournisseur'] ?? row['charges_fournisseur_estimees'], undefined),
    charges_client_estimees: parseNumber(row['Charges Client'] ?? row['charges_client_estimees'], undefined),
    status_order: normalizeStatus(parseString(row, ['Statut commande', 'status_order'], 'en_cours')),
    status_incoterm_validated: normalizeStatus(parseString(row, ['Statut incoterm', 'status_incoterm_validated'], 'en_cours')),
    status_export: normalizeStatus(parseString(row, ['Statut export', 'status_export'], 'en_cours')),
    status_transport: normalizeStatus(parseString(row, ['Statut transport', 'status_transport'], 'en_cours')),
    status_customs: normalizeStatus(parseString(row, ['Statut douane', 'status_customs'], 'en_cours')),
    status_invoicing: normalizeStatus(parseString(row, ['Statut facturation', 'status_invoicing'], 'en_cours')),
    chk_invoice: normalizeChecklist(parseString(row, ['Facture', 'chk_invoice'], 'a_faire')),
    chk_packing_list: normalizeChecklist(parseString(row, ['Packing list', 'chk_packing_list'], 'a_faire')),
    chk_transport_doc: normalizeChecklist(parseString(row, ['Doc transport', 'chk_transport_doc'], 'a_faire')),
    chk_certificate_origin: normalizeChecklist(parseString(row, ['Certificat', 'chk_certificate_origin'], 'a_faire')),
    chk_insurance: normalizeChecklist(parseString(row, ['Assurance', 'chk_insurance'], 'a_faire')),
    comment: parseString(row, ['Commentaire', 'comment'], ''),
    risk_level: undefined,
  };
};

export const mergeFlowsByCode = (existing: Flow[], incoming: Flow[]) => {
  const map = new Map<string, Flow>();
  let added = 0;
  let updated = 0;

  existing.forEach((flow) => map.set(flow.flow_code, flow));

  incoming.forEach((flow) => {
    if (map.has(flow.flow_code)) {
      updated += 1;
    } else {
      added += 1;
    }
    map.set(flow.flow_code, flow);
  });

  return { merged: Array.from(map.values()), added, updated };
};

export const loadStoredFlows = (): Flow[] => {
  const stored = localStorage.getItem(FLOWS_KEY);
  if (stored) {
    try {
      return JSON.parse(stored) as Flow[];
    } catch {
      return mockFlows;
    }
  }
  return mockFlows;
};

export const persistFlows = (flows: Flow[]) => {
  localStorage.setItem(FLOWS_KEY, JSON.stringify(flows));
  window.dispatchEvent(new Event('flows-updated'));
};
