import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { postPrefs } from "@/lib/leadMagnetApi";
import { useToast } from "@/hooks/use-toast";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  email: string | null;
  onSaved?: () => void;
};

type TradeDirection = "export_fr" | "import_fr" | "both";

type CountryOption = { code: string; label: string };

const COUNTRIES: CountryOption[] = [
  { code: "US", label: "États-Unis" },
  { code: "DE", label: "Allemagne" },
  { code: "ES", label: "Espagne" },
  { code: "IT", label: "Italie" },
  { code: "NL", label: "Pays-Bas" },
  { code: "BE", label: "Belgique" },
  { code: "CH", label: "Suisse" },
  { code: "GB", label: "Royaume-Uni" },
  { code: "TR", label: "Turquie" },
  { code: "MA", label: "Maroc" },
  { code: "DZ", label: "Algérie" },
  { code: "TN", label: "Tunisie" },
  { code: "CN", label: "Chine" },
  { code: "JP", label: "Japon" },
  { code: "KR", label: "Corée du Sud" },
  { code: "IN", label: "Inde" },
  { code: "AE", label: "Émirats arabes unis" },
  { code: "SA", label: "Arabie saoudite" },
  { code: "CA", label: "Canada" },
  { code: "BR", label: "Brésil" },
  { code: "MX", label: "Mexique" },
  { code: "ZA", label: "Afrique du Sud" },
  { code: "AU", label: "Australie" },
];

const HS_EXAMPLES = ["3004", "8708", "2204", "3304", "9403", "8504"];

// 2 / 4 / 6 chiffres (chapitre/position/sous-position) => suffisant en veille.
// (Tu peux durcir plus tard)
function isValidHs(code: string) {
  return /^\d{2}(\d{2})?(\d{2})?$/.test(code);
}

function normalizeCode(v: string) {
  return (v || "").trim().toUpperCase();
}

export function OnboardingPrefsModal({ open, onOpenChange, email, onSaved }: Props) {
  const { toast } = useToast();

  const [direction, setDirection] = React.useState<TradeDirection>("both");

  // Pays obligatoires
  const [countryQuery, setCountryQuery] = React.useState("");
  const [countries, setCountries] = React.useState<string[]>([]); // max 3

  // Produits optionnels
  const [hsInput, setHsInput] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;

    // Restore prefs
    try {
      const raw = localStorage.getItem("mpl_user_prefs");
      if (raw) {
        const parsed = JSON.parse(raw);
        const restoredDirection = (parsed?.direction as TradeDirection) || "both";
        const restoredCountries = Array.isArray(parsed?.countries) ? parsed.countries : [];
        const restoredHs = Array.isArray(parsed?.hsCodes) ? parsed.hsCodes : [];

        setDirection(restoredDirection);
        setCountries(restoredCountries.map((c: string) => normalizeCode(c)).slice(0, 3));
        setHsInput(restoredHs.slice(0, 10).join(", "));
        setCountryQuery("");
        return;
      }
    } catch {
      // ignore
    }

    // Defaults
    setDirection("both");
    setCountries([]);
    setHsInput("");
    setCountryQuery("");
  }, [open]);

  const toggleCountry = (code: string) => {
    const c = normalizeCode(code);
    setCountries((prev) => {
      if (prev.includes(c)) return prev.filter((x) => x !== c);
      if (prev.length >= 3) return prev;
      return [...prev, c];
    });
  };

  const hsCodes = React.useMemo(() => {
    const cleaned = hsInput
      .split(/[,\s]+/)
      .map((v) => v.replace(/[^0-9]/g, "").trim())
      .filter(Boolean);

    const valid = cleaned.filter(isValidHs);
    return Array.from(new Set(valid)).slice(0, 10);
  }, [hsInput]);

  const invalidHs = React.useMemo(() => {
    const cleaned = hsInput
      .split(/[,\s]+/)
      .map((v) => v.replace(/[^0-9]/g, "").trim())
      .filter(Boolean);

    const bad = cleaned.filter((c) => c && !isValidHs(c));
    return Array.from(new Set(bad)).slice(0, 5);
  }, [hsInput]);

  const filteredCountries = React.useMemo(() => {
    const q = countryQuery.trim().toLowerCase();
    if (!q) return COUNTRIES.slice(0, 12);
    return COUNTRIES
      .filter((c) => c.code.toLowerCase().includes(q) || c.label.toLowerCase().includes(q))
      .slice(0, 18);
  }, [countryQuery]);

  const directionLabel: Record<TradeDirection, string> = {
    export_fr: "Export (France → Monde)",
    import_fr: "Import (Monde → France)",
    both: "Import & Export",
  };

  const selectedCountryLabels = React.useMemo(() => {
    const byCode = new Map(COUNTRIES.map((x) => [x.code, x.label]));
    return countries.map((c) => `${byCode.get(c) ?? c} (${c})`);
  }, [countries]);

  const save = async () => {
    if (!email) {
      toast({
        title: "Email requis",
        description: "Ajoute un email pour activer la veille.",
      });
      return;
    }

    // ✅ Pays obligatoire
    if (countries.length === 0) {
      toast({
        title: "Destination requise",
        description:
          "L’import/export dépend des relations, accords commerciaux, sanctions, douanes et règles locales. Pour une veille utile, indique au moins un pays cible.",
      });
      return;
    }

    // ✅ Produits optionnel
    // Si HS vide => conditions générales (on envoie hsCodes: [])
    const payloadHs = hsCodes; // peut être []

    try {
      setSaving(true);

      await postPrefs({ email, countries, hsCodes: payloadHs });

      localStorage.setItem(
        "mpl_user_prefs",
        JSON.stringify({
          direction,
          countries,
          hsCodes: payloadHs,
          hsMode: payloadHs.length ? "products" : "general_conditions",
        }),
      );

      toast({
        title: "Préférences enregistrées",
        description: `${directionLabel[direction]} · ${countries.length} pays · ${
          payloadHs.length ? `${payloadHs.length} HS` : "Conditions générales (tous produits)"
        }.`,
      });

      onSaved?.();
      onOpenChange(false);
    } catch (err: any) {
      toast({
        title: "Erreur",
        description: err?.message || "Impossible d’enregistrer pour le moment.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Activer la veille personnalisée</DialogTitle>
          <DialogDescription>
            France est le centre. Pour te donner une veille exploitable (traités, sanctions, douanes), on a besoin d’au moins un pays cible.
            Les produits (HS) sont optionnels : sans HS, on te fournit les conditions générales applicables.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Direction */}
          <div className="space-y-2">
            <Label>Sens des flux</Label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Button
                type="button"
                variant={direction === "export_fr" ? "default" : "secondary"}
                onClick={() => setDirection("export_fr")}
                className="justify-start"
              >
                Export
              </Button>
              <Button
                type="button"
                variant={direction === "import_fr" ? "default" : "secondary"}
                onClick={() => setDirection("import_fr")}
                className="justify-start"
              >
                Import
              </Button>
              <Button
                type="button"
                variant={direction === "both" ? "default" : "secondary"}
                onClick={() => setDirection("both")}
                className="justify-start"
              >
                Les deux
              </Button>
            </div>
            <div className="text-xs text-muted-foreground">{directionLabel[direction]}</div>
          </div>

          {/* Pays obligatoires */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label>Pays (obligatoire) — jusqu’à 3</Label>
              <div className="text-xs text-muted-foreground">Choisis des pays prioritaires</div>
            </div>

            <Input
              value={countryQuery}
              onChange={(e) => setCountryQuery(e.target.value)}
              placeholder="Rechercher un pays (ex : US, Chine, Allemagne…)"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {filteredCountries.map((c) => {
                const active = countries.includes(c.code);
                const disabled = !active && countries.length >= 3;

                return (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => toggleCountry(c.code)}
                    disabled={disabled}
                    className={[
                      "text-left rounded-lg border px-3 py-2 text-sm transition disabled:opacity-50 disabled:cursor-not-allowed",
                      active ? "border-primary bg-primary/10" : "border-border hover:bg-muted",
                    ].join(" ")}
                  >
                    <div className="truncate font-medium">{c.label}</div>
                    <div className="text-xs text-muted-foreground">{c.code}</div>
                  </button>
                );
              })}
            </div>

            <div className="text-xs text-muted-foreground">
              Sélection : {selectedCountryLabels.length ? selectedCountryLabels.join(" · ") : "-"}
            </div>
          </div>

          {/* Produits optionnels */}
          <div className="space-y-2">
            <Label>Produits (optionnel)</Label>
            <Input
              value={hsInput}
              onChange={(e) => setHsInput(e.target.value)}
              placeholder="HS (optionnel) : 2 / 4 / 6 chiffres (ex : 22, 2204, 300490)"
            />

            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              {HS_EXAMPLES.map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setHsInput((prev) => (prev ? `${prev}, ${code}` : code))}
                  className="rounded-full border border-border px-2 py-1 hover:bg-muted"
                >
                  {code}
                </button>
              ))}
            </div>

            <div className="text-xs text-muted-foreground">
              {hsCodes.length ? (
                <>Sélection HS : <span className="font-medium text-foreground/90">{hsCodes.join(" · ")}</span></>
              ) : (
                <>Aucun HS → <span className="font-semibold">conditions générales</span> (tous produits, documents, TVA, douane, Incoterms, risques).</>
              )}
            </div>

            {invalidHs.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
                Ignorés (format invalide) : <span className="font-semibold">{invalidHs.join(", ")}</span>. Utilise 2, 4 ou 6 chiffres.
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Plus tard
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Enregistrement…" : "Activer la veille"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
