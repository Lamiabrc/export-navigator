import * as React from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { supabase, DEMO_MODE, SUPABASE_ENV_OK } from "@/integrations/supabase/client";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { isMissingTableError } from "@/domain/calc/validators";
import { getAlerts, postPdf } from "@/lib/leadMagnetApi";
import { OnboardingPrefsModal } from "@/components/OnboardingPrefsModal";
import { useToast } from "@/hooks/use-toast";
import { EmptyState } from "@/components/EmptyState";
import { formatDateTimeFr } from "@/lib/formatters";
import { demoAlerts, getDemoTradeFlows } from "@/lib/demoData";
import worldMap from "@/assets/world-map.svg";

type CountryRow = {
  code_iso2: string;
  label: string | null;
  lat: number | null;
  lon: number | null;
};

type TradeFlowRow = {
  flow_date: string;
  hs_code: string | null;
  reporter_country: string | null;
  partner_country: string | null;
  flow_type: "export" | "import" | null;
  value_eur: number | null;
  volume_kg: number | null;
  source: string | null;
};

type BriefResponse = {
  estimate: { duty: number; taxes: number; total: number; currency: string };
  documents: string[];
  risks: Array<{ title: string; level: "low" | "medium" | "high"; message: string }>;
  complianceScore: number;
  updatedAt: string;
  confidence: "low" | "medium" | "high";
  sources: string[];
};

type SvgMeta = {
  width: number;
  height: number;
  geo: { left: number; top: number; right: number; bottom: number };
};

const FALLBACK_META: SvgMeta = {
  width: 1009.6727,
  height: 665.963,
  geo: { left: -169.110266, top: 83.600842, right: 190.486279, bottom: -58.508473 },
};

const COUNTRY_FALLBACKS: CountryRow[] = [
  { code_iso2: "FR", label: "France", lat: 46.2, lon: 2.2 },
  { code_iso2: "US", label: "United States", lat: 39.5, lon: -98.35 },
  { code_iso2: "CN", label: "China", lat: 35.86, lon: 104.19 },
  { code_iso2: "DE", label: "Germany", lat: 51.16, lon: 10.45 },
  { code_iso2: "NL", label: "Netherlands", lat: 52.1, lon: 5.3 },
  { code_iso2: "IT", label: "Italy", lat: 41.87, lon: 12.57 },
  { code_iso2: "ES", label: "Spain", lat: 40.46, lon: -3.75 },
  { code_iso2: "GB", label: "United Kingdom", lat: 55.37, lon: -3.43 },
  { code_iso2: "BE", label: "Belgium", lat: 50.64, lon: 4.67 },
  { code_iso2: "CH", label: "Switzerland", lat: 46.82, lon: 8.23 },
  { code_iso2: "AE", label: "UAE", lat: 23.42, lon: 53.84 },
  { code_iso2: "JP", label: "Japan", lat: 36.2, lon: 138.25 },
  { code_iso2: "IN", label: "India", lat: 20.59, lon: 78.96 },
  { code_iso2: "CA", label: "Canada", lat: 56.13, lon: -106.35 },
  { code_iso2: "MX", label: "Mexico", lat: 23.63, lon: -102.55 },
  { code_iso2: "BR", label: "Brazil", lat: -14.24, lon: -51.93 },
];

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const rad = (deg: number) => (deg * Math.PI) / 180;

async function loadSvgMeta(url: string): Promise<SvgMeta> {
  const txt = await fetch(url).then((r) => r.text());
  const w = Number((txt.match(/width="([\d.]+)/)?.[1] ?? FALLBACK_META.width).toString());
  const h = Number((txt.match(/height="([\d.]+)/)?.[1] ?? FALLBACK_META.height).toString());
  const geoStr = txt.match(/mapsvg:geoViewBox="([^"]+)"/)?.[1];
  if (!geoStr) return { ...FALLBACK_META, width: w || FALLBACK_META.width, height: h || FALLBACK_META.height };
  const parts = geoStr.split(/\s+/).map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) {
    return { ...FALLBACK_META, width: w || FALLBACK_META.width, height: h || FALLBACK_META.height };
  }
  const [left, top, right, bottom] = parts;
  return { width: w || FALLBACK_META.width, height: h || FALLBACK_META.height, geo: { left, top, right, bottom } };
}

function projectMercator(lat: number, lon: number, meta: SvgMeta) {
  const { width, height, geo } = meta;
  const x = ((lon - geo.left) / (geo.right - geo.left)) * width;
  const latClamped = clamp(lat, -85, 85);
  const merc = (la: number) => Math.log(Math.tan(Math.PI / 4 + rad(la) / 2));
  const mercTop = merc(geo.top);
  const mercBottom = merc(geo.bottom);
  const y = ((mercTop - merc(latClamped)) / (mercTop - mercBottom)) * height;
  return { x, y };
}

function addDays(d: string, delta: number) {
  const base = new Date(d);
  const next = new Date(base.getTime() + delta * 24 * 60 * 60 * 1000);
  const y = next.getFullYear();
  const m = `${next.getMonth() + 1}`.padStart(2, "0");
  const day = `${next.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function daysBetween(from: string, to: string) {
  const a = new Date(from).getTime();
  const b = new Date(to).getTime();
  return Math.max(1, Math.round((b - a) / (24 * 60 * 60 * 1000)) + 1);
}

function formatMoney(n: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

function formatCurrency(n: number, currency: string) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
}

function groupSum(items: TradeFlowRow[], key: (r: TradeFlowRow) => string) {
  const map = new Map<string, number>();
  for (const r of items) {
    const k = key(r);
    const v = Number(r.value_eur || 0);
    map.set(k, (map.get(k) || 0) + v);
  }
  return Array.from(map.entries()).map(([code, value]) => ({ code, value }));
}

function buildArc(sx: number, sy: number, ex: number, ey: number) {
  const mx = (sx + ex) / 2;
  const my = (sy + ey) / 2;
  const dx = ex - sx;
  const dy = ey - sy;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const bend = clamp(len * 0.14, 14, 120);
  const cx = mx + nx * bend;
  const cy = my + ny * bend;
  return `M ${sx} ${sy} Q ${cx} ${cy} ${ex} ${ey}`;
}

const ALL = "__all__";

export default function ControlTower() {
  const navigate = useNavigate();
  const { resolvedRange, refreshToken } = useGlobalFilters();
  const { toast } = useToast();

  const [svgMeta, setSvgMeta] = React.useState<SvgMeta>(FALLBACK_META);
  const [countries, setCountries] = React.useState<CountryRow[]>(COUNTRY_FALLBACKS);
  const [flows, setFlows] = React.useState<TradeFlowRow[]>([]);
  const [prevFlows, setPrevFlows] = React.useState<TradeFlowRow[]>([]);
  const [hsCode, setHsCode] = React.useState("");
  const [market, setMarket] = React.useState(ALL);
  const [loading, setLoading] = React.useState(false);
  const [missingTables, setMissingTables] = React.useState(false);
  const [hovered, setHovered] = React.useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = React.useState<{ x: number; y: number } | null>(null);
  const [alerts, setAlerts] = React.useState<Array<{ id: string; title: string; message: string; severity: string; detectedAt?: string | null }>>([]);
  const [alertsUpdatedAt, setAlertsUpdatedAt] = React.useState<string>("");
  const [prefsOpen, setPrefsOpen] = React.useState(false);
  const [leadEmail, setLeadEmail] = React.useState<string | null>(null);
  const [downloading, setDownloading] = React.useState(false);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [drawerCountry, setDrawerCountry] = React.useState<CountryRow | null>(null);
  const [drawerHs, setDrawerHs] = React.useState("");
  const [drawerProduct, setDrawerProduct] = React.useState("");
  const [drawerValue, setDrawerValue] = React.useState("10000");
  const [drawerCurrency, setDrawerCurrency] = React.useState("EUR");
  const [drawerIncoterm, setDrawerIncoterm] = React.useState("DAP");
  const [drawerMode, setDrawerMode] = React.useState("sea");
  const [drawerResult, setDrawerResult] = React.useState<BriefResponse | null>(null);
  const [drawerLoading, setDrawerLoading] = React.useState(false);
  const [drawerError, setDrawerError] = React.useState<string | null>(null);
  const [contactOpen, setContactOpen] = React.useState(false);
  const [contactCompany, setContactCompany] = React.useState("");
  const [contactEmail, setContactEmail] = React.useState("");
  const [contactMessage, setContactMessage] = React.useState("");
  const [contactSending, setContactSending] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    loadSvgMeta(worldMap)
      .then((m) => {
        if (alive) setSvgMeta(m);
      })
      .catch(() => null);
    return () => {
      alive = false;
    };
  }, []);

  React.useEffect(() => {
    const email = localStorage.getItem("mpl_lead_email");
    setLeadEmail(email);
    const prefs = localStorage.getItem("mpl_user_prefs");
    if (email && !prefs) {
      setPrefsOpen(true);
    }
  }, []);

  const downloadLastReport = async () => {
    const raw = localStorage.getItem("mpl_last_simulation");
    if (!raw) {
      toast({ title: "Aucune simulation recente", description: "Lance un calcul sur la page d'accueil." });
      return;
    }
    try {
      setDownloading(true);
      const parsed = JSON.parse(raw) as { payload?: any; result?: any };
      const pdfBlob = await postPdf({
        title: "Rapport de contrÃ´le export",
        destination: parsed.payload?.destination,
        incoterm: parsed.payload?.incoterm,
        value: parsed.payload?.value,
        currency: parsed.payload?.currency,
        result: parsed.result,
      });
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `mpl-rapport-export-${Date.now()}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast({ title: "Erreur rapport", description: err?.message || "Impossible de generer le rapport." });
    } finally {
      setDownloading(false);
    }
  };

  const requestBriefWith = async ({
    country,
    hs,
    product,
    valueInput,
    currencyInput,
    incotermInput,
    modeInput,
  }: {
    country: CountryRow | null;
    hs: string;
    product: string;
    valueInput: string;
    currencyInput: string;
    incotermInput: string;
    modeInput: string;
  }) => {
    if (!country?.code_iso2) {
      setDrawerError("Selectionne un pays de destination.");
      return;
    }
    const hsNormalized = hs.replace(/[^0-9]/g, "");
    if (!product.trim() && hsNormalized.length < 2) {
      setDrawerError("Saisis un produit ou un code HS.");
      return;
    }
    try {
      setDrawerLoading(true);
      setDrawerError(null);
      const payload = {
        hsInput: hsNormalized || undefined,
        productText: product.trim() || undefined,
        destinationIso2: country.code_iso2,
        value: Number(valueInput || 0),
        currency: currencyInput,
        incoterm: incotermInput,
        mode: modeInput,
      };
      const res = await fetch("/api/export/brief", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      }).then((r) => r.json());
      if (res.error) throw new Error(res.error);
      setDrawerResult(res as BriefResponse);
    } catch (err: any) {
      setDrawerError(err?.message || "Impossible de charger la fiche export.");
    } finally {
      setDrawerLoading(false);
    }
  };

  const openDrawer = (code: string) => {
    const upper = code.toUpperCase();
    const row = countryLookup.get(upper) || { code_iso2: upper, label: upper, lat: null, lon: null };
    setDrawerCountry(row);
    setDrawerHs(hsCode);
    setDrawerOpen(true);
    if (hsCode.trim()) {
      void requestBriefWith({
        country: row,
        hs: hsCode,
        product: drawerProduct,
        valueInput: drawerValue,
        currencyInput: drawerCurrency,
        incotermInput: drawerIncoterm,
        modeInput: drawerMode,
      });
    }
  };

  const sendContact = async () => {
    if (!contactEmail.trim()) {
      toast({ title: "Email requis", description: "Ajoute un email pour la demande." });
      return;
    }
    try {
      setContactSending(true);
      await fetch("/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: contactEmail.trim().toLowerCase(),
          offer_type: "audit",
          message: contactMessage,
          context: {
            company: contactCompany,
            country: drawerCountry?.code_iso2 || market,
            hs: drawerHs || hsCode,
            product: drawerProduct,
            estimate: drawerResult?.estimate,
          },
        }),
      });
      toast({ title: "Demande envoyee", description: "Nous revenons vers vous rapidement." });
      setContactOpen(false);
      setContactMessage("");
    } catch (err: any) {
      toast({ title: "Erreur", description: err?.message || "Impossible d'envoyer la demande." });
    } finally {
      setContactSending(false);
    }
  };

  React.useEffect(() => {
    let alive = true;
    const loadCountries = async () => {
      if (!SUPABASE_ENV_OK) return;
      try {
        const { data, error: sbError } = await supabase.from("countries").select("code_iso2,label,lat,lon").limit(400);
        if (sbError) throw sbError;
        if (!alive) return;
        const rows = (data || []) as CountryRow[];
        if (rows.length) setCountries(rows);
      } catch (err) {
        if (!alive) return;
        setCountries(COUNTRY_FALLBACKS);
      }
    };
    void loadCountries();
    return () => {
      alive = false;
    };
  }, []);

  React.useEffect(() => {
    let active = true;
    const loadFlows = async () => {
      setLoading(true);
      setMissingTables(false);
      try {
        if (DEMO_MODE) {
          if (!active) return;
          const demoFlows = getDemoTradeFlows();
          setFlows(demoFlows);
          setPrevFlows(demoFlows);
          return;
        }

        if (!SUPABASE_ENV_OK) throw new Error("Connexion base indisponible");

        const q = supabase
          .from("trade_flows")
          .select("flow_date,hs_code,reporter_country,partner_country,flow_type,value_eur,volume_kg,source")
          .gte("flow_date", resolvedRange.from)
          .lte("flow_date", resolvedRange.to)
          .limit(20000);

        if (hsCode.trim()) q.ilike("hs_code", `${hsCode.trim()}%`);
        if (market !== ALL) q.eq("partner_country", market);

        const { data, error: sbError } = await q;
        if (sbError) throw sbError;

        const days = daysBetween(resolvedRange.from, resolvedRange.to);
        const prevFrom = addDays(resolvedRange.from, -days);
        const prevTo = addDays(resolvedRange.to, -days);

        const prevQ = supabase
          .from("trade_flows")
          .select("flow_date,hs_code,reporter_country,partner_country,flow_type,value_eur,volume_kg,source")
          .gte("flow_date", prevFrom)
          .lte("flow_date", prevTo)
          .limit(20000);

        if (hsCode.trim()) prevQ.ilike("hs_code", `${hsCode.trim()}%`);
        if (market !== ALL) prevQ.eq("partner_country", market);

        const { data: prevData, error: prevErr } = await prevQ;
        if (prevErr) throw prevErr;

        if (!active) return;
        setFlows((data || []) as TradeFlowRow[]);
        setPrevFlows((prevData || []) as TradeFlowRow[]);
      } catch (err: any) {
        console.error(err);
        if (!active) return;
        if (isMissingTableError(err)) {
          setMissingTables(true);
        }
        setFlows([]);
        setPrevFlows([]);
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadFlows();
    return () => {
      active = false;
    };
  }, [resolvedRange.from, resolvedRange.to, refreshToken, hsCode, market]);

  React.useEffect(() => {
    let active = true;
    const loadAlerts = async () => {
      try {
        if (DEMO_MODE) {
          if (!active) return;
          setAlerts(
            demoAlerts.slice(0, 4).map((a) => ({
              id: a.id,
              title: a.title,
              message: a.message,
              severity: a.severity,
              detectedAt: a.detected_at,
            }))
          );
          setAlertsUpdatedAt(new Date().toISOString());
          return;
        }
        const email = localStorage.getItem("mpl_lead_email") || undefined;
        const res = await getAlerts(email);
        if (!active) return;
        setAlerts(res.alerts.slice(0, 4));
        setAlertsUpdatedAt(res.updatedAt);
      } catch {
        if (!active) return;
        setAlerts([]);
        setAlertsUpdatedAt("");
      }
    };
    void loadAlerts();
    return () => {
      active = false;
    };
  }, []);

  const frExports = React.useMemo(
    () => flows.filter((f) => f.flow_type === "export" && (f.reporter_country || "").toUpperCase() === "FR"),
    [flows]
  );

  const topDestinations = React.useMemo(() => {
    return groupSum(frExports, (r) => (r.partner_country || "NA").toUpperCase())
      .filter((r) => r.code !== "NA")
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [frExports]);

  const globalExporters = React.useMemo(() => {
    const exps = flows.filter((f) => f.flow_type === "export");
    return groupSum(exps, (r) => (r.reporter_country || "NA").toUpperCase())
      .filter((r) => r.code !== "NA")
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [flows]);

  const globalImporters = React.useMemo(() => {
    const imps = flows.filter((f) => f.flow_type === "import");
    return groupSum(imps, (r) => (r.reporter_country || "NA").toUpperCase())
      .filter((r) => r.code !== "NA")
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [flows]);

  const frRank = React.useMemo(() => {
    const idx = globalExporters.findIndex((r) => r.code === "FR");
    return idx === -1 ? null : idx + 1;
  }, [globalExporters]);

  const currentByPartner = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const r of frExports) {
      const k = (r.partner_country || "NA").toUpperCase();
      map.set(k, (map.get(k) || 0) + Number(r.value_eur || 0));
    }
    return map;
  }, [frExports]);

  const prevByPartner = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const r of prevFlows) {
      if ((r.reporter_country || "").toUpperCase() !== "FR") continue;
      if (r.flow_type !== "export") continue;
      const k = (r.partner_country || "NA").toUpperCase();
      map.set(k, (map.get(k) || 0) + Number(r.value_eur || 0));
    }
    return map;
  }, [prevFlows]);

  const watchSignals = React.useMemo(() => {
    const rows = Array.from(currentByPartner.entries()).map(([code, value]) => {
      const prev = prevByPartner.get(code) || 0;
      const delta = prev > 0 ? ((value - prev) / prev) * 100 : null;
      return { code, value, prev, delta };
    });
    return rows.sort((a, b) => (b.delta ?? -999) - (a.delta ?? -999)).slice(0, 6);
  }, [currentByPartner, prevByPartner]);

  const totalFrExport = frExports.reduce((s, r) => s + Number(r.value_eur || 0), 0);
  const marketsCount = new Set(frExports.map((r) => (r.partner_country || "").toUpperCase())).size;
  const topMarket = topDestinations[0]?.code || "—";

  const countryLookup = React.useMemo(() => {
    const map = new Map<string, CountryRow>();
    countries.forEach((c) => map.set((c.code_iso2 || "").toUpperCase(), c));
    return map;
  }, [countries]);

  const nodes = React.useMemo(() => {
    const list = [countryLookup.get("FR") || COUNTRY_FALLBACKS[0]];
    topDestinations.forEach((d) => {
      const c = countryLookup.get(d.code);
      if (c) list.push(c);
    });
    const unique = Array.from(new Map(list.map((c) => [c.code_iso2, c])).values());
    return unique
      .map((c) => {
        if (c.lat == null || c.lon == null) return null;
        const pos = projectMercator(Number(c.lat), Number(c.lon), svgMeta);
        return { ...c, x: pos.x, y: pos.y };
      })
      .filter((c): c is CountryRow & { x: number; y: number } => Boolean(c));
  }, [countryLookup, topDestinations, svgMeta]);

  const frNode = nodes.find((n) => n.code_iso2 === "FR");

  return (
    <AppLayout wrapperClassName="control-tower-world" variant="bare">
      <OnboardingPrefsModal open={prefsOpen} onOpenChange={setPrefsOpen} email={leadEmail} />
      <div className="relative">
        <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-blue-600 via-white to-red-600" />
      </div>
      <div className="space-y-8 px-6 pb-10 pt-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-blue-700">Control Tower export</p>
            <h1 className="text-3xl font-bold text-slate-900">France vers le monde</h1>
            <p className="text-sm text-slate-600">
              Choisis un HS code pour voir les pays acheteurs, les leaders mondiaux et les signaux de veille.
            </p>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[220px]">
              <label className="text-xs text-blue-700">HS code (prefix ok)</label>
              <Input
                value={hsCode}
                onChange={(e) => setHsCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 8))}
                placeholder="ex: 3004"
                className="bg-white border-slate-200 text-slate-900 placeholder:text-slate-400"
              />
            </div>

            <div className="min-w-[220px]">
              <label className="text-xs text-blue-700">Destination (filtre)</label>
              <Select value={market} onValueChange={setMarket}>
                <SelectTrigger className="bg-white border-slate-200 text-slate-900">
                  <SelectValue placeholder="Tous pays" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Tous pays</SelectItem>
                  {countries.filter((c) => c.code_iso2).map((c) => (
                    <SelectItem key={c.code_iso2} value={c.code_iso2}>
                      {c.label || c.code_iso2}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button variant="secondary" onClick={() => setHsCode("")}>
              Reset HS
            </Button>
          </div>
        </div>

        {missingTables ? (
          <EmptyState
            title="Connexion des flux requise"
            description="Initialise la base pour charger les flux trade_flows et injecter la demo. Les indicateurs s'affichent ensuite automatiquement."
            primaryAction={{ label: "Initialiser la base", to: "/resources" }}
            secondaryAction={{ label: "Voir la documentation", to: "/resources" }}
          />
        ) : (
          <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 lg:col-span-8">
            <div className="relative h-[620px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="absolute inset-0">
                <div className="absolute inset-0 bg-gradient-to-br from-white/85 via-white/75 to-blue-50/90" />
                <div className="absolute inset-0 cinematic-map-glow pointer-events-none" />
              </div>
              <div className="absolute inset-0">
                <svg viewBox={`0 0 ${svgMeta.width} ${svgMeta.height}`} className="h-full w-full">
                  <defs>
                    <filter id="softGlow" x="-40%" y="-40%" width="180%" height="180%">
                      <feGaussianBlur stdDeviation="5" result="blur" />
                      <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>

                  <image
                    href={worldMap}
                    x="0"
                    y="0"
                    width={svgMeta.width}
                    height={svgMeta.height}
                    preserveAspectRatio="xMidYMid meet"
                    opacity="0.55"
                    style={{ pointerEvents: "none" }}
                  />

                  {frNode
                    ? nodes
                        .filter((n) => n.code_iso2 !== "FR")
                        .map((node) => {
                          const d = buildArc(frNode.x, frNode.y, node.x, node.y);
                          const isActive = hovered === node.code_iso2;
                          return (
                            <path
                              key={node.code_iso2}
                              d={d}
                              fill="none"
                              stroke={isActive ? "#1d4ed8" : "#94a3b8"}
                              strokeWidth={isActive ? 2.4 : 1.2}
                              strokeOpacity={isActive ? 0.9 : 0.55}
                              filter="url(#softGlow)"
                            />
                          );
                        })
                    : null}

                  {nodes.map((node) => {
                    const active = hovered === node.code_iso2;
                    return (
                      <g key={node.code_iso2}>
                        <circle cx={node.x} cy={node.y} r={active ? 10 : 7} fill="#1d4ed8" opacity={node.code_iso2 === "FR" ? 0.9 : 0.45} />
                        <circle
                          cx={node.x}
                          cy={node.y}
                          r={active ? 5.5 : 4}
                          fill={node.code_iso2 === "FR" ? "#dc2626" : "#1e293b"}
                          opacity={0.9}
                          className="cursor-pointer"
                          onMouseEnter={(evt) => {
                            setHovered(node.code_iso2);
                            setTooltipPos({ x: evt.clientX, y: evt.clientY });
                          }}
                          onMouseMove={(evt) => setTooltipPos({ x: evt.clientX, y: evt.clientY })}
                          onMouseLeave={() => {
                            setHovered(null);
                            setTooltipPos(null);
                          }}
                          onClick={() => {
                            const next = node.code_iso2 === "FR" ? ALL : node.code_iso2;
                            setMarket(next);
                            openDrawer(node.code_iso2);
                          }}
                        />
                      </g>
                    );
                  })}
                </svg>
              </div>

              <div className="absolute left-4 top-4 flex flex-wrap gap-3">
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm">
                  <div className="text-xs text-blue-700">Export FR (periode)</div>
                  <div className="text-xl font-semibold">{formatMoney(totalFrExport)}</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm">
                  <div className="text-xs text-blue-700">Top destination</div>
                  <div className="text-xl font-semibold">{topMarket}</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm">
                  <div className="text-xs text-blue-700">Marches actifs</div>
                  <div className="text-xl font-semibold">{marketsCount || 0}</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm">
                  <div className="text-xs text-blue-700">Rang FR (exports)</div>
                  <div className="text-xl font-semibold">{frRank ? `#${frRank}` : "n/a"}</div>
                </div>
              </div>

              {loading ? (
                <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-600">
                  Chargement des flux...
                </div>
              ) : flows.length === 0 ? (
                <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-600">
                  Aucune donnee sur la periode. Importe les flux CSV pour activer la tour.
                </div>
              ) : null}

              {hovered && tooltipPos ? (
                <div
                  className="pointer-events-none fixed z-[9999] rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-xl"
                  style={{ left: tooltipPos.x + 12, top: tooltipPos.y - 30 }}
                >
                  <div className="font-semibold">{hovered}</div>
                  <div className="text-slate-500">
                    {countryLookup.get(hovered)?.label || "Pays"}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="col-span-12 lg:col-span-4 space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-blue-700 uppercase tracking-[0.25em]">Alertes de la semaine</div>
                  <div className="text-sm text-slate-500">Dernière mise à jour: {formatDateTimeFr(alertsUpdatedAt)}</div>
                </div>
                <Button size="sm" variant="outline" onClick={() => navigate("/app/centre-veille")}>
                  Voir la veille
                </Button>
              </div>
              <div className="mt-3 space-y-2 text-sm">
                {alerts.length ? (
                  alerts.map((alert) => (
                    <div key={alert.id} className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                      <div className="font-semibold text-slate-900">{alert.title}</div>
                      <div className="text-xs text-slate-600">{alert.message}</div>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-slate-500">Aucune alerte pour le moment.</div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-xs text-blue-700 uppercase tracking-[0.25em]">A faire</div>
              <div className="mt-3 space-y-2 text-sm text-slate-700">
                <div className="flex items-center justify-between">
                  <span>Saisir un HS prioritaire</span>
                  <Button size="sm" variant="outline" onClick={() => setPrefsOpen(true)}>
                    Activer
                  </Button>
                </div>
                <div className="flex items-center justify-between">
                  <span>Verifier une facture export</span>
                  <Button size="sm" variant="outline" onClick={() => navigate("/app/invoice-check")}>
                    Ouvrir
                  </Button>
                </div>
                <div className="flex items-center justify-between">
                  <span>Simuler un cout export</span>
                  <Button size="sm" variant="outline" onClick={() => navigate("/app/simulator")}>
                    Simuler
                  </Button>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-xs text-blue-700 uppercase tracking-[0.25em]">Top destinations FR</div>
              <div className="mt-3 space-y-2">
                {topDestinations.length ? (
                  topDestinations.map((r, idx) => (
                    <div key={r.code} className="flex items-center justify-between text-sm">
                      <div className="text-slate-700">
                        <span className="text-slate-400 mr-2">#{idx + 1}</span>
                        {r.code}
                      </div>
                      <div className="font-semibold text-slate-900">{formatMoney(r.value)}</div>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-slate-500">Aucune destination.</div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-xs text-blue-700 uppercase tracking-[0.25em]">Top exportateurs (monde)</div>
              <div className="mt-3 space-y-2">
                {globalExporters.length ? (
                  globalExporters.map((r, idx) => (
                    <div key={r.code} className="flex items-center justify-between text-sm">
                      <div className="text-slate-700">
                        <span className="text-slate-400 mr-2">#{idx + 1}</span>
                        {r.code}
                      </div>
                      <div className="font-semibold text-slate-900">{formatMoney(r.value)}</div>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-slate-500">Aucune donnee.</div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-xs text-blue-700 uppercase tracking-[0.25em]">Top importateurs (monde)</div>
              <div className="mt-3 space-y-2">
                {globalImporters.length ? (
                  globalImporters.map((r, idx) => (
                    <div key={r.code} className="flex items-center justify-between text-sm">
                      <div className="text-slate-700">
                        <span className="text-slate-400 mr-2">#{idx + 1}</span>
                        {r.code}
                      </div>
                      <div className="font-semibold text-slate-900">{formatMoney(r.value)}</div>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-slate-500">Aucune donnee.</div>
                )}
              </div>
            </div>
          </div>
        </div>
        )}

        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 lg:col-span-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-blue-700 uppercase tracking-[0.25em]">Veille concurrentielle</div>
                <div className="text-lg font-semibold text-slate-900">Signaux marche (France)</div>
              </div>
              <div className="text-xs text-slate-400">Comparaison vs periode precedente</div>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              {watchSignals.length ? (
                watchSignals.map((s) => (
                  <div key={s.code} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center justify-between text-sm text-slate-700">
                      <span>{s.code}</span>
                      <span className={s.delta !== null && s.delta > 0 ? "text-emerald-600" : "text-rose-600"}>
                        {s.delta === null ? "n/a" : `${s.delta.toFixed(1)}%`}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500">Valeur: {formatMoney(s.value)}</div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-slate-500">Pas assez de donnees pour les signaux.</div>
              )}
            </div>
          </div>

          <div className="col-span-12 lg:col-span-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-xs text-blue-700 uppercase tracking-[0.25em]">Lecture rapide</div>
            <div className="mt-3 space-y-2 text-sm text-slate-700">
              <div className="flex items-center justify-between">
                <span>HS code filtre</span>
                <span className="font-semibold text-slate-900">{hsCode || "Tous"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Destination filtre</span>
                <span className="font-semibold text-slate-900">{market === ALL ? "Tous" : market}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Flux charges</span>
                <span className="font-semibold text-slate-900">{flows.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Dernière mise à jour</span>
                <span className="font-semibold text-slate-900">{formatDateTimeFr(alertsUpdatedAt)}</span>
              </div>
            </div>
            <div className="mt-4">
              <Button className="w-full" onClick={() => navigate("/app/centre-veille")}>
                Ouvrir centre veille
              </Button>
            </div>
            <div className="mt-3">
              <Button variant="outline" className="w-full" onClick={downloadLastReport} disabled={downloading}>
                {downloading ? "Generation..." : "Telecharger dernier rapport"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Fiche export</SheetTitle>
            <SheetDescription>
              Destination: {drawerCountry?.label || drawerCountry?.code_iso2 || "Selectionner un pays"}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>HS code</Label>
                <Input value={drawerHs} onChange={(e) => setDrawerHs(e.target.value)} placeholder="Ex: 3004" />
              </div>
              <div className="space-y-2">
                <Label>Produit</Label>
                <Input value={drawerProduct} onChange={(e) => setDrawerProduct(e.target.value)} placeholder="Ex: cosmetique" />
              </div>
              <div className="space-y-2">
                <Label>Valeur</Label>
                <Input value={drawerValue} onChange={(e) => setDrawerValue(e.target.value)} type="number" />
              </div>
              <div className="space-y-2">
                <Label>Devise</Label>
                <Select value={drawerCurrency} onValueChange={setDrawerCurrency}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Incoterm</Label>
                <Select value={drawerIncoterm} onValueChange={setDrawerIncoterm}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EXW">EXW</SelectItem>
                    <SelectItem value="FCA">FCA</SelectItem>
                    <SelectItem value="DAP">DAP</SelectItem>
                    <SelectItem value="DDP">DDP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Mode transport</Label>
                <Select value={drawerMode} onValueChange={setDrawerMode}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="air">Air</SelectItem>
                    <SelectItem value="sea">Maritime</SelectItem>
                    <SelectItem value="road">Road</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              onClick={() =>
                requestBriefWith({
                  country: drawerCountry,
                  hs: drawerHs,
                  product: drawerProduct,
                  valueInput: drawerValue,
                  currencyInput: drawerCurrency,
                  incotermInput: drawerIncoterm,
                  modeInput: drawerMode,
                })
              }
              disabled={drawerLoading}
              className="w-full"
            >
              {drawerLoading ? "Calcul..." : "Calculer la fiche export"}
            </Button>
            {drawerError ? <div className="text-sm text-rose-600">{drawerError}</div> : null}
          </div>

          <div className="mt-6 space-y-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs uppercase tracking-[0.24em] text-blue-700">Resume</div>
              {drawerResult ? (
                <div className="mt-3 space-y-3">
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <div className="text-xs text-slate-500">Duty</div>
                      <div className="font-semibold">{formatCurrency(drawerResult.estimate.duty, drawerResult.estimate.currency)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">Taxes</div>
                      <div className="font-semibold">{formatCurrency(drawerResult.estimate.taxes, drawerResult.estimate.currency)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">Total</div>
                      <div className="font-semibold">{formatCurrency(drawerResult.estimate.total, drawerResult.estimate.currency)}</div>
                    </div>
                  </div>
                  <div className="text-xs text-slate-500">
                    Score conformite: {drawerResult.complianceScore}/100 • Confiance: {drawerResult.confidence}
                  </div>
                  <div className="text-xs text-slate-500">
                    Sources: {drawerResult.sources?.join(", ") || "Regles internes"}
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-500">Lance un calcul pour afficher les estimations.</p>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-xs uppercase tracking-[0.24em] text-blue-700">Documents requis</div>
              {drawerResult?.documents?.length ? (
                <ul className="mt-3 space-y-1 text-sm text-slate-700">
                  {drawerResult.documents.map((doc) => (
                    <li key={doc}>• {doc}</li>
                  ))}
                </ul>
              ) : (
                <div className="mt-3 text-sm text-slate-500">Documents generiques en attente.</div>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-xs uppercase tracking-[0.24em] text-blue-700">Risques & sanctions</div>
              {drawerResult?.risks?.length ? (
                <div className="mt-3 space-y-2 text-sm">
                  {drawerResult.risks.map((risk) => (
                    <div key={risk.title} className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                      <div className="font-semibold">{risk.title}</div>
                      <div className="text-slate-600">{risk.message}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-3 text-sm text-slate-500">Aucune alerte pour le moment.</div>
              )}
            </div>
          </div>

          <div className="sticky bottom-0 mt-6 border-t border-slate-200 bg-white pt-4">
            <div className="grid gap-2">
              <Button onClick={() => navigate("/contact?offer=express")}>Validation express</Button>
              <Button variant="outline" onClick={() => setContactOpen(true)}>Demander un audit complet</Button>
              <Button variant="secondary" onClick={() => navigate("/newsletter")}>Recevoir PDF + veille</Button>
            </div>
            <div className="mt-2 text-xs text-slate-500">Dernière mise à jour: {formatDateTimeFr(drawerResult?.updatedAt)}</div>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={contactOpen} onOpenChange={setContactOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Demande d'audit complet</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Entreprise</Label>
              <Input value={contactCompany} onChange={(e) => setContactCompany(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Message</Label>
              <Textarea value={contactMessage} onChange={(e) => setContactMessage(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setContactOpen(false)}>Annuler</Button>
            <Button onClick={sendContact} disabled={contactSending}>
              {contactSending ? "Envoi..." : "Envoyer la demande"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
