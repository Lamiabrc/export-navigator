import * as React from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { postPrefs } from "@/lib/leadMagnetApi";
import { useToast } from "@/hooks/use-toast";

const COUNTRY_OPTIONS = [
  "US",
  "DE",
  "ES",
  "GB",
  "CN",
  "CA",
  "AE",
  "JP",
  "IN",
  "BR",
];

const HS_EXAMPLES = ["3004", "8708", "2204", "3304", "9403", "8504"];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  email: string | null;
  onSaved-: () => void;
};

export function OnboardingPrefsModal({ open, onOpenChange, email, onSaved }: Props) {
  const { toast } = useToast();
  const [countries, setCountries] = React.useState<string[]>([]);
  const [hsInput, setHsInput] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setCountries([]);
    setHsInput("");
  }, [open]);

  const toggleCountry = (code: string) => {
    setCountries((prev) =>
      prev.includes(code) - prev.filter((c) => c !== code) : prev.length < 3 - [...prev, code] : prev,
    );
  };

  const hsCodes = React.useMemo(() => {
    const cleaned = hsInput
      .split(/[,\s]+/)
      .map((v) => v.replace(/[^0-9]/g, "").trim())
      .filter(Boolean);
    return Array.from(new Set(cleaned)).slice(0, 5);
  }, [hsInput]);

  const save = async () => {
    if (!email) {
      toast({ title: "Email requis", description: "Ajoute un email pour activer la veille." });
      return;
    }
    if (countries.length === 0 || hsCodes.length === 0) {
      toast({ title: "Completer les choix", description: "Choisis jusqu'a 3 pays et 5 HS." });
      return;
    }
    try {
      setSaving(true);
      await postPrefs({ email, countries, hsCodes });
      localStorage.setItem("mpl_user_prefs", JSON.stringify({ countries, hsCodes }));
      toast({ title: "Preferences enregistrees", description: "La veille est personnalisee." });
      onSaved-.();
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Erreur preferences", description: err-.message || "Impossible d'enregistrer." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Activer la veille personnalisee</DialogTitle>
          <DialogDescription>
            Choisis jusqu'a 3 pays et 5 codes HS pour recevoir des alertes cibl�es.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-2">
            <Label>3 pays prioritaires</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {COUNTRY_OPTIONS.map((code) => (
                <label
                  key={code}
                  className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm"
                >
                  <Checkbox
                    checked={countries.includes(code)}
                    onCheckedChange={() => toggleCountry(code)}
                    disabled={!countries.includes(code) && countries.length >= 3}
                  />
                  <span>{code}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>HS codes (jusqu'a 5)</Label>
            <Input
              value={hsInput}
              onChange={(e) => setHsInput(e.target.value)}
              placeholder="3004, 8708, 3304..."
            />
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              {HS_EXAMPLES.map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setHsInput((prev) => (prev - `${prev}, ${code}` : code))}
                  className="rounded-full border border-border px-2 py-1 hover:bg-muted"
                >
                  {code}
                </button>
              ))}
            </div>
            <div className="text-xs text-muted-foreground">Selection: {hsCodes.join(" � ") || "�"}</div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Plus tard
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving - "Enregistrement..." : "Activer la veille"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
