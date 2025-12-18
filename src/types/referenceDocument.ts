export type DocumentCategory = 
  | 'octroi_mer'
  | 'douane'
  | 'tva'
  | 'reglementation'
  | 'transport'
  | 'autre';

export interface ReferenceDocument {
  id: string;
  title: string;
  category: DocumentCategory;
  description: string;
  territory?: string; // e.g., Martinique, Réunion, UE
  year?: number;
  fileUrl?: string;
  fileName?: string;
  sourceUrl?: string;
  textContent?: string; // For direct text entries
  tags: string[];
  createdAt: string;
  updatedAt: string;
  isBuiltIn: boolean; // Cannot delete built-in documents
}

export const categoryLabels: Record<DocumentCategory, string> = {
  octroi_mer: 'Octroi de Mer',
  douane: 'Douane & Import',
  tva: 'TVA',
  reglementation: 'Réglementation',
  transport: 'Transport',
  autre: 'Autre'
};

export const categoryColors: Record<DocumentCategory, string> = {
  octroi_mer: 'badge-drom',
  douane: 'badge-hors-ue',
  tva: 'badge-ue',
  reglementation: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  transport: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  autre: 'badge-neutral'
};
