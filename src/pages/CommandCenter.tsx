import * as React from "react";
import { Link } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  RefreshCw,
  Scale,
  Search,
  Sparkles,
  MapPin,
  Hash,
  Target,
  Download,
  BarChart3,
} from "lucide-react";
import { OnboardingPrefsModal } from "@/components/OnboardingPrefsModal";
import { useAuth } from "@/contexts/AuthContext";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { supabase, SUPABASE_ENV_OK } from "@/integrations/supabase/client";
import { isMissingTableError } from "@/domain/calc";

// ✅ Graphiques (Recharts)
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";

type Territory = { code: string; name: string };

type UserPrefs = {
  countries: string[];
  hsCodes: string[];
  direction?: "export_fr" | "import_fr" | "both";
  hsMode?: string | null;
  source: "mpl_user_prefs" | "mpl_watch_prefs" | "default";
};

const DEFAULT_TERRITORIES: Territory[] = [
  { code: "FR", name: "France" },
  { code: "DE", name: "Allemagne" },
  { code: "ES", name: "Espagne" },
  { code: "US", name: "Etats-Unis" },
  { code: "CN", name: "Chine" },
  { code: "GB", name: "Royaume-Uni" },
  { code: "CH", name: "Suisse" },
];

const DEFAULT_HS_CODES = [
  "61151010",
  "62129000",
  "63079010",
  "63079098",
  "64039993",
  "64041990",
  "64069050",
  "64069090",
  "90211010",
  "90211090",
  "96180000",
  "3824999699",
  "61099090",
  "48239085",
];

type SelectedCell = { territory: string; hs: string } | null;

const PREF_SOURCE_LABEL: Record<UserPrefs["source"], string> = {
  mpl_user_prefs: "Profil export",
  mpl_watch_prefs: "Veille",
  default: "Par defaut",
};

function safeLocalStorageGet(key: string) {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function normalizeCountryCode(code: string) {
  return (code || "").trim().toUpperCase();
}

function normalizeHsList(list: unknown) {
  if (!Array.isArray(list)) return [];
  const cleaned = list
    .map((v) => String(v || "").replace(/[^0-9]/g, ""))
    .filter(Boolean);
  return Array.from(new Set(cleaned)).slice(0, 20);
}

function readPrefs(): UserPrefs {
  const parse = (key: "mpl_user_prefs" | "mpl_watch_prefs"): UserPrefs | null => {
    const raw = safeLocalStorageGet(key);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as any;
      const countries = Array.isArray(parsed?.countries)
        ? Array.from(new Set(parsed.countries.map(normalizeCountryCode))).filter(Boolean)
        : [];
      const hsCodes = normalizeHsList(parsed?.hsCodes);
      const direction = parsed?.direction as UserPrefs["direction"];
      const hsMode = parsed?.hsMode ?? null;
      return { countries, hsCodes, direction, hsMode, source: key };
    } catch {
      return null;
    }
  };

  const fromUser = parse("mpl_user_prefs");
  if (fromUser) return fromUser;
  const fromWatch = parse("mpl_watch_prefs");
  if (fromWatch) return fromWatch;
  return { countries: [], hsCodes: [], direction: "both", hsMode: null, source: "default" };
}

function territoryLabel(code: string) {
  const upper = normalizeCountryCode(code);
  const known = DEFAULT_TERRITORIES.find((t) => t.code === upper)?.name;
  if (known) return known;
  try {
    const dn = new Intl.DisplayNames(["fr"], { type: "region" });
    return dn.of(upper) || upper;
  } catch {
    return upper;
  }
}

function buildTerritory(code: string): Territory {
  const upper = normalizeCountryCode(code);
  return { code: upper, name: territoryLabel(upper) };
}

function normalizeHS(v: any) {
  return String(v ?? "").trim().replace(/[^\d]/g, "");
}

function pretty(v: any) {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function KVPairs({ row }: { row: Record<string, any> }) {
  const entries = Object.entries(row || {});
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
      {entries.map(([k, v]) => (
        <div key={k} className="flex items-start gap-2">
          <div className="min-w-[140px] text-muted-foreground">{k}</div>
          <div className="break-all text-foreground">{pretty(v)}</div>
        </div>
      ))}
    </div>
  );
}

function firstExistingKey(obj: any, candidates: string[]) {
  if (!obj) return null;
  const keys = new Set(Object.keys(obj));
  for (const c of candidates) if (keys.has(c)) return c;
  return null;
}

function isPermissionError(e: any) {
  const msg = String(e?.message || "").toLowerCase();
  const code = String(e?.code || "").toUpperCase();
  return (
    code === "42501" ||
    msg.includes("permission") ||
    msg.includes("row level security") ||
    msg.includes("rls") ||
    msg.includes("not allowed")
  );
}

/**
 * ✅ On lit 1 ligne pour "deviner" les colonnes réelles
 * => évite les erreurs en cascade si la table n'existe pas / RLS
 */
async function pickFirstWorkingTable(tables: string[]) {
  const errors: any[] = [];
  for (const t of tables) {
    try {
      const res = await supabase.from(t).select("*").limit(1);
      if (res.error) throw res.error;
      const sample = (res.data || [])[0] ?? null;
      return { table: t, sample };
    } catch (e: any) {
      errors.push({ table: t, error: e });
      if (isPermissionError(e)) break;
    }
  }
  const first = errors[0]?.error || new Error("Aucune table accessible");
  throw first;
}

function percentFormat(raw: any) {
  if (raw === null || raw === undefined || raw === "") return null;

  const n = Number(raw);
  if (!Number.isFinite(n)) return String(raw);

  // Heuristique : si stocké en décimal (0.025) => 2.5%
  const v = n > 0 && n <= 1 ? n * 100 : n;

  const rounded = Math.round(v * 100) / 100;
  return `${rounded}%`;
}

function extractDutyRateFromRow(row: any) {
  const v =
    row?.duty_rate ??
    row?.duty_pct ??
    row?.tariff_rate ??
    row?.customs_duty_rate ??
    row?.ad_valorem_rate ??
    row?.rate ??
    row?.duty ??
    null;

  return percentFormat(v);
}

// Repères indicatifs (fallback si table VAT vide)
function vatFallbackForTerritory(code: string) {
  if (code === "FR") return "TVA 20% (repere)";
  if (code === "DE") return "TVA 19% (repere)";
  if (code === "ES") return "TVA 21% (repere)";
  if (code === "GB") return "TVA 20% (repere)";
  if (code === "US") return "Sales tax selon Etat (repere)";
  return "TVA locale (repere)";
}

function hslVar(v: string) {
  return `hsl(var(--${v}))`;
}

function downloadTextFile(filename: string, content: string) {
  try {
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch {
    // noop
  }
}

export default function ControlTower() {
  const { user } = useAuth();
  const { variables, setVariable, refreshNow } = useGlobalFilters();

  const [prefs, setPrefs] = React.useState<UserPrefs>(() => readPrefs());
  const [prefsOpen, setPrefsOpen] = React.useState(false);

  React.useEffect(() => {
    setPrefs(readPrefs());
  }, []);

  const refreshPrefs = React.useCallback(() => {
    setPrefs(readPrefs());
  }, []);

  const directionLabel: Record<NonNullable<UserPrefs["direction"]>, string> = {
    export_fr: "Export France → Monde",
    import_fr: "Import Monde → France",
    both: "Import & Export",
  };

  const hasPrefs = prefs.countries.length > 0 || prefs.hsCodes.length > 0;
  const activeTerritory = variables.territory_code ? normalizeCountryCode(String(variables.territory_code)) : null;

  const effectiveTerritories = React.useMemo(() => {
    if (activeTerritory) return [buildTerritory(activeTerritory)];
    if (prefs.countries.length) return prefs.countries.map(buildTerritory);
    return DEFAULT_TERRITORIES;
  }, [activeTerritory, prefs.countries]);

  const baseHsCodes = React.useMemo(() => {
    const list = prefs.hsCodes.length ? prefs.hsCodes : DEFAULT_HS_CODES;
    return Array.from(new Set(list.map((v) => String(v || "").trim()).filter(Boolean)));
  }, [prefs.hsCodes]);

  const territoryCodes = React.useMemo(() => effectiveTerritories.map((t) => t.code), [effectiveTerritories]);
  const territoryKey = territoryCodes.join("|");
  const hsKey = baseHsCodes.join("|");

  const lastAppliedPrefsKey = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!prefs.countries.length) return;
    if (variables.territory_code) return;
    if (lastAppliedPrefsKey.current === territoryKey) return;

    setVariable("territory_code", prefs.countries[0]);
    refreshNow();
    lastAppliedPrefsKey.current = territoryKey;
  }, [prefs.countries, refreshNow, setVariable, territoryKey, variables.territory_code]);

  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [warning, setWarning] = React.useState<string | null>(null);

  const [search, setSearch] = React.useState("");
  const [selected, setSelected] = React.useState<SelectedCell>(null);

  // Data
  const [dutyMeta, setDutyMeta] = React.useState<{ table: string; hsCol: string | null; territoryCol: string | null } | null>(null);
  const [vatMeta, setVatMeta] = React.useState<{ table: string; territoryCol: string | null } | null>(null);
  const [taxMeta, setTaxMeta] = React.useState<{ table: string; territoryCol: string | null } | null>(null);

  const [dutyRows, setDutyRows] = React.useState<any[]>([]);
  const [vatRows, setVatRows] = React.useState<any[]>([]);
  const [taxRows, setTaxRows] = React.useState<any[]>([]);

  const refreshNonceRef = React.useRef(0);
  const [refreshNonce, setRefreshNonce] = React.useState(0);

  const filteredHs = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return baseHsCodes;
    return baseHsCodes.filter((h) => h.toLowerCase().includes(q));
  }, [baseHsCodes, search]);

  const dutyMap = React.useMemo(() => {
    // dutyMap[territory][hsKey] = rows[]
    const map = new Map<string, Map<string, any[]>>();
    for (const t of effectiveTerritories) map.set(t.code, new Map());

    const hsCol = dutyMeta?.hsCol || "";
    const hsLen =
      hsCol.toLowerCase().includes("hs4") ? 4 :
      hsCol.toLowerCase().includes("hs6") ? 6 :
      hsCol.toLowerCase().includes("hs8") ? 8 :
      hsCol.toLowerCase().includes("hs10") ? 10 : 0;

    const tCol = dutyMeta?.territoryCol;

    for (const row of dutyRows) {
      if (!tCol) continue;
      const terr = String(row?.[tCol] ?? "").trim();
      if (!map.has(terr)) continue;

      const rawHs = normalizeHS(
        row?.[dutyMeta?.hsCol as any] ??
        row?.hs_code ??
        row?.hs ??
        row?.hs6 ??
        row?.hs8 ??
        row?.hs10 ??
        row?.hs4
      );

      if (!rawHs) continue;
      const key = hsLen ? rawHs.slice(0, hsLen) : rawHs;
      const terrMap = map.get(terr)!;
      if (!terrMap.has(key)) terrMap.set(key, []);
      terrMap.get(key)!.push(row);
    }

    return { map, hsLen };
  }, [effectiveTerritories, dutyRows, dutyMeta]);

  const vatByTerritory = React.useMemo(() => {
    const tCol = vatMeta?.territoryCol;
    const m = new Map<string, any[]>();
    for (const t of effectiveTerritories) m.set(t.code, []);
    for (const row of vatRows) {
      if (!tCol) continue;
      const terr = String(row?.[tCol] ?? "").trim();
      if (!m.has(terr)) continue;
      m.get(terr)!.push(row);
    }
    return m;
  }, [effectiveTerritories, vatRows, vatMeta]);

  const extraCountByTerritory = React.useMemo(() => {
    const tCol = taxMeta?.territoryCol;
    const m = new Map<string, number>();
    for (const t of effectiveTerritories) m.set(t.code, 0);
    for (const row of taxRows) {
      if (!tCol) continue;
      const terr = String(row?.[tCol] ?? "").trim();
      if (!m.has(terr)) continue;
      m.set(terr, (m.get(terr) || 0) + 1);
    }
    return m;
  }, [effectiveTerritories, taxRows, taxMeta]);

  const selectedDetails = React.useMemo(() => {
    if (!selected) return null;
    const { territory, hs } = selected;

    const hsKeyLocal = dutyMap.hsLen ? normalizeHS(hs).slice(0, dutyMap.hsLen) : normalizeHS(hs);
    const terrMap = dutyMap.map.get(territory);
    const duties = terrMap?.get(hsKeyLocal) || [];
    const vat = vatByTerritory.get(territory) || [];
    const extra = taxRows.filter((r) => String(r?.[taxMeta?.territoryCol as any] ?? "").trim() === territory);

    return { duties, vat, extra };
  }, [selected, dutyMap, vatByTerritory, taxRows, taxMeta]);

  // ✅ Aperçu cockpit (stats + data chart)
  const cockpit = React.useMemo(() => {
    const byTerr = effectiveTerritories.map((t) => {
      let dutyHits = 0;

      for (const hs of filteredHs) {
        const hsKeyLocal = dutyMap.hsLen ? normalizeHS(hs).slice(0, dutyMap.hsLen) : normalizeHS(hs);
        const dutyList = dutyMap.map.get(t.code)?.get(hsKeyLocal) || [];
        if (dutyList.length) dutyHits += 1;
      }

      const vatRowsCount = (vatByTerritory.get(t.code) || []).length;
      const extraRules = extraCountByTerritory.get(t.code) || 0;

      return {
        code: t.code,
        name: t.name,
        dutyHits,
        vatRows: vatRowsCount,
        extraRules,
      };
    });

    const totalCells = filteredHs.length * effectiveTerritories.length;
    const dutyCells = byTerr.reduce((s, r) => s + r.dutyHits, 0);
    const dutyCoveragePct = totalCells > 0 ? Math.round((dutyCells / totalCells) * 1000) / 10 : 0;

    const territoriesWithVat = byTerr.filter((r) => r.vatRows > 0).length;
    const extraRulesTotal = byTerr.reduce((s, r) => s + r.extraRules, 0);

    return { byTerr, totalCells, dutyCells, dutyCoveragePct, territoriesWithVat, extraRulesTotal };
  }, [effectiveTerritories, filteredHs, dutyMap, vatByTerritory, extraCountByTerritory]);

  const exportMatrixCsv = React.useCallback(() => {
    const terrs = effectiveTerritories.map((t) => t.code);
    const head = ["HS", ...terrs.flatMap((t) => [`${t} Droits`, `${t} TVA`, `${t} Extra`])];

    const rows: string[] = [];
    rows.push(head.join(";"));

    for (const hs of filteredHs) {
      const line: string[] = [hs];

      for (const t of terrs) {
        const hsKeyLocal = dutyMap.hsLen ? normalizeHS(hs).slice(0, dutyMap.hsLen) : normalizeHS(hs);
        const dutyList = dutyMap.map.get(t)?.get(hsKeyLocal) || [];
        const dutyRate = dutyList.length ? extractDutyRateFromRow(dutyList[0]) : null;

        const vatList = vatByTerritory.get(t) || [];
        const vatDisplay = vatList.length ? "voir table" : vatFallbackForTerritory(t);

        const extraCount = extraCountByTerritory.get(t) || 0;

        line.push(dutyRate || "—");
        line.push(vatDisplay);
        line.push(String(extraCount));
      }

      rows.push(line.join(";"));
    }

    const filename = `mpl_control_tower_${new Date().toISOString().slice(0, 10)}.csv`;
    downloadTextFile(filename, rows.join("\n"));
  }, [effectiveTerritories, filteredHs, dutyMap, vatByTerritory, extraCountByTerritory]);

  React.useEffect(() => {
    let alive = true;

    const load = async () => {
      setIsLoading(true);
      setError(null);
      setWarning(null);
      setSelected(null);

      try {
        if (!SUPABASE_ENV_OK) throw new Error("Connexion base indisponible.");

        // 1) Droits / Tarifs douaniers (si dispo)
        let dutyTable = "";
        let dutySample: any = null;

        try {
          const picked = await pickFirstWorkingTable([
            "customs_duty_rates",
            "duty_rates",
            "tariff_rates",
            "tariff_rates_v2",
          ]);
          dutyTable = picked.table;
          dutySample = picked.sample;
        } catch (e: any) {
          if (isMissingTableError(e)) {
            setWarning((p) => (p ? `${p}\nDroits de douane indisponibles (mode demo).` : "Droits de douane indisponibles (mode demo)."));
          } else {
            throw e;
          }
        }

        let territoryColDuty: string | null = null;
        let hsColDuty: string | null = null;

        if (dutyTable && dutySample) {
          territoryColDuty = firstExistingKey(dutySample, ["territory_code", "country_code", "destination", "zone", "country", "market", "territory"]);
          hsColDuty = firstExistingKey(dutySample, ["hs_code", "hs", "hs6", "hs8", "hs10", "hs_code10", "hs_code_10", "hs4"]);
          setDutyMeta({ table: dutyTable, territoryCol: territoryColDuty, hsCol: hsColDuty });

          if (!territoryColDuty || !hsColDuty) {
            setWarning((p) =>
              p
                ? `${p}\nStructure droits incomplete (champs requis manquants).`
                : `Structure droits incomplete (champs requis manquants).`
            );
          } else {
            const hsColLower = hsColDuty.toLowerCase();
            const hsLen =
              hsColLower.includes("hs4") ? 4 :
              hsColLower.includes("hs6") ? 6 :
              hsColLower.includes("hs8") ? 8 :
              hsColLower.includes("hs10") ? 10 : 0;

            const normalizedHs = baseHsCodes.map(normalizeHS).filter(Boolean);
            const hsFilter = hsLen
              ? Array.from(new Set(normalizedHs.map((h) => h.slice(0, hsLen))))
              : normalizedHs;

            const terrFilter = territoryCodes;

            const res = await (supabase
              .from(dutyTable)
              .select("*")
              .in(hsColDuty, hsFilter)
              .in(territoryColDuty, terrFilter)
              .limit(10000) as any);

            if (res.error) throw res.error;
            if (!alive) return;
            setDutyRows(res.data || []);
          }
        } else {
          setDutyMeta(null);
          setDutyRows([]);
        }

        // 2) VAT rates (si dispo)
        try {
          const pickedVat = await pickFirstWorkingTable(["vat_rates", "vat_rates_v2"]);
          const vatTable = pickedVat.table;
          const sample = pickedVat.sample;
          const terrCol = firstExistingKey(sample, ["territory_code", "country_code", "destination", "zone", "country", "market", "territory"]);
          setVatMeta({ table: vatTable, territoryCol: terrCol });

          if (terrCol) {
            const terrFilter = territoryCodes;
            const res = await (supabase
              .from(vatTable)
              .select("*")
              .in(terrCol, terrFilter)
              .limit(10000) as any);

            if (res.error) throw res.error;
            if (!alive) return;
            setVatRows(res.data || []);
          } else {
            setVatRows([]);
          }
        } catch (e: any) {
          if (isMissingTableError(e)) {
            setWarning((p) => (p ? `${p}\nTaux TVA indisponibles (mode demo).` : "Taux TVA indisponibles (mode demo)."));
            setVatMeta(null);
            setVatRows([]);
          } else {
            setWarning((p) => (p ? `${p}\nTVA indisponible` : `TVA indisponible`));
            setVatMeta(null);
            setVatRows([]);
          }
        }

        // 3) Taxes / règles additionnelles
        try {
          const pickedTax = await pickFirstWorkingTable(["tax_rules_extra"]);
          const taxTable = pickedTax.table;
          const sample = pickedTax.sample;
          const terrCol = firstExistingKey(sample, ["territory_code", "country_code", "destination", "zone", "country", "market", "territory"]);
          setTaxMeta({ table: taxTable, territoryCol: terrCol });

          if (terrCol) {
            const terrFilter = territoryCodes;
            const res = await (supabase
              .from(taxTable)
              .select("*")
              .in(terrCol, terrFilter)
              .limit(10000) as any);

            if (res.error) throw res.error;
            if (!alive) return;
            setTaxRows(res.data || []);
          } else {
            setTaxRows([]);
          }
        } catch (e: any) {
          if (isMissingTableError(e)) {
            setWarning((p) => (p ? `${p}\nRegles additionnelles indisponibles (mode demo).` : "Regles additionnelles indisponibles (mode demo)."));
          } else {
            setWarning((p) => (p ? `${p}\nRegles additionnelles indisponibles` : `Regles additionnelles indisponibles`));
          }
          setTaxMeta(null);
          setTaxRows([]);
        }
      } catch (e: any) {
        console.error(e);
        if (!alive) return;
        setError(e?.message || "Erreur chargement dashboard taxes/droits");
      } finally {
        if (alive) setIsLoading(false);
      }
    };

    void load();
    return () => {
      alive = false;
    };
  }, [hsKey, refreshNonce, territoryKey, baseHsCodes, territoryCodes]);

  return (
    <AppLayout wrapperClassName="control-tower-world">
      <div className="space-y-6">
        {/* Hero */}
        <section className="rounded-3xl border border-border bg-card/95 p-6 shadow-xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl space-y-2">
              <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Tour de controle export</p>
              <h1 className="text-3xl md:text-4xl font-semibold font-display text-foreground">
                Votre cockpit export, regle sur vos marches prioritaires.
              </h1>
              <p className="text-sm text-muted-foreground">
                Produits et destinations preconfigures pour decider vite : droits, TVA, regles additionnelles et signaux utiles.
              </p>

              {activeTerritory ? (
                <div className="mt-2">
                  <Badge variant="secondary">
                    Focus : {territoryLabel(activeTerritory)} ({activeTerritory})
                  </Badge>
                </div>
              ) : null}

              {/* ✅ micro-KPI */}
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant="outline">
                  Couverture droits : <b className="ml-1">{cockpit.dutyCoveragePct}%</b>
                </Badge>
                <Badge variant="outline">
                  Cellules droits : <b className="ml-1">{cockpit.dutyCells}/{cockpit.totalCells}</b>
                </Badge>
                <Badge variant="outline">
                  Territoires VAT : <b className="ml-1">{cockpit.territoriesWithVat}/{effectiveTerritories.length}</b>
                </Badge>
                <Badge variant="outline">
                  Regles extra : <b className="ml-1">{cockpit.extraRulesTotal}</b>
                </Badge>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setPrefsOpen(true)} className="gap-2">
                <Sparkles className="h-4 w-4" />
                {hasPrefs ? "Ajuster mon profil" : "Configurer mon profil"}
              </Button>

              <Link to="/app/simulator">
                <Button variant="secondary" className="gap-2">
                  <Scale className="h-4 w-4" />
                  Simuler un cout
                </Button>
              </Link>

              <Link to="/app/centre-veille/reglementation">
                <Button variant="outline" className="gap-2">
                  <Search className="h-4 w-4" />
                  Veille
                </Button>
              </Link>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-border bg-white/80 p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <MapPin className="h-4 w-4" />
                Destinations prioritaires
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {prefs.countries.length ? (
                  prefs.countries.map((code) => (
                    <Badge key={code} variant="secondary">
                      {territoryLabel(code)} ({normalizeCountryCode(code)})
                    </Badge>
                  ))
                ) : (
                  <span className="text-xs text-muted-foreground">Aucune destination definie.</span>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-white/80 p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Hash className="h-4 w-4" />
                Produits (HS)
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {prefs.hsCodes.length ? (
                  prefs.hsCodes.map((hs) => (
                    <Badge key={hs} variant="outline">
                      HS {hs}
                    </Badge>
                  ))
                ) : (
                  <span className="text-xs text-muted-foreground">Aucun HS : conditions generales.</span>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-white/80 p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Target className="h-4 w-4" />
                Mode & source
              </div>
              <div className="mt-2 text-sm font-semibold">{directionLabel[prefs.direction ?? "both"]}</div>
              <div className="mt-1 text-xs text-muted-foreground">Source : {PREF_SOURCE_LABEL[prefs.source]}</div>
              <div className="mt-2 text-xs text-muted-foreground">
                {prefs.hsCodes.length ? "Lecture detaillee par produit." : "Lecture generale multi-produits."}
              </div>
            </div>
          </div>

          {!hasPrefs ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              Ajoute au moins une destination et un HS pour personnaliser le cockpit.
            </div>
          ) : null}
        </section>

        {/* Messages */}
        {error ? (
          <Card className="border-red-200">
            <CardContent className="pt-6 text-sm text-foreground whitespace-pre-line">
              {error}
            </CardContent>
          </Card>
        ) : warning ? (
          <Card className="border-amber-300 bg-amber-50">
            <CardContent className="pt-6 text-sm text-foreground whitespace-pre-line">
              {warning}
            </CardContent>
          </Card>
        ) : null}

        {/* ✅ Aperçu cockpit */}
        <Card className="border-muted">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Apercu cockpit
            </CardTitle>
            <CardDescription>
              Lecture rapide par territoire : couverture droits (nb HS couverts), volume VAT (rows), regles extra.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-2xl border bg-background p-4">
                <div className="text-xs text-muted-foreground">HS consideres</div>
                <div className="mt-1 text-2xl font-semibold">{filteredHs.length}</div>
                <div className="text-xs text-muted-foreground">sur {baseHsCodes.length} (filtre actif)</div>
              </div>

              <div className="rounded-2xl border bg-background p-4">
                <div className="text-xs text-muted-foreground">Territoires</div>
                <div className="mt-1 text-2xl font-semibold">{effectiveTerritories.length}</div>
                <div className="text-xs text-muted-foreground">profil / focus</div>
              </div>

              <div className="rounded-2xl border bg-background p-4">
                <div className="text-xs text-muted-foreground">Couverture droits</div>
                <div className="mt-1 text-2xl font-semibold">{cockpit.dutyCoveragePct}%</div>
                <div className="mt-2 h-2 w-full rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full"
                    style={{
                      width: `${Math.max(0, Math.min(100, cockpit.dutyCoveragePct))}%`,
                      background: hslVar("primary"),
                    }}
                  />
                </div>
              </div>

              <div className="rounded-2xl border bg-background p-4">
                <div className="text-xs text-muted-foreground">Regles extra</div>
                <div className="mt-1 text-2xl font-semibold">{cockpit.extraRulesTotal}</div>
                <div className="text-xs text-muted-foreground">total (tous territoires)</div>
              </div>
            </div>

            <div className="rounded-2xl border bg-background p-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-sm font-medium">Vue comparee par territoire</div>
                <div className="text-xs text-muted-foreground">
                  {isLoading ? "Chargement des donnees…" : "OK"}
                </div>
              </div>

              <div className="h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={cockpit.byTerr} margin={{ top: 12, right: 12, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="code" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar name="Droits (HS couverts)" dataKey="dutyHits" fill={hslVar("primary")} radius={[8, 8, 0, 0]} />
                    <Bar name="VAT (rows)" dataKey="vatRows" fill={hslVar("secondary")} radius={[8, 8, 0, 0]} />
                    <Bar name="Extra (regles)" dataKey="extraRules" fill={hslVar("accent")} radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-2 text-xs text-muted-foreground">
                Astuce : si VAT est vide, on affiche un repere indicatif. Les droits peuvent matcher par prefixe (hs4/hs6/hs8/hs10) si besoin.
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Meta (tech/debug utile) */}
        <div className="flex flex-wrap gap-2 items-center">
          <Badge variant="secondary">HS: {baseHsCodes.length}</Badge>
          <Badge variant="secondary">Territoires: {effectiveTerritories.length}</Badge>
          <Badge variant="outline">
            Droits table: <span className="ml-1 font-semibold">{dutyMeta?.table || "—"}</span>
          </Badge>
          <Badge variant="outline">
            VAT table: <span className="ml-1 font-semibold">{vatMeta?.table || "—"}</span>
          </Badge>
          <Badge variant="outline">
            Extra table: <span className="ml-1 font-semibold">{taxMeta?.table || "—"}</span>
          </Badge>
          <Badge variant="outline">
            Droits rows: <span className="ml-1 font-semibold">{dutyRows.length}</span>
          </Badge>
          <Badge variant="outline">
            VAT rows: <span className="ml-1 font-semibold">{vatRows.length}</span>
          </Badge>
          <Badge variant="outline">
            Extra rows: <span className="ml-1 font-semibold">{taxRows.length}</span>
          </Badge>
        </div>

        {/* Ops header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Tableau operationnel</p>
            <h2 className="text-2xl font-semibold flex items-center gap-2">
              <Scale className="h-6 w-6" />
              Droits, TVA & regles — recapitulatif par destination / HS
            </h2>
            <p className="text-sm text-muted-foreground">
              Vue synthese des taxes et contraintes selon les territoires et vos produits.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => {
                refreshNonceRef.current += 1;
                setRefreshNonce(refreshNonceRef.current);
              }}
              disabled={isLoading}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              Actualiser
            </Button>

            <Button
              variant="secondary"
              onClick={exportMatrixCsv}
              className="gap-2"
              disabled={filteredHs.length === 0 || effectiveTerritories.length === 0}
              title="Exporter la matrice (HS x Territoires) en CSV"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* Search */}
        <Card>
          <CardHeader>
            <CardTitle>Filtre HS</CardTitle>
            <CardDescription>Filtre le tableau par HS code.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <div className="relative w-full sm:w-[420px]">
              <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un HS code…"
                className="pl-9"
              />
            </div>
            <Badge variant="secondary">{filteredHs.length} / {baseHsCodes.length}</Badge>
            <div className="text-xs text-muted-foreground sm:ml-auto">
              Clique une case pour voir les details (Droits/VAT/Extra).
            </div>
          </CardContent>
        </Card>

        {/* Matrix */}
        <Card>
          <CardHeader>
            <CardTitle>Matrice taxes</CardTitle>
            <CardDescription>
              Lignes = HS codes. Colonnes = territoires. <br />
              Chaque cellule : Droits (si trouves) • TVA (table ou repere) • Extra (nb regles).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-auto border rounded-md">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 sticky top-0">
                  <tr className="[&>th]:text-left [&>th]:px-3 [&>th]:py-2">
                    <th className="min-w-[120px]">HS code</th>
                    {effectiveTerritories.map((t) => (
                      <th key={t.code} className="min-w-[200px]">
                        <div className="font-medium">{t.code}</div>
                        <div className="text-xs text-muted-foreground">{t.name}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredHs.map((hs) => {
                    const hsKeyLocal = dutyMap.hsLen ? normalizeHS(hs).slice(0, dutyMap.hsLen) : normalizeHS(hs);

                    return (
                      <tr key={hs} className="border-t">
                        <td className="px-3 py-2 whitespace-nowrap">
                          <Badge variant="outline">{hs}</Badge>
                        </td>

                        {effectiveTerritories.map((t) => {
                          const terrMap = dutyMap.map.get(t.code);
                          const dutyList = terrMap?.get(hsKeyLocal) || [];
                          const dutyRate = dutyList.length ? extractDutyRateFromRow(dutyList[0]) : null;

                          const vatList = vatByTerritory.get(t.code) || [];
                          const vatDisplay = vatList.length ? "voir table" : vatFallbackForTerritory(t.code);

                          const extraCount = extraCountByTerritory.get(t.code) || 0;

                          const isSelected = selected?.territory === t.code && selected?.hs === hs;

                          return (
                            <td
                              key={`${hs}-${t.code}`}
                              className={`px-3 py-2 align-top cursor-pointer hover:bg-muted/30 ${
                                isSelected ? "bg-muted/30" : ""
                              }`}
                              onClick={() => setSelected({ territory: t.code, hs })}
                            >
                              <div className="flex flex-wrap gap-2">
                                <Badge variant={dutyRate ? "secondary" : "outline"}>
                                  Droits: {dutyRate || "—"}
                                </Badge>
                                <Badge variant="outline">TVA: {vatDisplay}</Badge>
                                <Badge variant="outline">Extra: {extraCount}</Badge>
                              </div>
                              {dutyList.length ? (
                                <div className="text-xs text-muted-foreground mt-2">
                                  {dutyList.length} regle(s) droits
                                </div>
                              ) : (
                                <div className="text-xs text-muted-foreground mt-2">
                                  aucune regle droits
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="text-xs text-muted-foreground mt-2">
              NB : si ta table droits est en <b>hs4/hs6</b>, la page match automatiquement par prefixe.
            </div>
          </CardContent>
        </Card>

        {/* Details */}
        <Card className="border-muted">
          <CardHeader>
            <CardTitle className="text-base">
              Details — {selected ? `${selected.territory} - HS ${selected.hs}` : "clique une cellule"}
            </CardTitle>
            <CardDescription>
              Details bruts des tables (utile pour valider les champs exacts).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selected ? (
              <div className="text-sm text-muted-foreground">
                Clique une cellule du tableau pour afficher les lignes Droits / VAT / Extra correspondantes.
              </div>
            ) : (
              <>
                {/* Droits */}
                <Card className="border-muted">
                  <CardHeader>
                    <CardTitle className="text-base">Droits / Tarifs</CardTitle>
                    <CardDescription>
                      Source: <code className="text-xs">{dutyMeta?.table || "—"}</code>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {!selectedDetails?.duties?.length ? (
                      <div className="text-sm text-muted-foreground">Aucune ligne droits trouvee.</div>
                    ) : (
                      selectedDetails.duties.slice(0, 20).map((row: any, idx: number) => (
                        <Card key={row.id ?? `${idx}`} className="border-muted">
                          <CardContent className="pt-4">
                            <KVPairs row={row} />
                          </CardContent>
                        </Card>
                      ))
                    )}
                    {selectedDetails?.duties?.length > 20 ? (
                      <div className="text-xs text-muted-foreground">Affichage limite a 20 lignes.</div>
                    ) : null}
                  </CardContent>
                </Card>

                {/* VAT */}
                <Card className="border-muted">
                  <CardHeader>
                    <CardTitle className="text-base">TVA</CardTitle>
                    <CardDescription>
                      Source: <code className="text-xs">{vatMeta?.table || "fallback repere"}</code>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {!selectedDetails?.vat?.length ? (
                      <div className="text-sm text-muted-foreground">
                        Aucune ligne VAT trouvee dans la table. Repere : <b>{vatFallbackForTerritory(selected.territory)}</b>
                      </div>
                    ) : (
                      selectedDetails.vat.slice(0, 10).map((row: any, idx: number) => (
                        <Card key={row.id ?? `${idx}`} className="border-muted">
                          <CardContent className="pt-4">
                            <KVPairs row={row} />
                          </CardContent>
                        </Card>
                      ))
                    )}
                    {selectedDetails?.vat?.length > 10 ? (
                      <div className="text-xs text-muted-foreground">Affichage limite a 10 lignes.</div>
                    ) : null}
                  </CardContent>
                </Card>

                {/* Extra */}
                <Card className="border-muted">
                  <CardHeader>
                    <CardTitle className="text-base">Taxes / regles additionnelles</CardTitle>
                    <CardDescription>
                      Source: <code className="text-xs">{taxMeta?.table || "—"}</code>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {!selectedDetails?.extra?.length ? (
                      <div className="text-sm text-muted-foreground">Aucune regle additionnelle trouvee.</div>
                    ) : (
                      selectedDetails.extra.slice(0, 10).map((row: any, idx: number) => (
                        <Card key={row.id ?? `${idx}`} className="border-muted">
                          <CardContent className="pt-4">
                            <KVPairs row={row} />
                          </CardContent>
                        </Card>
                      ))
                    )}
                    {selectedDetails?.extra?.length > 10 ? (
                      <div className="text-xs text-muted-foreground">Affichage limite a 10 lignes.</div>
                    ) : null}
                  </CardContent>
                </Card>
              </>
            )}
          </CardContent>
        </Card>

        <OnboardingPrefsModal
          open={prefsOpen}
          onOpenChange={setPrefsOpen}
          email={user?.email ?? null}
          onSaved={refreshPrefs}
        />
      </div>
    </AppLayout>
  );
}
