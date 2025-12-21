import type { ReferenceDocument } from '@/types/referenceDocument';

export const builtInDocuments: ReferenceDocument[] = [
  {
    id: 'octroi-mer-mayotte-2019',
    title: 'Octroi de Mer Mayotte - Délibération 2019',
    category: 'octroi_mer',
    description: 'Délibération 2019.00342 fixant les taux d\'octroi de mer applicables à Mayotte.',
    territory: 'Mayotte',
    year: 2019,
    fileUrl: '/documents/references/octroi-mer-mayotte-2019.pdf',
    fileName: 'octroi-mer-mayotte-2019.pdf',
    tags: ['octroi de mer', 'mayotte', 'drom', 'taux'],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    isBuiltIn: true
  },
  {
    id: 'cdu-code-douanes-union',
    title: 'Code des Douanes de l\'Union (CDU)',
    category: 'douane',
    description: 'Règlement (UE) n° 952/2013 établissant le code des douanes de l\'Union. Texte de référence pour toutes les opérations douanières dans l\'UE.',
    territory: 'UE',
    year: 2013,
    fileUrl: '/documents/references/code-douanes-union-cdu.pdf',
    fileName: 'code-douanes-union-cdu.pdf',
    sourceUrl: 'https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX%3A32013R0952',
    tags: ['cdu', 'douane', 'union européenne', 'réglementation'],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    isBuiltIn: true
  },
  {
    id: 'deb-2019',
    title: 'DEB - Déclaration d\'Échanges de Biens 2019',
    category: 'douane',
    description: 'Guide de la Déclaration d\'Échanges de Biens pour les échanges intracommunautaires. Obligations déclaratives pour les flux UE.',
    territory: 'UE',
    year: 2019,
    fileUrl: '/documents/references/deb-2019.pdf',
    fileName: 'deb-2019.pdf',
    tags: ['deb', 'intracommunautaire', 'ue', 'déclaration'],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    isBuiltIn: true
  },
  {
    id: 'guide-declaration-douane',
    title: 'Guide Nouvelle Déclaration en Douane',
    category: 'douane',
    description: 'Guide explicatif sur la nouvelle déclaration en douane. Procédures et formulaires pour les opérations import/export.',
    territory: 'France',
    fileUrl: '/documents/references/guide-declaration-douane.pdf',
    fileName: 'guide-declaration-douane.pdf',
    tags: ['déclaration', 'douane', 'guide', 'import', 'export'],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    isBuiltIn: true
  },
  {
    id: 'mdr-etablissements-sante',
    title: 'MDR et Établissements de Santé',
    category: 'reglementation',
    description: 'Règlement sur les Dispositifs Médicaux (MDR) et ses implications pour les établissements de santé. Marquage CE et conformité.',
    territory: 'UE',
    fileUrl: '/documents/references/mdr-etablissements-sante.pdf',
    fileName: 'mdr-etablissements-sante.pdf',
    tags: ['mdr', 'dispositifs médicaux', 'ce', 'santé', 'réglementation'],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    isBuiltIn: true
  },
  {
    id: 'octroi-mer-martinique-2015',
    title: 'Octroi de Mer Martinique 2015',
    category: 'octroi_mer',
    description: 'Taux d\'octroi de mer et octroi de mer régional applicables en Martinique (archive 2015).',
    territory: 'Martinique',
    year: 2015,
    fileUrl: '/documents/references/octroi-mer-martinique-2015.zip',
    fileName: 'octroi-mer-martinique-2015.zip',
    tags: ['octroi de mer', 'martinique', 'drom', 'taux'],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    isBuiltIn: true
  },
  {
    id: 'octroi-mer-reunion-2015',
    title: 'Octroi de Mer Réunion 2015',
    category: 'octroi_mer',
    description: 'Délibération du 16/11/2015 fixant les taux d\'octroi de mer à La Réunion.',
    territory: 'Réunion',
    year: 2015,
    fileUrl: '/documents/references/octroi-mer-reunion-2015.pdf',
    fileName: 'octroi-mer-reunion-2015.pdf',
    tags: ['octroi de mer', 'réunion', 'drom', 'taux'],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    isBuiltIn: true
  },
  {
    id: 'octroi-mer-reunion',
    title: 'Octroi de Mer Réunion - Document complémentaire',
    category: 'octroi_mer',
    description: 'Documentation complémentaire sur l\'octroi de mer à La Réunion.',
    territory: 'Réunion',
    fileUrl: '/documents/references/octroi-mer-reunion.pdf',
    fileName: 'octroi-mer-reunion.pdf',
    tags: ['octroi de mer', 'réunion', 'drom'],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    isBuiltIn: true
  },
  {
    id: 'octroi-mer-guadeloupe-2020',
    title: 'Octroi de Mer Guadeloupe 2020',
    category: 'octroi_mer',
    description: 'Taux d\'octroi de mer applicables en Guadeloupe pour l\'année 2020.',
    territory: 'Guadeloupe',
    year: 2020,
    fileUrl: '/documents/references/octroi-mer-guadeloupe-2020.pdf',
    fileName: 'octroi-mer-guadeloupe-2020.pdf',
    tags: ['octroi de mer', 'guadeloupe', 'drom', 'taux'],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    isBuiltIn: true
  },
  {
    id: 'octroi-mer-guyane-2019',
    title: 'Octroi de Mer Guyane 2019',
    category: 'octroi_mer',
    description: 'Tableau des taux d\'octroi de mer applicables en Guyane (format tableur).',
    territory: 'Guyane',
    year: 2019,
    fileUrl: '/documents/references/octroi-mer-guyane-2019.ods',
    fileName: 'octroi-mer-guyane-2019.ods',
    tags: ['octroi de mer', 'guyane', 'drom', 'taux'],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    isBuiltIn: true
  }
];

export function generateDocumentId(): string {
  return `doc-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}
