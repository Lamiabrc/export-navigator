import * as React from "react";
import { useLocation } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

type CallbackLeadModalProps = {
  triggerLabel: string;
  triggerClassName?: string;
  triggerVariant?: "default" | "secondary" | "outline" | "ghost" | "link" | "destructive";
  triggerSize?: "default" | "sm" | "lg" | "icon";
};

type FormState = {
  phone: string;
  email: string;
  country_iso2: string;
  message: string;
  preferred_time: "today" | "tomorrow" | "this_week" | "";
  consent: boolean;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const EMPTY_FORM: FormState = {
  phone: "",
  email: "",
  country_iso2: "",
  message: "",
  preferred_time: "",
  consent: false,
};

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

function normalizeIso2(value: string) {
  const iso = value.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(iso) ? iso : "";
}

function parseGaClientIdFromCookie() {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(/(?:^|;\s*)_ga=GA\d+\.\d+\.(\d+\.\d+)/i);
  return match?.[1] || "";
}

export function CallbackLeadModal({
  triggerLabel,
  triggerClassName,
  triggerVariant = "secondary",
  triggerSize = "sm",
}: CallbackLeadModalProps) {
  const { toast } = useToast();
  const location = useLocation();
  const { user } = useAuth();

  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [form, setForm] = React.useState<FormState>(EMPTY_FORM);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();

    const phone = form.phone.trim();
    const email = form.email.trim().toLowerCase();
    const countryIso2 = normalizeIso2(form.country_iso2);

    if (!phone || phone.length < 6) {
      toast({ title: "Telephone requis", description: "Ajoutez un numero valide pour etre rappelee." });
      return;
    }

    if (!EMAIL_RE.test(email)) {
      toast({ title: "Email invalide", description: "Verifiez l'email saisi." });
      return;
    }

    if (!form.consent) {
      toast({ title: "Consentement requis", description: "Cochez la case pour etre contactee." });
      return;
    }

    const pageUrl = typeof window !== "undefined" ? window.location.href : `${location.pathname}${location.search}`;
    const params = new URLSearchParams(location.search);

    const payload = {
      phone,
      email,
      country_iso2: countryIso2 || null,
      message: form.message.trim() || null,
      preferred_time: form.preferred_time || null,
      consent: true,
      source: "cta_callback",
      page_url: pageUrl,
      utm_source: params.get("utm_source") || null,
      utm_medium: params.get("utm_medium") || null,
      utm_campaign: params.get("utm_campaign") || null,
      ga_client_id: parseGaClientIdFromCookie() || null,
      user_id: user?.id || null,
    };

    setLoading(true);
    try {
      const response = await fetch("/api/lead-callback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await response.json().catch(() => null)) as { ok?: boolean; detail?: string } | null;
      if (!response.ok || !data?.ok) {
        throw new Error(data?.detail || "Impossible d'enregistrer la demande.");
      }

      if (typeof window !== "undefined" && typeof window.gtag === "function") {
        window.gtag("event", "request_callback", {
          source: "cta_callback",
          country: countryIso2 || "N/A",
        });
      }

      toast({
        title: "Demande enregistree",
        description: "Merci. Nous vous rappelons sous 24h ouvrees.",
      });

      setForm(EMPTY_FORM);
      setOpen(false);
    } catch (error: any) {
      toast({
        title: "Erreur envoi",
        description: error?.message || "Impossible de finaliser la demande maintenant.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={triggerVariant} size={triggerSize} className={triggerClassName}>
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[540px]">
        <DialogHeader>
          <DialogTitle>Demander un rappel</DialogTitle>
          <DialogDescription>
            30 secondes. Laissez vos coordonnees, nous vous rappelons rapidement.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={submit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="callback-phone">Telephone *</Label>
              <Input
                id="callback-phone"
                placeholder="06 00 00 00 00"
                value={form.phone}
                onChange={(event) => update("phone", event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="callback-email">Email *</Label>
              <Input
                id="callback-email"
                type="email"
                placeholder="vous@entreprise.com"
                value={form.email}
                onChange={(event) => update("email", event.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="callback-country">Pays (ISO2)</Label>
              <Input
                id="callback-country"
                placeholder="FR"
                maxLength={2}
                value={form.country_iso2}
                onChange={(event) => update("country_iso2", event.target.value.toUpperCase())}
              />
            </div>

            <div className="space-y-2">
              <Label>Creneau</Label>
              <Select value={form.preferred_time} onValueChange={(value) => update("preferred_time", value as FormState["preferred_time"])}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Aujourd'hui</SelectItem>
                  <SelectItem value="tomorrow">Demain</SelectItem>
                  <SelectItem value="this_week">Cette semaine</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="callback-message">Besoin en 1 phrase</Label>
            <Textarea
              id="callback-message"
              rows={3}
              placeholder="Ex: exporter produits agro vers Maroc, besoin check TVA/douane"
              value={form.message}
              onChange={(event) => update("message", event.target.value)}
            />
          </div>

          <div className="rounded-md border bg-slate-50 p-3 text-sm text-slate-700">
            Reponse sous 24h ouvrees. WhatsApp possible.
          </div>

          <label className="flex items-start gap-2 text-sm text-muted-foreground">
            <Checkbox
              checked={form.consent}
              onCheckedChange={(checked) => update("consent", checked === true)}
              className="mt-0.5"
            />
            <span>J'accepte d'etre contactee.</span>
          </label>

          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading ? "Envoi..." : "Demander un rappel"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
