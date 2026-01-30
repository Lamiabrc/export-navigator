import React from "react";
import { useParams } from "react-router-dom";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

function readShare(id: string) {
  try {
    const raw = localStorage.getItem(SHARE_KEY);
    if (!raw) return null;
    const store = JSON.parse(raw) as Record<string, SharePayload>;
    return store?.[id] ?? null;
  } catch {
    return null;
  }
}

export default function ShareDecision() {
  const { id } = useParams();
  const [payload, setPayload] = React.useState<SharePayload | null>(null);

  React.useEffect(() => {
    if (!id) return;
    setPayload(readShare(id));
  }, [id]);

  if (!id) {
    return (
      <PublicLayout>
        <Card className="border border-white/15 bg-white/10 text-white backdrop-blur">
          <CardHeader>
            <CardTitle>Lien invalide</CardTitle>
            <CardDescription className="text-slate-200">Aucun identifiant fourni.</CardDescription>
          </CardHeader>
        </Card>
      </PublicLayout>
    );
  }

  if (!payload) {
    return (
      <PublicLayout>
        <Card className="border border-white/15 bg-white/10 text-white backdrop-blur">
          <CardHeader>
            <CardTitle>Lien expire ou introuvable</CardTitle>
            <CardDescription className="text-slate-200">
              Le scenario partage n'est plus disponible sur ce navigateur.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => (window.location.href = "/analyse")}>Recreer une analyse</Button>
          </CardContent>
        </Card>
      </PublicLayout>
    );
  }

  const { input, result } = payload;

  return (
    <PublicLayout>
      <div className="space-y-6">
        <Card className="border border-white/15 bg-white/10 text-white backdrop-blur">
          <CardHeader>
            <CardTitle>Fiche Decision partagee</CardTitle>
            <CardDescription className="text-slate-200">
              Cree le {new Date(payload.createdAt).toLocaleDateString("fr-FR")}.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <Badge className="bg-white/10 text-white border-white/20">{input.destination}</Badge>
              <Badge className="bg-white/10 text-white border-white/20">{input.incoterm}</Badge>
              <Badge className="bg-white/10 text-white border-white/20">{input.mode}</Badge>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-white/15 bg-white/5 p-4">
                <div className="text-xs uppercase text-slate-200">Total landed cost</div>
                <div className="text-2xl font-semibold">
                  {formatMoney(result.total, input.currency)}
                </div>
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
                <li>Pre-carriage: {formatMoney(result.breakdown.preCarriage, input.currency)}</li>
                <li>Main freight: {formatMoney(result.breakdown.mainFreight, input.currency)}</li>
                <li>Insurance: {formatMoney(result.breakdown.insurance, input.currency)}</li>
                <li>Packaging: {formatMoney(result.breakdown.packaging, input.currency)}</li>
                <li>Brokerage: {formatMoney(result.breakdown.brokerage, input.currency)}</li>
                <li>Misc: {formatMoney(result.breakdown.misc, input.currency)}</li>
                <li>Duties: {formatMoney(result.breakdown.duties, input.currency)}</li>
                <li>VAT: {formatMoney(result.breakdown.vat, input.currency)}</li>
              </ul>
            </div>

            <div>
              <div className="text-sm font-semibold">Warnings</div>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-200">
                {result.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>

            <Button onClick={() => (window.location.href = "/contact")}>Demander un audit export</Button>
          </CardContent>
        </Card>
      </div>
    </PublicLayout>
  );
}
