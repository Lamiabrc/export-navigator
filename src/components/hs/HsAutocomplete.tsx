import * as React from "react";
import { Loader2, WandSparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

type HsItem = { hs6: string; label_fr: string; score?: number };

type Props = {
  value: string;
  onChange: (next: string) => void;
  productContext?: string;
};

export function HsAutocomplete({ value, onChange, productContext }: Props) {
  const [query, setQuery] = React.useState(value);
  const [items, setItems] = React.useState<HsItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [wizardLoading, setWizardLoading] = React.useState(false);

  React.useEffect(() => setQuery(value), [value]);

  React.useEffect(() => {
    const q = query.trim();
    const t = setTimeout(async () => {
      setLoading(true);
      const { data } = await supabase.functions.invoke<{ items?: HsItem[] }>("hs-suggest", {
        body: { query: q, limit: 8 },
      });
      setItems(data?.items || []);
      setLoading(false);
    }, 240);
    return () => clearTimeout(t);
  }, [query]);

  const askWizard = async () => {
    setWizardLoading(true);
    const wizardPrompt = `Je ne connais pas mon HS. Produit: ${productContext || "non renseigné"}. Donne 3 propositions JSON [{hs6,reason}]`;
    const { data } = await supabase.functions.invoke<{ reply?: string }>("chat-free", {
      body: { message: wizardPrompt, context: { product: productContext } },
    });
    const text = data?.reply || "";
    const found = text.match(/\b\d{6}\b/);
    if (found) onChange(found[0]);
    setWizardLoading(false);
  };

  return (
    <div className="space-y-2">
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Rechercher un code HS (6 chiffres)"
      />
      {loading ? <p className="text-xs text-slate-500"><Loader2 className="mr-1 inline size-3 animate-spin" /> Recherche...</p> : null}
      <div className="max-h-40 space-y-1 overflow-auto rounded-md border border-slate-200 p-2">
        {items.map((item) => (
          <button
            key={`${item.hs6}-${item.label_fr}`}
            type="button"
            className={`w-full rounded-md px-2 py-1 text-left text-xs ${value === item.hs6 ? "bg-primary/10 text-primary" : "hover:bg-slate-100"}`}
            onClick={() => onChange(item.hs6)}
          >
            <span className="font-semibold">{item.hs6}</span> — {item.label_fr}
          </button>
        ))}
        {!items.length && !loading ? <p className="text-xs text-slate-500">Aucun code trouvé.</p> : null}
      </div>
      <Button type="button" variant="outline" size="sm" onClick={askWizard} disabled={wizardLoading} className="w-full">
        {wizardLoading ? <Loader2 className="mr-2 size-3 animate-spin" /> : <WandSparkles className="mr-2 size-3" />}
        Je ne sais pas mon HS
      </Button>
    </div>
  );
}
