import * as React from "react";

import { PublicLayout } from "@/components/layout/PublicLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";

import { supabase, SUPABASE_ENV_OK } from "@/integrations/supabase/client";
import { isMissingTableError } from "@/domain/calc";

type Frequency = "weekly" | "monthly";

function isValidEmail(email: string) {
  // simple & suffisant pour UI
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

const STORAGE_KEY = "mpl:newsletter:subscribers";

export default function Newsletter() {
  const { toast } = useToast();

  const [companyName, setCompanyName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [country, setCountry] = React.useState(""); // libre (FR, US, MQ, etc.)
  const [hs, setHs] = React.useState(""); // libre (ex: 9403)
  const [frequency, setFrequency] = React.useState<Frequency>("weekly");
  const [loading, setLoading] = React.useState(false);
  const [consentChecked, setConsentChecked] = React.useState(false);

  const [serverAvailable, setServerAvailable] = React.useState<boolean | null>(null);
  const [serverWarning, setServerWarning] = React.useState("");

  React.useEffect(() => {
    if (!SUPABASE_ENV_OK) {
      setServerAvailable(false);
      setServerWarning("Inscription serveur indisponible (config). Stockage local active.");
      return;
    }
    setServerAvailable(true);
    setServerWarning("");
  }, []);

  const saveLocal = (payload: any) => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      const list = Array.isArray(arr) ? arr : [];
      const exists = list.some((x: any) => String(x?.email || "").toLowerCase() === payload.email.toLowerCase());
      const next = exists
        ? list.map((x: any) => (String(x?.email || "").toLowerCase() === payload.email.toLowerCase() ? payload : x))
        : [payload, ...list];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next.slice(0, 200)));
    } catch {
      // ignore
    }
  };

  const subscribe = async () => {
    const emailClean = email.trim().toLowerCase();
    const companyClean = companyName.trim();
    const countryClean = country.trim().toUpperCase();
    const hsClean = hs.trim();

    if (!emailClean) {
      toast({ title: "Email requis", description: "Ajoute un email pour recevoir la veille." });
      return;
    }
    if (!isValidEmail(emailClean)) {
      toast({ title: "Email invalide", description: "Verifie l'email saisi." });
      return;
    }
    if (!companyClean) {
      toast({ title: "Entreprise requise", description: "Ajoute le nom de l'entreprise pour finaliser." });
      return;
    }
    if (!consentChecked) {
      toast({ title: "Consentement requis", description: "Merci d'accepter la reception de la newsletter." });
      return;
    }

    setLoading(true);

    const payload = {
      email: emailClean,
      company_name: companyClean,
      frequency,
      country: countryClean || null,
      hs_code: hsClean || null,
      source: "newsletter-page",
      consent: true,
      consented_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };

    try {
      // Si table existe => insertion serveur
      if (serverAvailable === true) {
        const { error } = await supabase.from("newsletter_subscribers").insert({
          email: payload.email,
          company_name: payload.company_name,
          frequency: payload.frequency,
          country: payload.country,
          hs_code: payload.hs_code,
          source: payload.source,
          consent: payload.consent,
          consented_at: payload.consented_at,
          created_at: payload.created_at,
        });

        if (error) {
          if (error.code === "23505") {
            toast({
              title: "Deja inscrit",
              description: "Cet email est deja inscrit a la newsletter.",
            });
            return;
          }
          if (isMissingTableError(error)) {
            setServerAvailable(false);
            setServerWarning("Inscription serveur indisponible (mode demo). Stockage local active.");
            saveLocal(payload);
          } else {
            throw error;
          }
        }
      } else {
        // Mode demo => localStorage
        saveLocal(payload);
      }

      toast({
        title: "Inscription enregistree",
        description:
          frequency === "weekly"
            ? "Tu recevras la veille export hebdo des l'activation."
            : "Tu recevras le brief mensuel des l'activation.",
      });

      setCompanyName("");
      setEmail("");
      setCountry("");
      setHs("");
      setFrequency("weekly");
      setConsentChecked(false);
    } catch (err: any) {
      toast({
        title: "Erreur d'inscription",
        description: err?.message || "Impossible d'enregistrer l'inscription.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <PublicLayout>
      <div className="space-y-8">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-blue-200">Newsletter export</p>
          <h1 className="text-3xl font-semibold text-white">Veille export + brief marché</h1>
          <p className="mt-2 text-sm text-slate-200">
            Des alertes actionnables (sanctions, documents, taxes, contrôles) + un résumé clair.
          </p>
          {serverWarning ? (
            <p className="mt-3 text-xs text-white/70">{serverWarning}</p>
          ) : null}
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="border border-white/15 bg-white/10 text-white shadow-lg backdrop-blur">
            <CardHeader>
              <CardTitle className="text-white">Alerte export hebdo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-200">
              <p>Sanctions, évolutions documentaires, taxes et contrôles par pays/HS.</p>
              <p>Résumé actionnable, 5 minutes de lecture.</p>
              <div className="pt-2">
                <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.25em]">
                  Hebdo
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-white/15 bg-white/10 text-white shadow-lg backdrop-blur">
            <CardHeader>
              <CardTitle className="text-white">Brief mensuel marché</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-200">
              <p>Tendances export France, top destinations, signaux concurrentiels.</p>
              <p>Focus sur vos pays et HS prioritaires.</p>
              <div className="pt-2">
                <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.25em]">
                  Mensuel
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border border-white/15 bg-white/10 text-white shadow-lg backdrop-blur">
          <CardHeader>
            <CardTitle className="text-white">Recevoir la newsletter</CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-[1.1fr_1.4fr_0.8fr_0.8fr]">
              <Input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Entreprise"
                className="border-white/20 bg-white/90 text-slate-900 placeholder:text-slate-500"
              />
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email professionnel"
                className="border-white/20 bg-white/90 text-slate-900 placeholder:text-slate-500"
              />
              <Input
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="Pays / territoire (ex: US, MQ)"
                className="border-white/20 bg-white/90 text-slate-900 placeholder:text-slate-500"
              />
              <Input
                value={hs}
                onChange={(e) => setHs(e.target.value)}
                placeholder="HS code (ex: 9403)"
                className="border-white/20 bg-white/90 text-slate-900 placeholder:text-slate-500"
              />
            </div>

            <label className="flex items-start gap-2 text-xs text-white/80">
              <Checkbox checked={consentChecked} onCheckedChange={(v) => setConsentChecked(Boolean(v))} />
              J'accepte de recevoir la newsletter Export Navigator (desinscription a tout moment).
            </label>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant={frequency === "weekly" ? "default" : "secondary"}
                onClick={() => setFrequency("weekly")}
              >
                Hebdo
              </Button>
              <Button
                type="button"
                variant={frequency === "monthly" ? "default" : "secondary"}
                onClick={() => setFrequency("monthly")}
              >
                Mensuel
              </Button>

              <div className="flex-1" />

              <Button onClick={subscribe} disabled={loading}>
                {loading ? "Enregistrement..." : "S’inscrire"}
              </Button>
            </div>

            <p className="text-xs text-white/70">
              En vous inscrivant, vous acceptez de recevoir nos emails. Désinscription en 1 clic (à l’activation).
            </p>
          </CardContent>
        </Card>

        <Card className="border border-white/15 bg-white/10 text-white shadow-lg backdrop-blur">
          <CardHeader>
            <CardTitle className="text-white">Sources officielles utilisées</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-200">
            <p>OFAC Sanctions List • ONU Consolidated List • EU Sanctions Map</p>
            <p>WITS / UNCTAD TRAINS (tarifs douaniers) • OMC/WTO (actu commerce)</p>
            <p className="text-xs text-white/70">
              Les sources listées sont des repères : elles ne remplacent pas une validation finale par un expert.
            </p>
          </CardContent>
        </Card>
      </div>
    </PublicLayout>
  );
}
