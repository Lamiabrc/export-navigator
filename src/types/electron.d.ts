export interface ExcelUpdatePayload {
  rows: Record<string, unknown>[];
  filePath: string | null;
  updatedAt: string;
}

export interface ExcelErrorPayload {
  message: string;
}

export interface ElectronAPI {
  platform: NodeJS.Platform;
  isElectron: boolean;
  watchExcelFile: (filePath: string) => Promise<{ ok?: true; error?: string; rowsCount?: number }>;
  stopExcelWatch: () => Promise<{ ok: true }>;
  readExcelOnce: () => Promise<{ ok?: true; error?: string; rowsCount?: number }>;
  onExcelUpdate: (callback: (payload: ExcelUpdatePayload) => void) => void;
  onExcelError: (callback: (payload: ExcelErrorPayload) => void) => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
