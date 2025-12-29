import type { OperationEntry, OperationZone } from "./types/operations";

const MONTH_MAP: Record<string, string> = {
  janv: "01",
  jan: "01",
  fevr: "02",
  févr: "02",
  fev: "02",
  fév: "02",
  mars: "03",
  mar: "03",
  avr: "04",
  avril: "04",
  mai: "05",
  juin: "06",
  juil: "07",
  juill: "07",
  aout: "08",
  août: "08",
  sept: "09",
  sep: "09",
  octobre: "10",
  oct: "10",
  nov: "11",
  novembre: "11",
  dec: "12",
  déc: "12",
  decembre: "12",
  décembre: "12",
};

const isBlank = (v: unknown) => {
  if (v === null || v === undefined) return true;
  const s = `${v}`.trim();
  if (!s) return true;
  if (s === "/" || s === "#N/A") return true;
  return false;
};

const normalizeString = (v: unknown): string | null => {
  if (isBlank(v)) return null;
  const s = `${v}`.trim();
  return s ? s : null;
};

const normalizeNumber = (v: unknown): number | null => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (isBlank(v)) return null;

  const raw = `${v}`.trim();

  // Ex: "1 234,56 €" -> "1234.56"
  const cleaned = raw
    .replace(/\s/g, "")
    .replace(/[€$£]/g, "")
    .replace(/,/g, ".")
    .replace(/[^0-9.-]/g, "");

  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
};

const excelSerialToDate = (serial: number): Date | null => {
  // Excel 1900 date system: day 1 = 1900-01-01, but there is the Excel leap-year bug
  // Using the common JS conversion base 1899-12-30 works well for most spreadsheets.
  if (!Number.isFinite(serial)) return null;
  if (serial < 1) return null;
  const ms = Math.round((serial - 25569) * 86400 * 1000); // 25569 = days between 1899-12-30 and 1970-01-01
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? null : d;
};

const parseDateLoose = (value: unknown): Date | null => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (isBlank(value)) return null;

  // Excel serial date (Graph peut renvoyer number)
  if (typeof value === "number") {
    // filtre simple: les dates modernes Excel sont souvent > 40000 (≈ 2009+)
    // mais on accepte dès 20000 (≈ 1954+) pour être large
    if (value >= 20000 && value <= 90000) return excelSerialToDate(value);
    // si c’est un timestamp ms
    if (value > 10_000_000_000) {
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? null : d;
    }
  }

  const raw = `${value}`.trim().toLowerCase();

  // Remplace les mois FR par numéro
  const replaced = raw.replace(/([a-zàâäéèêëîïôöùûüç]+)/gi, (m) => {
    const key = m
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    return MONTH_MAP[key] ?? m;
  });

  // Essai Date.parse
  const parsed = Date.parse(replaced);
  if (!Number.isNaN(parsed)) return new Date(parsed);

  // Format DD/MM/YY ou DD-MM-YY simple
  const m = replaced.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2}|\d{4})$/);
  if (m) {
    const dd = Number(m[1]);
    const mm = Number(m[2]);
    let yy = Number(m[3]);
    if (yy < 100) yy += 2000;
    const d = new Date(Date.UTC(yy, mm - 1, dd));
    return Number.isNaN(d.getTime()) ? null : d;
  }

  return null;
};

const splitMultiValue = (value: string | null): string[] => {
  if (!value) return [];
  const items = value
    .split(/\r?\n|\/|\+|;|,/)
    .map((s) => s.trim())
    .filter(Boolean);

  // dédoublonnage conservant l’ordre
  const seen = new Set<string>();
  const out: string[] = [];
  for (const it of items) {
    const k = it.toUpperCase();
    if (!seen.has(k)) {
      seen.add(k);
      out.push(it);
    }
  }
  return out;
};

const normalizeColis = (raw: string | null) => {
  if (!raw) return { count: null as number | null, raw: null as string | null, nonStandard: false };

  const lower = raw.toLowerCase();
  const nums = raw.match(/\d+/g)?.map((n) => Number(n)).filter(Number.isFinite) ?? [];
  const count = nums.length ? nums[0] : null;

  const nonStandard =
    nums.length === 0 ||
    nums.length > 1 ||
    /palette|pal\b|plt\b|demi[- ]?palette|palett/i.test(lower);

  return { count: count !== null && Number.isFinite(count) ? count : null, raw, nonStandard };
};

const normalizeDelai = (value: unknown): number | null => {
  const num = normalizeNumber(value);
  if (num === null) return null;
  // garde-fou (120 était parfois trop strict si tu as des cas “bloqués”)
  if (num < 0 || num > 365) return null;
  return num;
};

const normalizeTracking = (
  value: string | null,
): { tracking: string | null; nonStandard: boolean } => {
  if (!value) return { tracking: null, nonStandard: false };

  const list = splitMultiValue(value);
  if (list.length === 0) return { tracking: null, nonStandard: false };

  // Cas "affrètement"
  if (/^affret/i.test(list[0])) {
    return { tracking: list.join(" / "), nonStandard: true };
  }

  // On préfère un tracking GEODIS typique "1G..."
  const geodis = list.find((t) => /^1g/i.test(t));
  const chosen = geodis ?? list[0];

  const nonStandard = list.length > 1 || !/^1g/i.test(chosen);
  return { tracking: chosen, nonStandard };
};

const normalizeIncoterm = (raw: string | null, zone: OperationZone, comment: string | null): string | null => {
  const c = (comment ?? "").toLowerCase();

  // si le commentaire explicite un incoterm, on le respecte
  if (/\bddp\b/i.test(c)) return "DDP";
  if (/\bdap\b/i.test(c)) return "DAP";
  if (/\bexw\b/i.test(c)) return "EXW";

  if (raw) {
    const upper = raw.trim().toUpperCase();
    const allowed = new Set([
      "EXW",
      "FCA",
      "FAS",
      "FOB",
      "CFR",
      "CIF",
      "CPT",
      "CIP",
      "DAP",
      "DPU",
      "DDP",
    ]);
    if (allowed.has(upper)) return upper;
  }

  // Heuristiques “terrain”
  // - DROM : par défaut beaucoup d’expéditions sont traitées en "DDP" dans les process (transport + taxes gérées),
  //   mais si tu sais que chez toi c’est plutôt DAP, change ici.
  if (zone === "DROM") return "DDP";

  // - Affrètement / Ubipharm : souvent enlèvement / gestion tiers → EXW (dans ton process actuel)
  if (comment && /affret|affr[eè]t|ubipharm/i.test(comment)) return "EXW";

  return raw ? raw.trim().toUpperCase() : null;
};

const detectType = (comment: string | null, bl: string[]): OperationEntry["type"] => {
  const combined = `${comment ?? ""} ${bl.join(" ")}`.toLowerCase();
  if (/dotation|don/.test(combined)) return "dotation";
  if (/renvoi|retour/.test(combined)) return "renvoi";
  if (/annul/.test(combined)) return "annulee";
  return "commande";
};

const zoneFromIle = (ile: string | null): OperationZone => {
  if (!ile) return "AUTRE";
  const lower = ile.toLowerCase();

  // ✅ DROM : ajoute Guyane + variantes
  if (
    /(guadeloupe|martinique|guyane|réunion|reunion|mayotte|971\b|972\b|973\b|974\b|976\b)/.test(lower)
  ) {
    return "DROM";
  }

  return "AUTRE";
};

export type RawOperationRow = {
  "N° BL/ Commande X3"?: string;
  "N° client X3"?: string;
  "Raison Sociale"?: string;
  "Ile"?: string;
  "Adresse mail"?: string;
  "Date saisie CRM ou Sage"?: string | number | Date;
  "Date Transmission LOG"?: string | number | Date;
  "Date fin de prépa"?: string | number | Date;
  "Nombres de colis"?: string | number;
  "Date de départ SME"?: string | number | Date;
  "Numéro de suivi GEODIS"?: string;
  "Récépissé"?: string | number;
  "Délai total traitement cde by SME"?: string | number;
  "INCOTERM"?: string;
  "Montant transport Geodis"?: string | number;
  "Numéro de FA"?: string;
  "Commentaires"?: string;
};

export const normalizeOperationRow = (row: RawOperationRow): OperationEntry => {
  const blList = splitMultiValue(normalizeString(row["N° BL/ Commande X3"]));
  const ile = normalizeString(row["Ile"]);
  const zone = zoneFromIle(ile);

  const commentaires = normalizeString(row["Commentaires"]);
  const incoterm = normalizeIncoterm(normalizeString(row["INCOTERM"]), zone, commentaires);

  const { tracking, nonStandard: trackingNonStandard } = normalizeTracking(
    normalizeString(row["Numéro de suivi GEODIS"]),
  );

  const factures = splitMultiValue(normalizeString(row["Numéro de FA"]));

  const colis = normalizeColis(normalizeString(row["Nombres de colis"]));
  const delai = normalizeDelai(row["Délai total traitement cde by SME"]);

  const dateSaisie = parseDateLoose(row["Date saisie CRM ou Sage"]);
  const dateDepart = parseDateLoose(row["Date de départ SME"]);

  const entry: OperationEntry = {
    bl: blList,
    clientCode: normalizeString(row["N° client X3"]),
    clientName: normalizeString(row["Raison Sociale"]),
    ile,
    zone,
    email: normalizeString(row["Adresse mail"]),
    dates: {
      saisie: dateSaisie,
      transmission: parseDateLoose(row["Date Transmission LOG"]),
      finPrepa: parseDateLoose(row["Date fin de prépa"]),
      depart: dateDepart,
    },
    colis,
    tracking,
    reception: normalizeString(row["Récépissé"]),
    delaiTotal: delai,
    incoterm,
    transportMontant: normalizeNumber(row["Montant transport Geodis"]),
    factures,
    commentaires,
    flags: {
      dateSaisieMissing: !dateSaisie,
      dateDepartMissing: !dateDepart,
      delaiInvalide: delai === null && !isBlank(row["Délai total traitement cde by SME"]),
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
