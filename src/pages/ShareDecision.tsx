import React from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { PublicLayout } from "@/components/layout/PublicLayout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { LandedCostInput } from "@/lib/landedCost";
import { computeLandedCost } from "@/lib/landedCost";

const SHARE_KEY = "mpl_share_payloads";

type SharePayload = {
  id: string;
  createdAt: string;
  input: LandedCostInput;
  result: ReturnType<typeof computeLandedCost>;
};

function formatMoney(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${value.toFixed(0)} ${currency}`;
  }
}

function safeJsonParse<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function readShare(id: string): SharePayload | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(SHARE_KEY);
  if (!raw) return null;
  const store = safeJsonParse<Record<string, SharePayload>>(raw);
  return store?.[id] ?? null;
}

function upsertShare(payload: SharePayload) {
  if (typeof window === "undefined") return;
  const raw = window.localStorage.getItem(SHARE_KEY);
  const store = safeJsonParse<Record<string, SharePayload>>(raw || "{}") || {};
  store[payload.id] = payload;
  window.localStorage.setItem(SHARE_KEY, JSON.stringify(store));
}

/**
 * Base64URL helpers (portable in URL)
 */
function base64UrlDecode(input: string) {
  const pad = "=".repeat((4 - (input.length % 4)) % 4);
  const base64 = (input + pad).replace(/-/g, "+").replace(/_/g, "/");
  // atob expects ASCII; JSON is UTF-8 => decode safely
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  const decoded = new TextDecoder().decode(bytes);
  return decoded;
}

function base64UrlEncode(text: string) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  const base64 = btoa(binary);
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodePayloadParam(p: string): SharePayload | null {
  try {
    const decoded = base64UrlDecode(p);
    const parsed = safeJsonParse<Partial<SharePayload>>(decoded);
    if (!parsed?.input) return null;

    // Be permissive: if "result" missing, recompute
    const computed = computeLandedCost(parsed.input as LandedCostInput);

    const normalized: SharePayload = {
      id: typeof parsed.id === "string" ? parsed.id : crypto.randomUUID(),
      createdAt:
        typeof parsed.createdAt === "string" ? parsed.createdAt : new Date().toISOString(),
      input: parsed.input as LandedCostInput,
      result: (parsed.result as SharePayload["result"]) ?? computed,
    };

    return normalized;
  } catch {
    return null;
  }
}

export default function ShareDecision() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [payload, setPayload] = React.useState<SharePayload | null>(null);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    // 1) Try localStorage by id
    if (id) {
      const local = readShare(id);
      if (local) {
        setPayload(local);
        return;
      }
    }

    // 2) Fallback: try URL param ?p=
    const p = searchParams.get("p");
    if (p) {
      const decoded = decodePayloadParam(p);
      if (decoded) {
        setPayload(decoded);
        // Persist for convenience on this browser
        upsertShare(decoded);
        return;
      }
    }

    setPayload(null);
  }, [id, searchParams]);

  const shareUrl = React.useMemo(() => {
    if (typeof window === "undefined") return "";
    // If we already have ?p=, keep it; otherwise generate one from payload
    const current = new URL(window.location.href);
    if (current.searchParams.get("p")) return current.toString();

    if (!payload) return current.toString();
    const compact = {
      id: payload.id,
      createdAt: payload.createdAt,
      input: payload.input,
      // optional: you can omit result to keep URLs smaller; we keep it for stability
      result: payload.result,
    };
    const encoded = base64UrlEncode(JSON.stringify(compact));
    current.searchParams.set("p", encoded);
    return current.toString();
  }, [payload]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // fallback: no-op
      setCopied(false);
    }
  }

  if (!id && !searchParams.get("p")) {
    return (
      <PublicLayout>
        <Card className="border border-white/15 bg-white/10 text-white backdrop-blur">
          <CardHeader>
            <CardTitle>Lien invalide</CardTitle>
            <CardDescription className="text-slate-200">
              Aucun identifiant (ou payload) fourni.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate("/analyse")}>Aller vers l’analyse</Button>
          </CardContent>
        </Card>
      </PublicLayout>
    );
  }

  if (!payload) {
    return (
      <PublicLayout>
        <Card className="border border-white/15 bg-white/10 text-white backdrop-blur">
          <CardHeader>
            <CardTitle>Lien expiré ou introuvable</CardTitle>
            <CardDescription className="text-slate-200">
              Ce scénario n’est pas disponible sur ce navigateur (ou le lien ne contient pas de payload).
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button onClick={() => navigate("/analyse")}>Recréer une analyse</Button>
            <Button variant="secondary" onClick={() => navigate("/")}>
              Retour accueil
            </Button>
          </CardContent>
        </Card>
      </PublicLayout>
    );
  }

  const { input, result } = payload;
  const createdLabel = new Date(payload.createdAt).toLocaleDateString("fr-FR");

  return (
    <PublicLayout>
      <div className="space-y-6">
        <Card className="border border-white/15 bg-white/10 text-white backdrop-blur">
          <CardHeader>
            <CardTitle>Fiche décision partagée</CardTitle>
            <CardDescription className="text-slate-200">Créée le {createdLabel}.</CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <Badge className="bg-white/10 text-white border-white/20">
                {input.destination}
              </Badge>
              <Badge className="bg-white/10 text-white border-white/20">{input.incoterm}</Badge>
              <Badge className="bg-white/10 text-white border-white/20">{input.mode}</Badge>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-white/15 bg-white/5 p-4">
                <div className="text-xs uppercase text-slate-200">Total landed cost</div>
                <div className="text-2xl font-semibold">{formatMoney(result.total, input.currency)}</div>
              </div>

              <div className="rounded-xl border border-white/15 bg-white/5 p-4">
                <div className="text-xs uppercase text-slate-200">Unit cost</div>
                <div className="text-2xl font-semibold">
                  {result.unitCost ? formatMoney(result.unitCost, input.currency) : "n/a"}
                </div>
              </div>
            </div>

            <div>
              <div className="text-sm font-semibold">Breakdown</div>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-200">
                <li>Pré-acheminement : {formatMoney(result.breakdown.preCarriage, input.currency)}</li>
                <li>Fret principal : {formatMoney(result.breakdown.mainFreight, input.currency)}</li>
                <li>Assurance : {formatMoney(result.breakdown.insurance, input.currency)}</li>
                <li>Packaging : {formatMoney(result.breakdown.packaging, input.currency)}</li>
                <li>Commissionnaire : {formatMoney(result.breakdown.brokerage, input.currency)}</li>
                <li>Divers : {formatMoney(result.breakdown.misc, input.currency)}</li>
                <li>Droits : {formatMoney(result.breakdown.duties, input.currency)}</li>
                <li>TVA : {formatMoney(result.breakdown.vat, input.currency)}</li>
              </ul>
            </div>

            <div>
              <div className="text-sm font-semibold">Avertissements</div>
              {result.warnings?.length ? (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-200">
                  {result.warnings.map((warning, idx) => (
                    <li key={`${warning}-${idx}`}>{warning}</li>
                  ))}
                </ul>
              ) : (
                <div className="mt-2 text-sm text-slate-200">Aucun avertissement.</div>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => navigate("/contact")}>Demander un audit export</Button>
              <Button variant="secondary" onClick={copyLink}>
                {copied ? "Lien copié ✅" : "Copier le lien"}
              </Button>
            </div>

            <div className="text-xs text-slate-300">
              Astuce : le bouton “Copier le lien” génère un lien avec un payload intégré (paramètre <span className="font-mono">?p=</span>)
              pour qu’il fonctionne sur un autre navigateur.
            </div>
          </CardContent>
        </Card>
      </div>
    </PublicLayout>
  );
}
