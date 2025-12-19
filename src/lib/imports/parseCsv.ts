export type CsvRow = Record<string, string>;

export interface CsvParseResult {
  headers: string[];
  rows: CsvRow[];
}

const detectDelimiter = (headerLine: string): string => {
  if (headerLine.includes(';')) return ';';
  if (headerLine.includes('\t')) return '\t';
  return ','; // fallback
};

const splitLine = (line: string, delimiter: string): string[] => {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === delimiter && !inQuotes) {
      cells.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
};

export const parseCsv = (content: string): CsvParseResult => {
  const lines = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (!lines.length) {
    return { headers: [], rows: [] };
  }

  const delimiter = detectDelimiter(lines[0]);
  const headers = splitLine(lines[0], delimiter).map((h) => h || `col_${Math.random().toString(36).slice(2, 6)}`);

  const rows = lines.slice(1).map((line) => {
    const values = splitLine(line, delimiter);
    const row: CsvRow = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx]?.trim() ?? '';
    });
    return row;
  });

  return { headers, rows };
};
