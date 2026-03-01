import * as React from "react";
import { Link, useLocation } from "react-router-dom";
import { Plus, ShieldCheck } from "lucide-react";

import { AppLayout } from "@/components/layout/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/contexts/LanguageContext";
import { COUNTRIES, getCountryLabel } from "@/lib/constants";
import { createDeal, dealStageOrder, listAccountsForSelect, listDeals, type CrmAccount, type CrmDeal, type DealStage } from "@/services/crm";

type NewDealForm = {
  title: string;
  account_id: string;
  amount: string;
  currency: string;
  from_country: string;
  to_country: string;
  product_text: string;
  incoterm: string;
  notes: string;
};

const EMPTY_FORM: NewDealForm = {
  title: "",
  account_id: "none",
  amount: "",
  currency: "EUR",
  from_country: "FR",
  to_country: "",
  product_text: "",
  incoterm: "",
  notes: "",
};

function stageLabel(stage: DealStage, lang: "fr" | "en") {
  const map: Record<DealStage, { fr: string; en: string }> = {
    new: { fr: "Nouveau", en: "New" },
    qualified: { fr: "Qualifie", en: "Qualified" },
    proposal: { fr: "Proposition", en: "Proposal" },
    negotiation: { fr: "Negociation", en: "Negotiation" },
    won: { fr: "Gagne", en: "Won" },
    lost: { fr: "Perdu", en: "Lost" },
  };
  return map[stage][lang];
}

function stageTone(stage: DealStage) {
  if (stage === "won") return "bg-emerald-100 text-emerald-900 border-emerald-200";
  if (stage === "lost") return "bg-rose-100 text-rose-900 border-rose-200";
  if (stage === "negotiation") return "bg-amber-100 text-amber-900 border-amber-200";
  return "bg-blue-100 text-blue-900 border-blue-200";
}

function money(value: number, currency: string, lang: "fr" | "en") {
  return new Intl.NumberFormat(lang === "en" ? "en-US" : "fr-FR", {
    style: "currency",
    currency: currency || "EUR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

export default function DealsBoard() {
  const { lang } = useI18n();
  const uiLang = lang === "en" ? "en" : "fr";
  const location = useLocation();

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [warning, setWarning] = React.useState<string | null>(null);
  const [deals, setDeals] = React.useState<CrmDeal[]>([]);
  const [accounts, setAccounts] = React.useState<CrmAccount[]>([]);
  const [creating, setCreating] = React.useState(false);
  const [form, setForm] = React.useState<NewDealForm>(EMPTY_FORM);

  const copy = React.useMemo(
    () =>
      uiLang === "en"
        ? {
            title: "Deals Pipeline",
            subtitle: "Light CRM for sales + compliance. Create a deal and secure it in one click.",
            create: "Create deal",
            reset: "Reset",
            secure: "Secure deal",
            account: "Account",
            amount: "Amount",
            currency: "Currency",
            from: "From",
            to: "To",
            product: "Product",
            incoterm: "Incoterm",
            notes: "Notes",
            titleField: "Deal title",
            empty: "No deals in this stage yet.",
          }
        : {
            title: "Pipeline des deals",
            subtitle: "CRM leger ventes + conformite. Creez un deal puis securisez-le en un clic.",
            create: "Creer le deal",
            reset: "Reinitialiser",
            secure: "Securiser le deal",
            account: "Compte",
            amount: "Montant",
            currency: "Devise",
            from: "Origine",
            to: "Destination",
            product: "Produit",
            incoterm: "Incoterm",
            notes: "Notes",
            titleField: "Titre du deal",
            empty: "Aucun deal dans cette etape.",
          },
    [uiLang]
  );

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [dealRes, accountRes] = await Promise.all([listDeals(), listAccountsForSelect()]);
      setDeals(dealRes.deals);
      setAccounts(accountRes);
      setWarning(dealRes.warning || null);
    } catch (err) {
      setError((err as Error)?.message || "Load error");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    const params = new URLSearchParams(location.search);
    const toCountry = String(params.get("to") || "").trim().toUpperCase();
    if (!toCountry || !COUNTRIES.some((country) => country.iso2 === toCountry)) return;
    setForm((prev) => ({ ...prev, to_country: toCountry }));
  }, [location.search]);

  const grouped = React.useMemo(() => {
    const map = new Map<DealStage, CrmDeal[]>();
    for (const stage of dealStageOrder) {
      map.set(stage, []);
    }
    for (const deal of deals) {
      const list = map.get(deal.stage) || [];
      list.push(deal);
      map.set(deal.stage, list);
    }
    return map;
  }, [deals]);

  const submitDeal = async () => {
    if (!form.title.trim()) return;
    setCreating(true);
    setError(null);
    try {
      await createDeal({
        title: form.title.trim(),
        account_id: form.account_id === "none" ? null : form.account_id,
        amount: Number(form.amount || 0),
        currency: form.currency || "EUR",
        from_country: form.from_country || "FR",
        to_country: form.to_country || null,
        product_text: form.product_text || null,
        incoterm: form.incoterm || null,
        notes: form.notes || null,
      });
      setForm(EMPTY_FORM);
      await load();
    } catch (err) {
      setError((err as Error)?.message || "Create failed");
    } finally {
      setCreating(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-4">
        <Card className="border-blue-100 bg-white/95">
          <CardHeader>
            <CardTitle>{copy.title}</CardTitle>
            <CardDescription>{copy.subtitle}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {warning ? <p className="text-xs text-amber-700">{warning}</p> : null}
            {error ? <p className="text-xs text-rose-700">{error}</p> : null}
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="space-y-1">
                <Label>{copy.titleField}</Label>
                <Input
                  value={form.title}
                  onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                  placeholder={uiLang === "en" ? "Ex: Export footwear to Brazil" : "Ex: Export sandales vers Bresil"}
                />
              </div>
              <div className="space-y-1">
                <Label>{copy.account}</Label>
                <Select value={form.account_id} onValueChange={(value) => setForm((prev) => ({ ...prev, account_id: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder={copy.account} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-</SelectItem>
                    {accounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>{copy.amount}</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.amount}
                  onChange={(event) => setForm((prev) => ({ ...prev, amount: event.target.value }))}
                  placeholder="0"
                />
              </div>
              <div className="space-y-1">
                <Label>{copy.currency}</Label>
                <Input
                  value={form.currency}
                  onChange={(event) => setForm((prev) => ({ ...prev, currency: event.target.value.toUpperCase().slice(0, 3) }))}
                  placeholder="EUR"
                />
              </div>
              <div className="space-y-1">
                <Label>{copy.from}</Label>
                <Select value={form.from_country || "FR"} onValueChange={(value) => setForm((prev) => ({ ...prev, from_country: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder={copy.from} />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map((country) => (
                      <SelectItem key={`from-${country.iso2}`} value={country.iso2}>
                        {uiLang === "en" ? country.label_en : country.label_fr} ({country.iso2})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>{copy.to}</Label>
                <Select value={form.to_country || "none"} onValueChange={(value) => setForm((prev) => ({ ...prev, to_country: value === "none" ? "" : value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder={copy.to} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-</SelectItem>
                    {COUNTRIES.map((country) => (
                      <SelectItem key={`to-${country.iso2}`} value={country.iso2}>
                        {uiLang === "en" ? country.label_en : country.label_fr} ({country.iso2})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>{copy.product}</Label>
                <Input
                  value={form.product_text}
                  onChange={(event) => setForm((prev) => ({ ...prev, product_text: event.target.value }))}
                  placeholder={uiLang === "en" ? "Product text" : "Description produit"}
                />
              </div>
              <div className="space-y-1">
                <Label>{copy.incoterm}</Label>
                <Input
                  value={form.incoterm}
                  onChange={(event) => setForm((prev) => ({ ...prev, incoterm: event.target.value.toUpperCase().slice(0, 3) }))}
                  placeholder="EXW/FOB/CIF..."
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>{copy.notes}</Label>
              <Textarea value={form.notes} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} rows={2} />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={submitDeal} disabled={creating || !form.title.trim()}>
                <Plus className="mr-2 h-4 w-4" />
                {copy.create}
              </Button>
              <Button variant="outline" onClick={() => setForm(EMPTY_FORM)} disabled={creating}>
                {copy.reset}
              </Button>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              {uiLang === "en" ? "Loading deals..." : "Chargement des deals..."}
            </CardContent>
          </Card>
        ) : null}

        {!loading ? (
          <div className="grid gap-3 xl:grid-cols-6">
            {dealStageOrder.map((stage) => (
              <Card key={stage} className="border-blue-100 bg-white/95">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{stageLabel(stage, uiLang)}</CardTitle>
                  <CardDescription>
                    {grouped.get(stage)?.length || 0} {uiLang === "en" ? "deal(s)" : "deal(s)"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {(grouped.get(stage) || []).map((deal) => (
                    <article key={deal.id} className="rounded-xl border border-border bg-card p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-sm font-semibold leading-tight">{deal.title}</h3>
                        <Badge className={stageTone(stage)}>{stageLabel(stage, uiLang)}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{deal.account_name || "-"}</p>
                      <div className="flex items-center justify-between text-xs">
                        <span>{money(deal.amount, deal.currency, uiLang)}</span>
                        <span>{getCountryLabel(deal.to_country, uiLang)}</span>
                      </div>
                      <Button asChild size="sm" className="w-full">
                        <Link to={`/app/deals/${deal.id}`}>
                          <ShieldCheck className="mr-2 h-4 w-4" />
                          {copy.secure}
                        </Link>
                      </Button>
                    </article>
                  ))}
                  {!grouped.get(stage)?.length ? <p className="text-xs text-muted-foreground">{copy.empty}</p> : null}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : null}
      </div>
    </AppLayout>
  );
}
