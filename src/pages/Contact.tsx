import * as React from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, ShieldCheck } from "lucide-react";

import { MarketingLayout } from "@/components/marketing/MarketingLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { usePageMeta } from "@/hooks/usePageMeta";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type ContactFormState = {
  firstName: string;
  email: string;
  company: string;
  countries: string;
  flowType: "import" | "export" | "both";
  subject: "Audit procédures" | "Risques fiscaux TVA" | "Douane & documents" | "Paiement & Incoterms" | "Autre";
  message: string;
};

const DEFAULT_FORM: ContactFormState = {
  firstName: "",
  email: "",
  company: "",
  countries: "",
  flowType: "both",
  subject: "Audit procédures",
  message: "",
};

export default function Contact() {
  usePageMeta("meta.contact.title", "meta.contact.description", { brandSuffix: "Export Navigator" });

  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [submitted, setSubmitted] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  const [form, setForm] = React.useState<ContactFormState>(() => {
    const offer = searchParams.get("offer");
    if (!offer) return DEFAULT_FORM;
    const map: Record<string, ContactFormState["subject"]> = {
      diagnostic: "Audit procédures",
      audit: "Audit procédures",
      compliance: "Risques fiscaux TVA",
      douane: "Douane & documents",
      paiement: "Paiement & Incoterms",
    };
    return { ...DEFAULT_FORM, subject: map[offer] ?? "Autre" };
  });

  const update = <K extends keyof ContactFormState>(key: K, value: ContactFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!form.firstName.trim() || !form.email.trim() || !form.message.trim()) {
      toast({
        title: "Champs requis",
        description: "Nom, email et message sont obligatoires.",
      });
      return;
    }

    if (!EMAIL_RE.test(form.email.trim())) {
      toast({
        title: "Email invalide",
        description: "Merci de vérifier votre adresse email.",
      });
      return;
    }

    setLoading(true);

    try {
      const payload = {
        firstName: form.firstName,
        email: form.email,
        company: form.company,
        subject: form.subject,
        topic: form.subject,
        offerType: form.flowType,
        scenarioSummary: form.countries,
        source: "contact-audit-page",
        locale: "fr-FR",
        message: [
          `Pays/zones: ${form.countries || "non précisé"}`,
          `Type de flux: ${form.flowType}`,
          "",
          form.message,
        ].join("\n"),
      };

      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new Error(detail || "Envoi impossible");
      }

      setSubmitted(true);
      toast({
        title: "Demande envoyée",
        description: "Merci, on revient vers vous sous 24/48h ouvrées.",
      });
    } catch (error: any) {
      toast({
        title: "Erreur d’envoi",
        description: error?.message || "Impossible d’envoyer votre demande pour le moment.",
      });
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <MarketingLayout>
        <section className="mkt-section mkt-section-hero">
          <div className="mkt-container">
            <Card className="mx-auto max-w-2xl border-slate-200">
              <CardContent className="space-y-4 p-8 text-center">
                <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-100">
                  <CheckCircle2 className="size-7 text-emerald-600" />
                </div>
                <h1 className="text-3xl font-semibold text-slate-900">Merci, demande bien reçue.</h1>
                <p className="text-slate-600">On revient vers vous sous 24/48h ouvrées.</p>
                <div className="flex flex-wrap justify-center gap-3">
                  <Button asChild>
                    <Link to="/">Retour à l’accueil</Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link to="/register">S’inscrire gratuitement</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </MarketingLayout>
    );
  }

  return (
    <MarketingLayout>
      <section className="mkt-section mkt-section-hero">
        <div className="mkt-container grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-5">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">Contact</p>
            <h1 className="text-4xl font-semibold text-slate-900 sm:text-5xl">Contact — Demander un état des lieux</h1>
            <p className="max-w-2xl text-base leading-relaxed text-slate-600">
              Décrivez vos flux import/export. Nous analysons vos procédures, vos risques TVA/douane et vous remettons
              un plan d’amélioration opérationnel.
            </p>

            <Card className="border-slate-200 bg-slate-50">
              <CardHeader>
                <CardTitle className="text-base">Ce que vous recevrez</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-slate-700">
                <p>• Synthèse des risques</p>
                <p>• Plan d’amélioration</p>
                <p>• Prochaines étapes</p>
              </CardContent>
            </Card>

            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ShieldCheck className="size-4 text-primary" /> Confidentialité
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-600">
                Vos données sont traitées de manière confidentielle, accessibles uniquement selon des droits stricts,
                et supprimables à tout moment.
              </CardContent>
            </Card>
          </div>

          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle>Votre demande d’audit</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleSubmit}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">Nom / Prénom</Label>
                    <Input
                      id="firstName"
                      value={form.firstName}
                      onChange={(e) => update("firstName", e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={form.email}
                      onChange={(e) => update("email", e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="company">Société</Label>
                  <Input id="company" value={form.company} onChange={(e) => update("company", e.target.value)} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="countries">Pays / zones concernées</Label>
                  <Input
                    id="countries"
                    value={form.countries}
                    onChange={(e) => update("countries", e.target.value)}
                    placeholder="Ex: UE, Maghreb, Royaume-Uni"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Type de flux</Label>
                    <Select value={form.flowType} onValueChange={(v: ContactFormState["flowType"]) => update("flowType", v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="import">Import</SelectItem>
                        <SelectItem value="export">Export</SelectItem>
                        <SelectItem value="both">Les deux</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Sujet</Label>
                    <Select value={form.subject} onValueChange={(v: ContactFormState["subject"]) => update("subject", v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Audit procédures">Audit procédures</SelectItem>
                        <SelectItem value="Risques fiscaux TVA">Risques fiscaux TVA</SelectItem>
                        <SelectItem value="Douane & documents">Douane & documents</SelectItem>
                        <SelectItem value="Paiement & Incoterms">Paiement & Incoterms</SelectItem>
                        <SelectItem value="Autre">Autre</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message">Message</Label>
                  <Textarea
                    id="message"
                    value={form.message}
                    onChange={(e) => update("message", e.target.value)}
                    rows={5}
                    required
                    placeholder="Décrivez vos blocages, vos objectifs et votre contexte opérationnel."
                  />
                </div>

                <div className="space-y-3 pt-2">
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Envoi..." : "Nous contacter"}
                  </Button>
                  <Button type="button" variant="outline" className="w-full" asChild>
                    <Link to="/register">S’inscrire gratuitement</Link>
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </section>
    </MarketingLayout>
  );
}
