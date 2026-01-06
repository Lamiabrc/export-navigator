export const TERRITORY_PCT: Record<
  string,
  {
    x: number;
    y: number;
    label?: string;
  }
> = {
  // Coords exprimées en pourcentage du container (0-100) calibrées sur le fond world-map.svg
  HUB_FR: { x: 52.5, y: 25.0, label: "Hub" },
  GP: { x: 30.0, y: 46.5, label: "Guadeloupe" },
  MQ: { x: 30.4, y: 48.5, label: "Martinique" },
  GF: { x: 34.8, y: 57.5, label: "Guyane" },
  RE: { x: 71.8, y: 69.5, label: "Réunion" },
  YT: { x: 68.8, y: 64.2, label: "Mayotte" },
};
