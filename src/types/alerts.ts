export type AlertSeverity = 'info' | 'warning' | 'blocker';

export interface Alert {
  id: string;
  code: string;
  severity: AlertSeverity;
  message: string;
  suggestion?: string;
}
