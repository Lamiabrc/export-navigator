export const TERRITORY_PCT: Record<
  string,
  {
    x: number;
    y: number;
    label?: string;
  }
> = {
  /**
   * Coords en % (0-100) calibrées sur le fond world-map.svg (1010 x 666)
   * IMPORTANT : HUB_FR a été recadré pour tomber sur la France métropolitaine (pas au-dessus).
   */
  HUB_FR: { x: 53.5, y: 30.8, label: "Métropole" },

  // DROM (déjà calibrés)
  GP: { x: 30.0, y: 46.5, label: "Guadeloupe" },
  MQ: { x: 30.4, y: 48.5, label: "Martinique" },
  GF: { x: 34.8, y: 57.5, label: "Guyane" },
  RE: { x: 71.8, y: 69.5, label: "Réunion" },
  YT: { x: 68.8, y: 64.2, label: "Mayotte" },

  /**
   * COM / autres (positions approximées mais cohérentes avec le SVG)
   * Si tu veux les ajuster au pixel près : change x/y de +/- 0.3 et refresh.
   */
  SPM: { x: 37.7, y: 25.8, label: "Saint-Pierre-et-Miquelon" },
  BL: { x: 29.7, y: 45.2, label: "Saint-Barthélemy" },
  MF: { x: 29.6, y: 45.1, label: "Saint-Martin" },
};
