// src/pages/Veille.tsx
import * as React from "react";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { getAlerts, postPrefs } from "@/lib/leadMagnetApi";
import { startOnlineCheckout } from "@/lib/billing";
import { formatDateTimeFr } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { PanoramicControlTowerMap } from "@/components/controlTower/PanoramicControlTowerMap";
import {
  BellRing,
  ShieldAlert,
  Sparkles,
  Globe2,
  Search,
  ExternalLink,
  Info,
  Mail,
  Hash,
  MapPin,
  RefreshCcw,
  Lock,
  Filter,
} from "lucide-react";

type RssItem = {
  title?: string;
  link?: string;
  source?: string | null;
  publishedAt?: string | null;
  summary?: string | null;
  zone?: string | null;
  category?: string | null;
  imageUrl?: string | null;
  image?: string | null;
};

type LinkPreview = {
  title?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  siteName?: string | null;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const COUNTRIES_FALLBACK = [
  { label: "Allemagne", iso2: "DE" },
  { label: "Espagne", iso2: "ES" },
  { label: "Italie", iso2: "IT" },
  { label: "Pays-Bas", iso2: "NL" },
  { label: "Belgique", iso2: "BE" },
  { label: "Royaume-Uni", iso2: "GB" },
  { label: "Suisse", iso2: "CH" },
  { label: "États-Unis", iso2: "US" },
  { label: "Canada", iso2: "CA" },
  { label: "Maroc", iso2: "MA" },
  { label: "Émirats arabes unis", iso2: "AE" },
  { label: "Chine", iso2: "CN" },
  { label: "Japon", iso2: "JP" },
  { label: "Inde", iso2: "IN" },
];

const TOP_COUNTRY_ISO2 = ["DE", "ES", "IT", "NL", "BE", "CH", "GB", "US", "CA", "MA", "AE", "CN", "JP", "IN"];

// Presets “conversion” (rapides, orientés usage)
const PRESETS: Array<{ label: string; countries: string[]; hint: string }> = [
  { label: "Europe (DE/ES/IT/NL/BE)", countries: ["DE", "ES", "IT", "NL", "BE"], hint: "Flux UE, douane & conformité." },
  { label: "USA", countries: ["US"], hint: "Sanctions, contrôles export, OFAC/CBP." },
  { label: "UK", countries: ["GB"], hint: "Brexit, règles d’origine, formalités." },
  { label: "Suisse", countries: ["CH"], hint: "Procédures & exigences locales." },
  { label: "MENA (MA/AE)", countries: ["MA", "AE"], hint: "Certificats, contrôles, restrictions." },
  { label: "Asie (CN/JP/IN)", countries: ["CN", "JP", "IN"], hint: "Réglementations, sanctions & risques pays." },
];

const HS_SUGGESTIONS: Array<{ hs: string; label: string; note: string }> = [
  { hs: "30", label: "Pharma / santé", note: "médicaments, dispositifs – risques sanctions/contrôles" },
  { hs: "39", label: "Plastiques", note: "matières/emballages – exigences & restrictions" },
  { hs: "61", label: "Textile (tricot)", note: "règles d’origine / étiquetage" },
  { hs: "62", label: "Textile (non tricot)", note: "règles d’origine / conformité" },
  { hs: "84", label: "Machines", note: "dual-use potentiel / licences" },
  { hs: "85", label: "Électrique / électronique", note: "contrôles export, restrictions" },
  { hs: "87", label: "Véhicules", note: "règles techniques / sanctions" },
];

const ZONE_FILTERS: Array<{ value: string; label: string }> = [
  { value: "ALL", label: "Toutes zones" },
  { value: "FR", label: "France" },
  { value: "EU", label: "Union européenne" },
  { value: "UK", label: "Royaume-Uni" },
  { value: "US", label: "États-Unis" },
  { value: "UN", label: "ONU" },
  { value: "CH", label: "Suisse" },
  { value: "INTL", label: "International" },
];

const CATEGORY_LABELS: Record<string, string> = {
  sanctions: "Sanctions",
  customs: "Douane",
  trade: "Commerce",
  tax_vat: "Taxes / TVA",
  taxes: "Taxes",
  regulation: "Réglementation",
  docs: "Documents",
  logistics: "Logistique",
  maritime: "Maritime",
  standards: "Normes",
  general: "Général",
};

function normalizeHsPrefix(v: string) {
  const digits = (v || "").replace(/[^0-9]/g, "");
  if (!digits) return "";
  const clipped = digits.slice(0, 10);
  if (clipped.length < 2) return "";
  if (clipped.length % 2 !== 0) return "";
  return clipped;
}

function safeLocalStorageGet(key: string) {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeLocalStorageSet(key: string, value: string) {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

function getDomain(url?: string) {
  if (!url) return "";
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function faviconUrlFromLink(link?: string) {
  const domain = getDomain(link);
  if (!domain) return "";
  if (domain.endsWith("exportfrancefacile.com")) return "/favicon.ico";
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`;
}

function seededCover(seed: string) {
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/960/540`;
}

function normalizeZone(zone?: string | null) {
  const z = (zone || "").trim().toUpperCase();
  if (!z) return "";
  if (z === "GB" || z === "UK") return "UK";
  if (z === "GLOBAL" || z === "INT" || z === "INTL" || z === "INTERNATIONAL") return "INTL";
  if (z === "UN" || z === "ONU") return "UN";
  return z;
}

function normalizeCategory(category?: string | null) {
  return (category || "").trim().toLowerCase();
}

function categoryLabel(category?: string | null) {
  const c = normalizeCategory(category);
  return CATEGORY_LABELS[c] || (category ? category : "");
}

type AlertItem = {
  id: string;
  title: string;
  message: string;
  severity: string;
  country?: string | null;
  hsPrefix?: string | null;
  detectedAt?: string | null;
  source?: string | null;
};

function severityLabel(sev: string) {
  const s = (sev || "").toLowerCase();
  if (s.includes("high") || s.includes("crit") || s.includes("risk")) return "Critique";
  if (s.includes("med") || s.includes("warn")) return "Attention";
  if (s.includes("low") || s.includes("info")) return "Info";
  return sev || "Info";
}

function badgeClass(severity: string) {
  const s = (severity || "").toLowerCase();
  if (s.includes("high") || s.includes("crit") || s.includes("risk")) return "badge-risk";
  if (s.includes("med") || s.includes("warn")) return "badge-warning";
  if (s.includes("low") || s.includes("info")) return "badge-neutral";
  return "badge-neutral";
}

const EXPERT_WATCH = [
  { title: "Sanctions & embargos", desc: "Listes UE/ONU/US, gels d’avoirs, interdictions sectorielles, pays sensibles." },
  { title: "Contrôles export / dual-use", desc: "Biens à double usage, licences, restrictions sur technologies & composants." },
  { title: "Règles d’origine & préférences", desc: "Accords, preuves d’origine, impacts sur droits & accès au marché." },
  { title: "Douane & conformité documentaire", desc: "Facture, packing list, déclarations, certificats, exigences spécifiques." },
  { title: "Mesures commerciales", desc: "Anti-dumping, quotas, restrictions, nouvelles formalités/contrôles." },
];

export default function Veille() {
  const { toast } = useToast();
  const { isAuthenticated, session } = useAuth();
  const prefsRef = React.useRef<HTMLDivElement | null>(null);

  const [email, setEmail] = React.useState("");
  const [emailOk, setEmailOk] = React.useState(false);

  const [countries, setCountries] = React.useState<string[]>([]);
  const [countryText, setCountryText] = React.useState("");

  const [hsCodes, setHsCodes] = React.useState<string[]>([]);
  const [hsInput, setHsInput] = React.useState("");

  const [alertsLoading, setAlertsLoading] = React.useState(false);
  const [alertsUpdatedAt, setAlertsUpdatedAt] = React.useState<string | null>(null);
  const [alerts, setAlerts] = React.useState<AlertItem[]>([]);

  const [rssLoading, setRssLoading] = React.useState(false);
  const [rssItems, setRssItems] = React.useState<RssItem[]>([]);
  const [rssUpdatedAt, setRssUpdatedAt] = React.useState<string | null>(null);
  const [rssLocked, setRssLocked] = React.useState(false);
  const [rssPackTier, setRssPackTier] = React.useState<"base" | "free_oecd" | "paid_non_oecd">("base");
  const [rssUnlockPriceMonthly, setRssUnlockPriceMonthly] = React.useState<number | null>(null);

  const [rssQuery, setRssQuery] = React.useState("");
  const [zoneFilter, setZoneFilter] = React.useState("ALL");
  const [categoryFilter, setCategoryFilter] = React.useState("ALL");
  const [sourceFilter, setSourceFilter] = React.useState("ALL");

  const [mapCountry, setMapCountry] = React.useState<string | null>(null);

  const allCountries = React.useMemo(() => {
    try {
      const supported = (Intl as any).supportedValuesOf?.("region") as string[] | undefined;
      if (!supported?.length) return COUNTRIES_FALLBACK;

      const dn = new Intl.DisplayNames(["fr"], { type: "region" });
      const list = supported
        .filter((code) => /^[A-Z]{2}$/.test(code))
        .map((iso2) => ({ iso2, label: dn.of(iso2) || iso2 }))
        .filter((c) => c.label && c.label !== c.iso2);

      const map = new Map<string, string>();
      for (const c of list) map.set(c.iso2, c.label);

      const arr = Array.from(map.entries()).map(([iso2, label]) => ({ iso2, label }));
      arr.sort((a, b) => a.label.localeCompare(b.label, "fr", { sensitivity: "base" }));
      return arr.length ? arr : COUNTRIES_FALLBACK;
    } catch {
      return COUNTRIES_FALLBACK;
    }
  }, []);

  const countryLabelMap = React.useMemo(() => {
    return new Map(allCountries.map((c) => [c.iso2, c.label]));
  }, [allCountries]);

  const topCountries = React.useMemo(() => {
    const m = new Map(allCountries.map((c) => [c.iso2, c]));
    return TOP_COUNTRY_ISO2.map((iso2) => m.get(iso2)).filter(Boolean) as Array<{ iso2: string; label: string }>;
  }, [allCountries]);

  React.useEffect(() => {
    const stored = safeLocalStorageGet("mpl_lead_email");
    if (stored) {
      setEmail(stored);
      setEmailOk(EMAIL_RE.test(stored));
    }
    const storedPrefs = safeLocalStorageGet("mpl_watch_prefs");
    if (storedPrefs) {
      try {
        const p = JSON.parse(storedPrefs);
        if (Array.isArray(p?.countries)) setCountries(p.countries);
        if (Array.isArray(p?.hsCodes)) setHsCodes(p.hsCodes);
      } catch {
        // ignore
      }
    }
  }, []);

  const loadAlerts = React.useCallback(
    async (mail: string) => {
      setAlertsLoading(true);
      try {
        const data = await getAlerts(mail);
        setAlertsUpdatedAt(data.updatedAt);
        setAlerts(data.alerts || []);
      } catch (e: any) {
        toast({ title: "Erreur alertes", description: e?.message || "Impossible de charger les alertes." });
      } finally {
        setAlertsLoading(false);
      }
    },
    [toast]
  );

  // ✅ loadRss enrichit maintenant avec des PREVIEWS OG/Twitter via /api/link-preview
  const loadRss = React.useCallback(async () => {
    setRssLoading(true);
    try {
      const headers: Record<string, string> = {};
      const token = String(session?.access_token || "").trim();
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch("/api/rss?limit=30", { headers });
      const raw = await res.json().catch(() => ({}));
      setRssLocked(Boolean(raw?.locked));
      const packTier = String(raw?.pack?.tier || "base");
      setRssPackTier(
        packTier === "paid_non_oecd" || packTier === "free_oecd" || packTier === "base"
          ? packTier
          : "base"
      );
      const monthly = Number(raw?.unlock?.price_monthly);
      setRssUnlockPriceMonthly(Number.isFinite(monthly) ? monthly : null);
      const items = Array.isArray(raw?.items) ? raw.items : Array.isArray(raw?.data?.items) ? raw.data.items : [];

      const normalized: RssItem[] = items.map((it: any) => ({
        title: it?.title,
        link: it?.link || it?.url,
        source: it?.source || it?.feed || it?.sourceName || it?.siteName || null,
        publishedAt: it?.publishedAt || it?.published_at || it?.pubDate || null,
        summary: it?.summary || it?.description || null,
        zone: it?.zone || it?.country || it?.territory || null,
        category: it?.category || null,
        imageUrl: it?.imageUrl || it?.image_url || null,
        image: it?.image || null,
      }));

      // 🔥 PREVIEWS : titre/desc/image/site_name depuis la page cible
      const urls = Array.from(new Set(normalized.map((x) => x.link).filter(Boolean))) as string[];
      let previews: Record<string, LinkPreview> = {};

      if (urls.length) {
        try {
          const pRes = await fetch("/api/link-preview", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ urls: urls.slice(0, 30) }),
          });
          const pJson = await pRes.json().catch(() => ({}));
          previews = (pJson?.items || {}) as Record<string, LinkPreview>;
        } catch {
          previews = {};
        }
      }

      const enriched = normalized.map((it) => {
        const p = it.link ? previews[it.link] : null;
        return {
          ...it,
          // Remplace uniquement si on a mieux
          title: (p?.title || it.title) ?? it.title,
          summary: (p?.description || it.summary) ?? it.summary,
          source: (p?.siteName || it.source) ?? it.source,
          imageUrl: (p?.imageUrl || it.imageUrl) ?? it.imageUrl,
        };
      });

      setRssItems(enriched.slice(0, 30));
      setRssUpdatedAt(raw?.updatedAt || null);
    } catch {
      setRssItems([]);
      setRssUpdatedAt(null);
      setRssLocked(false);
      setRssPackTier("base");
      setRssUnlockPriceMonthly(null);
    } finally {
      setRssLoading(false);
    }
  }, [session?.access_token]);

  React.useEffect(() => {
    loadRss();
  }, [loadRss]);

  const handleSavePrefs = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !EMAIL_RE.test(trimmed)) {
      toast({ title: "Email requis", description: "Ajoute un email valide pour activer la veille personnalisée." });
      return;
    }

    try {
      setAlertsLoading(true);
      await postPrefs({ email: trimmed, countries, hsCodes });
      safeLocalStorageSet("mpl_lead_email", trimmed);
      safeLocalStorageSet("mpl_watch_prefs", JSON.stringify({ countries, hsCodes }));
      toast({ title: "Veille activée", description: "Préférences enregistrées. Chargement des alertes…" });
      await loadAlerts(trimmed);
    } catch (e: any) {
      toast({ title: "Erreur préférences", description: e?.message || "Impossible d'enregistrer." });
    } finally {
      setAlertsLoading(false);
    }
  };

  const addCountryFromText = (text: string) => {
    setCountryText(text);
    const m = text.match(/\(([A-Za-z]{2})\)\s*$/);
    const iso2 = m?.[1]?.toUpperCase();
    if (!iso2) return;

    if (!countries.includes(iso2)) {
      setCountries((prev) => [...prev, iso2]);
    }
    setCountryText("");
  };

  const addHs = () => {
    const hs = normalizeHsPrefix(hsInput);
    if (!hs) {
      toast({ title: "HS invalide", description: "Entre un préfixe HS de 2 à 10 chiffres (2/4/6/8/10) (ex : 30, 3004, 8517)." });
      return;
    }
    if (!hsCodes.includes(hs)) setHsCodes((prev) => [...prev, hs]);
    setHsInput("");
  };

  const applyPreset = (presetCountries: string[]) => {
    setCountries((prev) => {
      const s = new Set(prev);
      for (const c of presetCountries) s.add(c);
      return Array.from(s);
    });
  };

  const scrollToPrefs = () => {
    prefsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const sortedRss = React.useMemo(() => {
    return [...rssItems].sort((a, b) => {
      const da = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
      const db = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
      if (db !== da) return db - da;
      return 0;
    });
  }, [rssItems]);

  const recentCount = React.useMemo(() => {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return sortedRss.filter((it) => {
      const t = it.publishedAt ? new Date(it.publishedAt).getTime() : 0;
      return t >= cutoff;
    }).length;
  }, [sortedRss]);

  const ticker = React.useMemo(() => {
    const items = sortedRss.slice(0, 10).map((x) => x.title).filter(Boolean) as string[];
    if (!items.length) return "Veille en cours : sanctions, douane, conformité documentaire, risques pays…";
    return items.join("  •  ");
  }, [sortedRss]);

  const sources = React.useMemo(() => {
    const set = new Set<string>();
    for (const it of rssItems) {
      const s = (it.source || "").trim();
      if (s) set.add(s);
    }
    return Array.from(set.values()).sort((a, b) => a.localeCompare(b, "fr"));
  }, [rssItems]);

  const categories = React.useMemo(() => {
    const set = new Set<string>();
    for (const it of rssItems) {
      const c = normalizeCategory(it.category);
      if (c) set.add(c);
    }
    return Array.from(set.values())
      .sort((a, b) => a.localeCompare(b, "fr"))
      .map((c) => ({ value: c, label: CATEGORY_LABELS[c] || c }));
  }, [rssItems]);

  const filteredNews = React.useMemo(() => {
    return sortedRss.filter((it) => {
      const zoneOk =
        zoneFilter === "ALL" || normalizeZone(it.zone) === zoneFilter || (zoneFilter === "INTL" && !it.zone);
      const cat = normalizeCategory(it.category);
      const categoryOk = categoryFilter === "ALL" || cat === categoryFilter;
      const sourceOk = sourceFilter === "ALL" || (it.source || "").trim() === sourceFilter;
      return zoneOk && categoryOk && sourceOk;
    });
  }, [sortedRss, zoneFilter, categoryFilter, sourceFilter]);

  const filteredFlux = React.useMemo(() => {
    const q = rssQuery.trim().toLowerCase();
    if (!q) return sortedRss;
    return sortedRss.filter((it) => {
      const hay = `${it.title || ""} ${it.summary || ""} ${it.source || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [sortedRss, rssQuery]);

  const isTeaser = !isAuthenticated || !emailOk;
  const visibleNews = isTeaser ? filteredNews.slice(0, 6) : filteredNews;

  const handleUnlock = async () => {
    if (!isAuthenticated) {
      window.location.href = "/pricing?plan=PRO_ONLINE";
      return;
    }
    try {
      await startOnlineCheckout();
    } catch (err: any) {
      toast({
        title: "Paiement indisponible",
        description: err?.message || "Impossible de démarrer le paiement.",
      });
    }
  };

  const demoAlerts: AlertItem[] = React.useMemo(
    () => [
      {
        id: "demo-1",
        title: "Changement sanction / restriction sectorielle",
        message:
          "Une mesure peut impacter l’export de certains produits vers un pays cible. Vérifier la liste applicable + adapter documents & screening.",
        severity: "high",
        country: "US",
        hsPrefix: "85",
        detectedAt: new Date().toISOString(),
        source: "Synthèse (exemple)",
      },
      {
        id: "demo-2",
        title: "Contrôle export / dual-use : vigilance composants",
        message:
          "Certains composants/technologies peuvent relever de contrôles. Confirmer classification + licence si nécessaire.",
        severity: "med",
        country: "DE",
        hsPrefix: "84",
        detectedAt: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
        source: "Synthèse (exemple)",
      },
    ],
    []
  );

  const effectiveAlerts = emailOk ? alerts : demoAlerts;

  const countryStats = React.useMemo(() => {
    const stats: Record<string, { label?: string; alerts?: number; updates?: number; total?: number }> = {};
    for (const alert of effectiveAlerts) {
      const iso = String(alert.country || "").trim().toUpperCase();
      if (!iso) continue;
      const current = stats[iso] || { label: countryLabelMap.get(iso) || iso, alerts: 0, updates: 0, total: 0 };
      current.alerts = (current.alerts || 0) + 1;
      current.total = (current.total || 0) + 1;
      stats[iso] = current;
    }
    return stats;
  }, [effectiveAlerts, countryLabelMap]);

  return (
    <PublicLayout>
      <div className="space-y-10">
        {/* HERO WAOW + TICKER */}
        <section className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 p-6 text-white shadow-xl md:p-10">
          {/* blobs */}
          <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-blue-500/25 blur-3xl" />
          <div className="pointer-events-none absolute -right-24 -bottom-24 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(56,189,248,0.20),transparent_40%),radial-gradient(circle_at_80%_40%,rgba(59,130,246,0.18),transparent_45%),radial-gradient(circle_at_55%_90%,rgba(14,165,233,0.12),transparent_40%)]" />
          <div className="pointer-events-none absolute right-6 top-6 hidden md:block">
            <div className="radar" />
          </div>

          <div className="relative">
            <p className="text-xs uppercase tracking-[0.35em] text-blue-200">Veille export — sanctions & conformité</p>
            <h1 className="mt-2 text-4xl font-semibold md:text-5xl">
              Ta tour de contrôle{" "}
              <span className="inline-flex items-center gap-2">
                <Sparkles className="h-5 w-5" /> anti-surprise
              </span>
              .
            </h1>
            <p className="mt-3 max-w-2xl text-lg text-slate-200">
              Configure tes <strong>pays</strong> et tes <strong>préfixes HS</strong>. On te remonte uniquement l’essentiel : alertes
              actionnables + sources.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-blue-100/80">
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1">{recentCount} nouveautés / 7 jours</span>
              <span className="rounded-full border border-white/20 bg-white/5 px-3 py-1">
                {rssUpdatedAt ? `Mise à jour ${formatDateTimeFr(rssUpdatedAt)}` : "Mise à jour en cours"}
              </span>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Button onClick={scrollToPrefs}>
                Activer ma veille <Chevron />
              </Button>
              <Button
                variant="outline"
                className="border-white/30 text-white hover:bg-white/10"
                onClick={() => (window.location.href = "/contact?offer=express")}
              >
                Validation express
              </Button>
              <Button
                variant="outline"
                className="border-white/30 text-white hover:bg-white/10"
                onClick={() => (window.location.href = "/contact?offer=audit")}
              >
                Audit complet
              </Button>
            </div>

            <div className="mt-8 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
              <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2 text-xs text-slate-200">
                <BellRing className="h-4 w-4" />
                <span className="opacity-90">Live</span>
                <span className="opacity-60">—</span>
                <span className="opacity-75">derniers signaux</span>
              </div>
              <div className="relative">
                <div className="animate-marquee whitespace-nowrap px-4 py-3 text-sm text-slate-100">
                  {ticker} &nbsp;&nbsp;&nbsp; {ticker}
                </div>
                <div className="pointer-events-none absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-slate-950 to-transparent" />
                <div className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-slate-950 to-transparent" />
              </div>
            </div>

            <p className="mt-3 text-xs text-slate-300/80">
              Pas de bruit : pays + HS = signal utile. <span className="opacity-80">Tu gardes l’historique, tu agis vite.</span>
            </p>
          </div>
        </section>

        {/* EXPERTISE BLOCK */}
        <section className="grid gap-6 lg:grid-cols-5">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5" />
                Ce qu’on surveille (niveau expert)
              </CardTitle>
              <CardDescription>Les 5 sources d’ennuis récurrents en export — converties en alertes.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {EXPERT_WATCH.map((x) => (
                <div key={x.title} className="rounded-xl border border-border bg-card p-4">
                  <div className="font-semibold">{x.title}</div>
                  <p className="mt-1 text-sm text-muted-foreground">{x.desc}</p>
                </div>
              ))}
              <div className="rounded-xl border border-border bg-muted p-4 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Objectif :</span> éviter la mauvaise surprise (blocage, retard, non-conformité),
                et sécuriser décision/flux.
              </div>
            </CardContent>
          </Card>

          {/* MAIN: prefs + live content */}
          <div className="lg:col-span-3 space-y-6">
            {/* NOUVEAUTÉS */}
            <Card className="card-hover">
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5" />
                      Nouveautés
                    </CardTitle>
                    <CardDescription>
                      Sélection récente issue des sources officielles. Filtres rapides par zone, catégorie et source.
                    </CardDescription>
                  </div>
                  <Button variant="outline" onClick={loadRss} disabled={rssLoading}>
                    <RefreshCcw className="mr-2 h-4 w-4" />
                    {rssLoading ? "Actualisation..." : "Actualiser"}
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                    <Filter className="h-4 w-4" />
                    Filtres rapides
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {ZONE_FILTERS.map((zone) => (
                      <button
                        key={zone.value}
                        type="button"
                        onClick={() => setZoneFilter(zone.value)}
                        className={cn(
                          "rounded-full border px-3 py-1 text-xs transition",
                          zoneFilter === zone.value
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-border bg-muted text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {zone.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="h-9 rounded-full border border-border bg-card px-3 text-xs"
                  >
                    <option value="ALL">Toutes catégories</option>
                    {categories.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={sourceFilter}
                    onChange={(e) => setSourceFilter(e.target.value)}
                    className="h-9 rounded-full border border-border bg-card px-3 text-xs"
                  >
                    <option value="ALL">Toutes sources</option>
                    {sources.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setZoneFilter("ALL");
                      setCategoryFilter("ALL");
                      setSourceFilter("ALL");
                    }}
                  >
                    Réinitialiser
                  </Button>
                </div>

                <Separator />

                {rssLoading ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="h-36 rounded-2xl border border-border bg-muted animate-pulse" />
                    ))}
                  </div>
                ) : visibleNews.length === 0 ? (
                  <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
                    Aucun item disponible pour ces filtres.
                  </div>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">
                    {visibleNews.map((it, idx) => {
                      const domain = getDomain(it.link) || it.source || "rss";
                      const cover = it.imageUrl || it.image || seededCover(`${domain}-${it.title || idx}`);
                      const favicon = faviconUrlFromLink(it.link);
                      const isFresh = it.publishedAt
                        ? new Date(it.publishedAt).getTime() > Date.now() - 72 * 60 * 60 * 1000
                        : false;
                      const zone = normalizeZone(it.zone);
                      const category = categoryLabel(it.category);

                      return (
                        <article
                          key={`${it.link || it.title || "item"}_${idx}`}
                          className="group flex gap-4 rounded-2xl border border-border bg-card p-4 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-blue-500/10"
                        >
                          <div className="relative h-24 w-32 flex-shrink-0 overflow-hidden rounded-xl border border-border bg-muted">
                            <img src={cover} alt="" className="h-full w-full object-cover" loading="lazy" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                            {favicon ? (
                              <img
                                src={favicon}
                                alt=""
                                className="absolute left-2 top-2 h-7 w-7 rounded-full border border-white/30 bg-white/10"
                                loading="lazy"
                                onError={(e) => {
                                  e.currentTarget.onerror = null;
                                  e.currentTarget.src = "/favicon.ico";
                                }}
                              />
                            ) : null}
                          </div>

                          <div className="flex min-w-0 flex-1 flex-col">
                            <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                              {zone ? <span className="rounded-full border border-border bg-muted px-2 py-1">Zone {zone}</span> : null}
                              {category ? <span className="rounded-full border border-border bg-muted px-2 py-1">{category}</span> : null}
                              {it.source ? <span className="rounded-full border border-border bg-muted px-2 py-1">{it.source}</span> : null}
                              {isFresh ? (
                                <span className="rounded-full border border-emerald-300/60 bg-emerald-50 px-2 py-1 text-emerald-700">
                                  Nouveau
                                </span>
                              ) : null}
                            </div>

                            <div className="mt-1 text-sm font-semibold line-clamp-2">{it.title || "Sans titre"}</div>
                            {it.summary ? <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{it.summary}</p> : null}

                            <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                              <span>{it.publishedAt ? formatDateTimeFr(it.publishedAt) : "Date inconnue"}</span>
                              {it.link ? (
                                <a className="inline-flex items-center gap-1 text-primary hover:underline" href={it.link} target="_blank" rel="noreferrer">
                                  Lire <ExternalLink className="h-3 w-3" />
                                </a>
                              ) : null}
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}

                {isTeaser ? (
                  <div className="rounded-2xl border border-border bg-gradient-to-r from-slate-950 to-blue-950 p-4 text-white">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="text-sm font-semibold">Débloquer la veille complète + alertes personnalisées</div>
                        <div className="text-xs text-blue-100/80">Accès illimité aux nouveautés + alertes ciblées. 65€/mois.</div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button onClick={handleUnlock} className="bg-white text-slate-950 hover:bg-slate-100">
                          <Lock className="mr-2 h-4 w-4" /> Débloquer
                        </Button>
                        <Button
                          variant="outline"
                          className="border-white/40 text-white hover:bg-white/10"
                          onClick={() => (window.location.href = "/pricing?plan=PRO_ONLINE")}
                        >
                          Voir l’offre
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            {/* PREFS (waow UX) */}
            <div ref={prefsRef}>
              <Card className="card-hover">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Globe2 className="h-5 w-5" />
                    Ma veille personnalisée
                  </CardTitle>
                  <CardDescription>Email + pays + préfixes HS. Tu peux commencer en 30 secondes.</CardDescription>
                </CardHeader>

                <CardContent className="space-y-5">
                  {/* Email */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Mail className="h-4 w-4" /> Email
                    </Label>
                    <Input
                      value={email}
                      onChange={(e) => {
                        const v = e.target.value;
                        setEmail(v);
                        setEmailOk(EMAIL_RE.test(v.trim().toLowerCase()));
                      }}
                      placeholder="email@entreprise.com"
                    />
                    {!emailOk && email.length > 0 ? (
                      <p className="text-xs text-muted-foreground">Format email non valide.</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">On s’en sert pour te livrer des alertes utiles (pas du spam).</p>
                    )}
                  </div>

                  <Separator />

                  {/* Presets */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4" /> Démarrage rapide
                    </Label>
                    <div className="grid gap-2 md:grid-cols-2">
                      {PRESETS.map((p) => (
                        <button
                          key={p.label}
                          type="button"
                          onClick={() => applyPreset(p.countries)}
                          className="group rounded-2xl border border-border bg-card p-4 text-left transition hover:-translate-y-0.5 hover:shadow-lg"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="font-semibold">{p.label}</div>
                              <div className="mt-1 text-xs text-muted-foreground">{p.hint}</div>
                            </div>
                            <span className="rounded-full border border-border bg-muted px-2 py-1 text-xs text-muted-foreground group-hover:text-foreground">
                              + ajouter
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  {/* Countries */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" /> Pays suivis
                    </Label>

                    <div className="flex flex-wrap gap-2">
                      {topCountries.map((c) => (
                        <button
                          key={c.iso2}
                          type="button"
                          onClick={() => setCountries((prev) => (prev.includes(c.iso2) ? prev : [...prev, c.iso2]))}
                          className="rounded-full border border-border bg-card px-3 py-1 text-xs hover:bg-muted"
                        >
                          + {c.label}
                        </button>
                      ))}
                    </div>

                    <Input
                      value={countryText}
                      onChange={(e) => setCountryText(e.target.value)}
                      onBlur={(e) => addCountryFromText(e.target.value)}
                      placeholder='Recherche : "Suisse (CH)"'
                      list="countries-list"
                    />

                    <datalist id="countries-list">
                      {allCountries.map((c) => (
                        <option key={c.iso2} value={`${c.label} (${c.iso2})`} />
                      ))}
                    </datalist>

                    {countries.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {countries.map((iso2) => (
                          <button
                            key={iso2}
                            type="button"
                            onClick={() => setCountries((prev) => prev.filter((x) => x !== iso2))}
                            className="rounded-full border border-border bg-muted px-3 py-1 text-xs text-foreground hover:opacity-80"
                            title="Cliquer pour retirer"
                          >
                            {iso2} ✕
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">Ajoute 1–3 pays : plus de signal, moins de bruit.</p>
                    )}
                  </div>

                  <Separator />

                  {/* HS */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Hash className="h-4 w-4" /> Préfixes HS suivis
                    </Label>

                    <div className="flex flex-wrap gap-2">
                      {HS_SUGGESTIONS.map((x) => (
                        <button
                          key={x.hs}
                          type="button"
                          onClick={() => setHsCodes((prev) => (prev.includes(x.hs) ? prev : [...prev, x.hs]))}
                          className="rounded-full border border-border bg-card px-3 py-1 text-xs hover:bg-muted"
                          title={x.note}
                        >
                          + HS {x.hs} <span className="opacity-70">({x.label})</span>
                        </button>
                      ))}
                    </div>

                    <div className="flex gap-2">
                      <Input
                        value={hsInput}
                        onChange={(e) => setHsInput(e.target.value)}
                        placeholder="Ex : 30, 3004, 8517, 85171234"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addHs();
                          }
                        }}
                      />
                      <Button type="button" onClick={addHs} variant="outline">
                        Ajouter
                      </Button>
                    </div>

                    {hsCodes.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {hsCodes.map((hs) => (
                          <button
                            key={hs}
                            type="button"
                            onClick={() => setHsCodes((prev) => prev.filter((x) => x !== hs))}
                            className="rounded-full border border-border bg-muted px-3 py-1 text-xs text-foreground hover:opacity-80"
                            title="Cliquer pour retirer"
                          >
                            HS {hs} ✕
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Ajoute 1–3 préfixes HS (2–10 chiffres) (2/4/6/8/10) pour filtrer au plus près de tes produits.
                      </p>
                    )}
                  </div>

                  <Button onClick={handleSavePrefs} disabled={alertsLoading} className="w-full">
                    {alertsLoading ? "Activation..." : "Activer / mettre à jour ma veille"}
                  </Button>

                  <div className="rounded-xl border border-border bg-muted p-4 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">💡 Tip :</span> commence par 1 pays + 1 HS. Tu élargiras ensuite.
                    <br />
                    <span className="font-medium text-foreground">⚠️ Disclaimer :</span> info indicative, ne remplace pas conseil juridique/douanier.
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* ALERTES */}
            <Card className="card-hover">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BellRing className="h-5 w-5" />
                  Alertes personnalisées
                </CardTitle>
                <CardDescription>
                  {alertsUpdatedAt ? `Dernière mise à jour : ${formatDateTimeFr(alertsUpdatedAt)}` : "Aperçu disponible — connecte ton email pour les vraies alertes."}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs text-muted-foreground">
                    {emailOk ? "Alertes liées à tes préférences (pays + HS)." : "Mode démo : exemple d’alertes (entre ton email pour activer)."}
                  </div>
                  <div className="flex gap-2">
                    {emailOk ? (
                      <Button variant="outline" onClick={() => loadAlerts(email.trim().toLowerCase())} disabled={alertsLoading}>
                        <RefreshCcw className="mr-2 h-4 w-4" />
                        {alertsLoading ? "Chargement..." : "Recharger"}
                      </Button>
                    ) : (
                      <Button variant="outline" onClick={scrollToPrefs}>
                        <Mail className="mr-2 h-4 w-4" />
                        Activer avec mon email
                      </Button>
                    )}
                    <Button onClick={() => (window.location.href = "/contact?offer=express")}>Transformer en action</Button>
                  </div>
                </div>

                <Separator />

                {alertsLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="h-24 rounded-xl border border-border bg-muted animate-pulse" />
                    ))}
                  </div>
                ) : effectiveAlerts.length === 0 ? (
                  <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">Aucune alerte pour l’instant.</div>
                ) : (
                  <div className="space-y-3">
                    {effectiveAlerts.slice(0, 10).map((a) => (
                      <div key={a.id} className="rounded-2xl border border-border bg-card p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="font-semibold">{a.title}</div>
                          <span className={cn("rounded-full px-2 py-1 text-xs", badgeClass(a.severity))}>{severityLabel(a.severity)}</span>
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">{a.message}</p>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                          {a.country ? <span className="rounded-full border border-border bg-muted px-2 py-1">Pays: {a.country}</span> : null}
                          {a.hsPrefix ? <span className="rounded-full border border-border bg-muted px-2 py-1">HS: {a.hsPrefix}</span> : null}
                          {a.detectedAt ? <span className="rounded-full border border-border bg-muted px-2 py-1">{formatDateTimeFr(a.detectedAt)}</span> : null}
                          {a.source ? <span className="rounded-full border border-border bg-muted px-2 py-1">Source: {a.source}</span> : null}
                        </div>
                        <div className="mt-4 rounded-xl border border-border bg-muted p-3 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-2 font-medium text-foreground">
                            <Info className="h-4 w-4" /> Action recommandée
                          </span>
                          <div className="mt-1">
                            1) Vérifier la source officielle • 2) Confirmer classification (HS / usage) • 3) Adapter documents / screening • 4) Décider (OK / blocage / escalade).
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* CARTE + FLUX */}
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
              <Card className="card-hover">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Globe2 className="h-5 w-5" />
                    Carte export & veille
                  </CardTitle>
                  <CardDescription>La carte reste alignée au flux de veille (plus lisible, même en filtre).</CardDescription>
                </CardHeader>
                <CardContent>
                  <PanoramicControlTowerMap
                    selectedCountry={mapCountry}
                    selectedLabel={mapCountry ? countryLabelMap.get(mapCountry) ?? mapCountry : "Tous"}
                    stats={{ alerts: effectiveAlerts.length, updates: rssItems.length, total: effectiveAlerts.length }}
                    countryStats={countryStats}
                    onCountrySelect={(iso) => setMapCountry(iso)}
                    onReset={() => setMapCountry(null)}
                  />
                </CardContent>
              </Card>

              {/* FLUX */}
            <Card className="card-hover">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="h-5 w-5" />
                  Flux & sources
                </CardTitle>
                <CardDescription>Recherche rapide dans le flux complet.</CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                {rssLocked ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                    Apercu veille limite ({rssPackTier === "paid_non_oecd" ? "Pack payant" : rssPackTier === "free_oecd" ? "OCDE (gratuit)" : "Base FR+UE"}).
                    {typeof rssUnlockPriceMonthly === "number" ? (
                      <span> Prix: {(rssUnlockPriceMonthly / 100).toFixed(2)} EUR/mois.</span>
                    ) : null}
                    {rssPackTier === "paid_non_oecd" ? (
                      <span className="ml-1">
                        <a className="underline" href="/pricing#country-packs">Debloquer ce pays</a>
                      </span>
                    ) : null}
                  </div>
                ) : null}

                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={rssQuery}
                      onChange={(e) => setRssQuery(e.target.value)}
                      placeholder="Rechercher dans le flux (ex : sanctions, embargo, douane, Russie, Iran, dual-use...)"
                      className="pl-9"
                    />
                  </div>
                  <Button variant="outline" onClick={loadRss} disabled={rssLoading}>
                    <RefreshCcw className="mr-2 h-4 w-4" />
                    {rssLoading ? "Actualisation..." : "Actualiser"}
                  </Button>
                </div>

                <Separator />

                {rssLoading ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="h-56 rounded-2xl border border-border bg-muted animate-pulse" />
                    ))}
                  </div>
                ) : filteredFlux.length === 0 ? (
                  <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">Aucun item trouvé (ou /api/rss en erreur).</div>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">
                    {filteredFlux.slice(0, 12).map((it, idx) => {
                      const domain = getDomain(it.link) || it.source || "rss";
                      const cover = it.imageUrl || it.image || seededCover(`${domain}-${it.title || idx}`);
                      const favicon = faviconUrlFromLink(it.link);

                      return (
                        <div
                          key={`${it.link || it.title || "item"}_${idx}`}
                          className="group overflow-hidden rounded-2xl border border-border bg-card transition hover:-translate-y-0.5 hover:shadow-lg"
                        >
                          <div className="relative h-32">
                            <img
                              src={cover}
                              alt=""
                              className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.02]"
                              loading="lazy"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                {favicon ? (
                                  <img
                                    src={favicon}
                                    alt=""
                                    className="h-7 w-7 rounded-full border border-white/30 bg-white/10"
                                    loading="lazy"
                                    onError={(e) => {
                                      e.currentTarget.onerror = null;
                                      e.currentTarget.src = "/favicon.ico";
                                    }}
                                  />
                                ) : null}
                                <div className="text-xs text-white/90">
                                  <div className="font-medium">{it.source || domain}</div>
                                  <div className="opacity-75">{it.publishedAt ? formatDateTimeFr(it.publishedAt) : ""}</div>
                                </div>
                              </div>
                              <span className="rounded-full border border-white/20 bg-white/10 px-2 py-1 text-[11px] text-white/90">Signal</span>
                            </div>
                          </div>

                          <div className="p-4">
                            <div className="text-sm font-semibold line-clamp-2">{it.title || "Sans titre"}</div>
                            {it.summary ? <p className="mt-2 text-sm text-muted-foreground line-clamp-3">{it.summary}</p> : null}

                            <div className="mt-4 flex items-center justify-between gap-3">
                              {it.link ? (
                                <a className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline" href={it.link} target="_blank" rel="noreferrer">
                                  Lire la source <ExternalLink className="h-4 w-4" />
                                </a>
                              ) : (
                                <span className="text-sm text-muted-foreground">Lien indisponible</span>
                              )}

                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => (window.location.href = "/contact?offer=express")}
                                className="text-xs"
                              >
                                Interpréter pour moi
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
            </div>
          </div>
        </section>
      </div>

      {/* Tailwind marquee animation (local) */}
      <style>
        {`
          @keyframes marquee {
            0% { transform: translateX(0); }
            100% { transform: translateX(-50%); }
          }
          .animate-marquee {
            animation: marquee 28s linear infinite;
          }
          @keyframes radar-rotate {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          .radar {
            position: relative;
            width: 120px;
            height: 120px;
            border-radius: 9999px;
            border: 1px solid rgba(125, 211, 252, 0.35);
            background:
              radial-gradient(circle at 50% 50%, rgba(56, 189, 248, 0.12), transparent 55%),
              radial-gradient(circle at 50% 50%, rgba(59, 130, 246, 0.08), transparent 70%);
            overflow: hidden;
            box-shadow: 0 0 30px rgba(56, 189, 248, 0.25);
          }
          .radar::before {
            content: "";
            position: absolute;
            inset: 14%;
            border-radius: 9999px;
            border: 1px dashed rgba(125, 211, 252, 0.35);
          }
          .radar::after {
            content: "";
            position: absolute;
            inset: -30%;
            background: conic-gradient(
              from 0deg,
              rgba(56, 189, 248, 0) 0%,
              rgba(56, 189, 248, 0.45) 18%,
              rgba(56, 189, 248, 0) 35%
            );
            animation: radar-rotate 6s linear infinite;
          }
        `}
      </style>
    </PublicLayout>
  );
}

function Chevron() {
  return (
    <span className="inline-flex items-center">
      <span className="ml-2">→</span>
    </span>
  );
}
