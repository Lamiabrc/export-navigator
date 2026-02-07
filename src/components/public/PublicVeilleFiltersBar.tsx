import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type TradeDirection = "export_fr" | "import_fr" | "both";

export type PublicVeilleFilters = {
  direction: TradeDirection;
  country: string | undefined; // code ISO (ex: US, CN, DE)
  hsCodes: string[]; // vide => conditions générales
};

type CountryOption = { code: string; label?: string };

type Props = {
  value: PublicVeilleFilters;
  onChange: (next: PublicVeilleFilters) => void;
  onSubmit?: () => void;
  loading?: boolean;

  // liste pays fournie par toi (idéalement ISO monde)
  countries: CountryOption[];
};

function isValidHs(code: string) {
  // 2/4/6/8/10 chiffres => utile en veille (chapitre/position/sous-position)
  return /^\d{2}(\d{2}){0,4}$/.test(code);
}

export function PublicVeilleFiltersBar({ value, onChange, onSubmit, loading, countries }: Props) {
  const [hsInput, setHsInput] = React.useState("");
  const [allProducts, setAllProducts] = React.useState(true);

  // Recalcule hsCodes à partir du champ
  const hsCodes = React.useMemo(() => {
    if (allProducts) return [];
    const cleaned = hsInput
      .split(/[,\s]+/)
      .map((v) => v.replace(/[^0-9]/g, "").trim())
      .filter(Boolean);
    const valid = cleaned.filter(isValidHs);
    return Array.from(new Set(valid)).slice(0, 10);
  }, [hsInput, allProducts]);

  const invalidHs = React.useMemo(() => {
    if (allProducts) return [];
    const cleaned = hsInput
      .split(/[,\s]+/)
      .map((v) => v.replace(/[^0-9]/g, "").trim())
      .filter(Boolean);
    const bad = cleaned.filter((c) => c && !isValidHs(c));
    return Array.from(new Set(bad)).slice(0, 5);
  }, [hsInput, allProducts]);

  // Push hsCodes up
  React.useEffect(() => {
    if (value.hsCodes.join("|") !== hsCodes.join("|")) {
      onChange({ ...value, hsCodes });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hsCodes.join("|")]);

  const setDirection = (direction: TradeDirection) => onChange({ ...value, direction });

  const setCountry = (country: string | undefined) => onChange({ ...value, country });

  const reset = () => {
    setHsInput("");
    setAllProducts(true);
    onChange({ direction: "both", country: undefined, hsCodes: [] });
  };

  const countryMissing = !value.country;

  return (
    <div className="rounded-xl border border-border bg-card/70 p-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Sens */}
        <div className="space-y-1">
          <Label className="text-xs">Sens</Label>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={value.direction === "export_fr" ? "default" : "secondary"}
              onClick={() => setDirection("export_fr")}
              className="flex-1"
            >
              Export
            </Button>
            <Button
              type="button"
              size="sm"
              variant={value.direction === "import_fr" ? "default" : "secondary"}
              onClick={() => setDirection("import_fr")}
              className="flex-1"
            >
              Import
            </Button>
            <Button
              type="button"
              size="sm"
              variant={value.direction === "both" ? "default" : "secondary"}
              onClick={() => setDirection("both")}
              className="flex-1"
            >
              Les deux
            </Button>
          </div>
          <div className="text-[11px] text-muted-foreground">
            France est le centre : {value.direction === "export_fr" ? "France → Monde" : value.direction === "import_fr" ? "Monde → France" : "Import & Export"}
          </div>
        </div>

        {/* Pays obligatoire */}
        <div className="space-y-1">
          <Label className="text-xs">Pays (obligatoire)</Label>
          <Select
            value={value.country ?? "none"}
            onValueChange={(v) => setCountry(v === "none" ? undefined : v)}
          >
            <SelectTrigger className={cn(countryMissing && "border-amber-300")}>
              <SelectValue placeholder="Choisir un pays…" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value="none">— Choisir —</SelectItem>
              {countries.map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  {c.label ? `${c.label} (${c.code})` : c.code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {countryMissing ? (
            <div className="mt-1 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
              L’import/export dépend des <span className="font-semibold">relations</span>, <span className="font-semibold">traités</span>,
              <span className="font-semibold"> sanctions</span> et règles locales. On doit connaître au moins un pays cible.
            </div>
          ) : (
            <div className="text-[11px] text-muted-foreground">
              On analysera les règles et risques spécifiques à ce pays.
            </div>
          )}
        </div>

        {/* Produits optionnels */}
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-xs">Produits (optionnel)</Label>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Checkbox
                checked={allProducts}
                onCheckedChange={(v) => {
                  const checked = Boolean(v);
                  setAllProducts(checked);
                  if (checked) setHsInput("");
                }}
              />
              Conditions générales
            </label>
          </div>

          <Input
            value={hsInput}
            onChange={(e) => setHsInput(e.target.value)}
            placeholder={allProducts ? "Tous produits (conditions générales)" : "HS : 2/4/6/8/10 chiffres (ex: 22, 2204, 300490)"}
            disabled={allProducts}
          />

          <div className="text-[11px] text-muted-foreground">
            {allProducts || hsCodes.length === 0 ? (
              <>Sans HS : on te donne les <span className="font-semibold">conditions générales</span> (douanes, TVA, Incoterms, docs, risques).</>
            ) : (
              <>HS sélectionnés : <span className="font-semibold">{hsCodes.join(" · ")}</span></>
            )}
          </div>

          {invalidHs.length > 0 && (
            <div className="mt-1 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
              Ignorés (format invalide) : <span className="font-semibold">{invalidHs.join(", ")}</span> — utilise 2/4/6/8/10 chiffres.
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={reset}>
          Réinitialiser
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={onSubmit}
          disabled={loading || countryMissing}
        >
          {loading ? "Analyse…" : "Lancer l’analyse"}
        </Button>
      </div>

      <div className="mt-2 text-[11px] text-muted-foreground">
        Aucune donnée sensible n’est stockée (pas de facture, pas de client). Tes choix servent uniquement à générer une réponse utile.
      </div>
    </div>
  );
}
