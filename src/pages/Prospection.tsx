import * as React from "react";
import { Link } from "react-router-dom";
import { Check, CheckCircle2, FileText, Mail, ShieldCheck, Sparkles, Target, Users } from "lucide-react";

import { PremiumMarketingLayout } from "@/components/marketing/PremiumMarketingLayout";
import { SectionPremium } from "@/components/marketing/SectionPremium";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type ProspectionFormState = {
  name: string;
  email: string;
  company: string;
  phone: string;
  products: string;
  quantities: string;
  objective: string;
  targetMarkets: string;
  timeline: string;
  exclusivity: "standard" | "exclusive" | "";
  notes: string;
};

const INITIAL_FORM: ProspectionFormState = {
  name: "",
  email: "",
  company: "",
  phone: "",
  products: "",
  quantities: "",
  objective: "",
  targetMarkets: "",
  timeline: "",
  exclusivity: "",
  notes: "",
};

const EXCLUSIVITY_OPTIONS = [
  { value: "", label: "Choisir une option" },
  { value: "standard", label: "Standard (25% de commission)" },
  { value: "exclusive", label: "Exclusivite (15% de commission)" },
];

export default function Prospection() {
  const { toast } = useToast();
  const [form, setForm] = React.useState<ProspectionFormState>(INITIAL_FORM);
  const [loading, setLoading] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);

  const handleChange = (field: keyof ProspectionFormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const buildScenarioSummary = (pageUrl: string | null) => {
    const lines = [
      form.objective ? `Objectif: ${form.objective}` : null,
      form.products ? `Produits: ${form.products}` : null,
      form.quantities ? `Quantites: ${form.quantities}` : null,
      form.targetMarkets ? `Pays/markets cibles: ${form.targetMarkets}` : null,
      form.timeline ? `Echeance: ${form.timeline}` : null,
      form.exclusivity
        ? `Option: ${form.exclusivity === "exclusive" ? "Exclusivite" : "Standard"}`
        : null,
      form.phone ? `Telephone: ${form.phone}` : null,
      pageUrl ? `Page: ${pageUrl}` : null,
    ].filter(Boolean);

    return lines.join("\n");
  };

  const buildMessage = (pageUrl: string | null) => {
    const lines = [
      "Demande de prospection commerciale",
      "",
      "Objectif:",
      form.objective,
      "",
      "Produits:",
      form.products,
      form.quantities ? `Quantites: ${form.quantities}` : null,
      form.targetMarkets ? `Pays/markets cibles: ${form.targetMarkets}` : null,
      form.timeline ? `Echeance: ${form.timeline}` : null,
      form.exclusivity
        ? `Option choisie: ${form.exclusivity === "exclusive" ? "Exclusivite" : "Standard"}`
        : null,
      form.notes ? "" : null,
      form.notes ? "Notes complementaires:" : null,
      form.notes ? form.notes : null,
      pageUrl ? "" : null,
      pageUrl ? `Page: ${pageUrl}` : null,
    ].filter(Boolean);

    return lines.join("\n");
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!form.name.trim() || !form.email.trim() || !form.products.trim() || !form.objective.trim()) {
      toast({
        title: "Champs obligatoires",
        description: "Merci de renseigner votre nom, email, produits et objectif.",
      });
      return;
    }

    if (!EMAIL_RE.test(form.email)) {
      toast({
        title: "Email invalide",
        description: "Merci de verifier votre adresse email.",
      });
      return;
    }

    setLoading(true);

    try {
      const pageUrl = typeof window !== "undefined" ? window.location.href : null;
      const scenarioSummary = buildScenarioSummary(pageUrl);
      const message = buildMessage(pageUrl);
      const subject = `Prospection - ${form.company || form.name || "nouvelle demande"}`;

      const payload = {
        firstName: form.name,
        email: form.email,
        company: form.company || undefined,
        subject,
        offerType: "prospection",
        topic: form.exclusivity || "standard",
        scenarioSummary,
        message,
        source: "prospection-page",
      };

      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error("Erreur serveur");
      }

      setSubmitted(true);
      toast({
        title: "Message envoye",
        description: "Votre demande a ete transmise. Nous revenons vers vous sous 24-48h.",
      });
    } catch (err: any) {
      toast({
        title: "Erreur",
        description: err?.message || "Impossible d'envoyer le message.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <PremiumMarketingLayout>
      {/* Hero */}
      <section className="mkt-section-dark mkt-section-hero mkt-radial-glow relative overflow-hidden">
        <div className="mkt-container relative z-10">
          <div className="mx-auto max-w-4xl text-center">
            <p className="mkt-eyebrow" style={{ color: "rgba(255, 255, 255, 0.55)" }}>
              Forfait Prospection
            </p>
            <h1 className="mkt-display mkt-display-xl mt-4 text-white">
              Prospection et representation commerciale
            </h1>
            <p className="mt-6 text-lg" style={{ color: "rgba(255, 255, 255, 0.8)" }}>
              Forfait mensuel 150 EUR + commission sur les ventes generees. Cadre clair, objectifs definis,
              reporting regulier.
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <a href="#contact-prospection" className="mkt-btn mkt-btn-primary">
                Demander le contrat
              </a>
              <Link to="/pricing#prospection" className="mkt-btn mkt-btn-light">
                Voir le forfait 150 EUR/mois
              </Link>
            </div>

            <div className="mt-6 inline-flex items-center gap-3 rounded-full border border-white/15 bg-white/5 px-5 py-2 text-xs text-white/70">
              <Sparkles className="h-3.5 w-3.5" />
              Option exclusivite disponible - commission ajustee
            </div>
          </div>
        </div>
      </section>

      {/* Offer summary */}
      <SectionPremium
        eyebrow="Forfait"
        title="150 EUR / mois + commission sur resultats"
        description="Un modele simple : forfait mensuel + commission sur les ventes generees."
      >
        <div className="grid gap-6 md:grid-cols-3">
          {[
            {
              title: "Prospection active",
              desc: "Ciblage, scripts, sequences et qualification adaptes a vos produits.",
              icon: Target,
            },
            {
              title: "Representation",
              desc: "Presence commerciale, suivi des leads, relances et conversion.",
              icon: Users,
            },
            {
              title: "Reporting",
              desc: "Pipeline hebdomadaire : contacts, avancees, points bloquants.",
              icon: ShieldCheck,
            },
          ].map((item) => (
            <article key={item.title} className="mkt-card p-6">
              <item.icon className="h-5 w-5 text-[hsl(var(--mkt-primary))]" />
              <h3 className="mt-4 font-semibold text-[hsl(var(--mkt-ink))]">{item.title}</h3>
              <p className="mt-2 text-sm text-[hsl(var(--mkt-ink-muted))]">{item.desc}</p>
            </article>
          ))}
        </div>
      </SectionPremium>

      {/* Commission options */}
      <SectionPremium
        eyebrow="Options"
        title="Commission claire, option exclusivite"
        description="Deux modalites simples pour cadrer la representation commerciale."
        variant="muted"
      >
        <div className="grid gap-6 md:grid-cols-2">
          <div className="mkt-card p-6">
            <p className="mkt-label">Option standard</p>
            <h3 className="mt-2 text-2xl font-semibold text-[hsl(var(--mkt-ink))]">25% de commission</h3>
            <p className="mt-2 text-sm text-[hsl(var(--mkt-ink-muted))]">
              Sans exclusivite. Vous gardez la liberte de travailler avec d'autres canaux.
            </p>
            <ul className="mt-4 space-y-2 text-sm text-[hsl(var(--mkt-ink))]">
              {["Liberte de prospection", "Commission sur ventes generees", "Reporting hebdomadaire"].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-[hsl(var(--mkt-primary))] shrink-0 mt-0.5" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className={cn("mkt-card p-6", "border-[hsl(var(--mkt-primary)/0.25)]") }>
            <p className="mkt-label">Option exclusivite</p>
            <h3 className="mt-2 text-2xl font-semibold text-[hsl(var(--mkt-ink))]">15% de commission</h3>
            <p className="mt-2 text-sm text-[hsl(var(--mkt-ink-muted))]">
              Exclusivite sur un perimetre defini (territoire, segment, gamme).
            </p>
            <ul className="mt-4 space-y-2 text-sm text-[hsl(var(--mkt-ink))]">
              {["Exclusivite par perimetre", "Commission reduite", "Priorite sur les leads"].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-[hsl(var(--mkt-primary))] shrink-0 mt-0.5" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </SectionPremium>

      {/* Contract summary */}
      <SectionPremium
        eyebrow="Contrat"
        title="Contrat de prospection de representation (resume explicite)"
        description="Un cadre clair pour demarrer vite, sans ambiguite."
      >
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="mkt-card p-6">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-[hsl(var(--mkt-primary))]" />
              <h3 className="font-semibold text-[hsl(var(--mkt-ink))]">Clauses essentielles</h3>
            </div>
            <ul className="mt-4 space-y-3 text-sm text-[hsl(var(--mkt-ink))]">
              {[
                "Objet : prospection et representation commerciale pour vos produits.",
                "Commission : 25% standard, 15% si exclusivite.",
                "Perimetre : territoires, segments et objectifs definis ensemble.",
                "Livrables : listes de leads, reporting hebdo, suivi des actions.",
                "Confidentialite : protection des donnees clients et produits.",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-1 h-2 w-2 rounded-full bg-[hsl(var(--mkt-primary))]" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-4">
            <div className="mkt-card p-6">
              <h4 className="font-semibold text-[hsl(var(--mkt-ink))]">A fournir apres signature</h4>
              <ul className="mt-3 space-y-2 text-sm text-[hsl(var(--mkt-ink-muted))]">
                {[
                  "Liste produits + quantites + tarifs",
                  "Documents de l'entreprise (Kbis, RIB, statuts si besoin)",
                  "Brochures, fiches techniques, visuels",
                  "Certifications / normes / conformite",
                  "Conditions commerciales et SAV",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-[hsl(var(--mkt-primary))] shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-[hsl(var(--mkt-blue-100))] bg-[hsl(var(--mkt-surface-muted))] p-5 text-sm text-[hsl(var(--mkt-ink-muted))]">
              <p className="font-semibold text-[hsl(var(--mkt-ink))]">Important</p>
              <p className="mt-2">
                Ce resume est informatif. Le contrat complet precise les modalites juridiques et
                operationnelles.
              </p>
            </div>
          </div>
        </div>
      </SectionPremium>

      {/* Process */}
      <SectionPremium
        eyebrow="Process"
        title="Comment ca se passe"
        description="Un parcours simple, oriente resultat."
        variant="muted"
      >
        <div className="grid gap-6 md:grid-cols-4">
          {[
            { step: "01", title: "Cadrage", desc: "Cibles, marches, positionnement." },
            { step: "02", title: "Contrat", desc: "Signature + option d'exclusivite." },
            { step: "03", title: "Onboarding", desc: "Docs, produits, brochures, quantites." },
            { step: "04", title: "Prospection", desc: "Contacts, relances, reporting." },
          ].map((item) => (
            <div key={item.step} className="mkt-card p-6">
              <p className="text-xs uppercase tracking-[0.4em] text-[hsl(var(--mkt-ink-muted))]">{item.step}</p>
              <h3 className="mt-2 font-semibold text-[hsl(var(--mkt-ink))]">{item.title}</h3>
              <p className="mt-2 text-sm text-[hsl(var(--mkt-ink-muted))]">{item.desc}</p>
            </div>
          ))}
        </div>
      </SectionPremium>

      {/* Contact form */}
      <section id="contact-prospection" className="mkt-section">
        <div className="mkt-container">
          <div className="mx-auto max-w-5xl">
            <div className="mb-8 text-center">
              <p className="mkt-eyebrow">Prise de contact</p>
              <h2 className="mkt-display mkt-display-md mt-3">Parlons de vos produits et objectifs</h2>
              <p className="mt-3 text-sm text-[hsl(var(--mkt-ink-muted))]">
                Ce formulaire envoie directement un courrier a notre boite mail
                <span className="font-semibold"> contact@exportfrancefacile.com</span>.
              </p>
            </div>

            {submitted ? (
              <div className="mkt-card p-8 text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
                  <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                </div>
                <h3 className="text-xl font-semibold text-[hsl(var(--mkt-ink))]">Message envoye</h3>
                <p className="mt-2 text-sm text-[hsl(var(--mkt-ink-muted))]">
                  Merci pour votre demande. Nous revenons vers vous sous 24-48h.
                </p>
                <div className="mt-5 flex flex-wrap justify-center gap-3">
                  <Button asChild className="mkt-btn mkt-btn-primary">
                    <Link to="/pricing#prospection">Voir le forfait</Link>
                  </Button>
                  <Button asChild variant="outline" className="mkt-btn mkt-btn-outline">
                    <a href="mailto:contact@exportfrancefacile.com">Ecrire par email</a>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
                <form onSubmit={handleSubmit} className="mkt-card space-y-6 p-8">
                  <div className="grid gap-6 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nom et prenom *</Label>
                      <Input
                        id="name"
                        value={form.name}
                        onChange={(e) => handleChange("name", e.target.value)}
                        placeholder="Votre nom"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={form.email}
                        onChange={(e) => handleChange("email", e.target.value)}
                        placeholder="vous@email.com"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid gap-6 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="company">Entreprise</Label>
                      <Input
                        id="company"
                        value={form.company}
                        onChange={(e) => handleChange("company", e.target.value)}
                        placeholder="Nom de votre entreprise"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Telephone</Label>
                      <Input
                        id="phone"
                        type="tel"
                        value={form.phone}
                        onChange={(e) => handleChange("phone", e.target.value)}
                        placeholder="06 XX XX XX XX"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="products">Produits a representer *</Label>
                    <Textarea
                      id="products"
                      value={form.products}
                      onChange={(e) => handleChange("products", e.target.value)}
                      placeholder="Liste des produits, gammes, references, prix indicatifs..."
                      rows={4}
                      required
                    />
                  </div>

                  <div className="grid gap-6 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="quantities">Quantites / volumes</Label>
                      <Input
                        id="quantities"
                        value={form.quantities}
                        onChange={(e) => handleChange("quantities", e.target.value)}
                        placeholder="ex: 200 units/mois"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="targetMarkets">Pays ou marches cibles</Label>
                      <Input
                        id="targetMarkets"
                        value={form.targetMarkets}
                        onChange={(e) => handleChange("targetMarkets", e.target.value)}
                        placeholder="ex: UE, Afrique du Nord"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="objective">Objectif commercial *</Label>
                    <Textarea
                      id="objective"
                      value={form.objective}
                      onChange={(e) => handleChange("objective", e.target.value)}
                      placeholder="Vos objectifs, volume vise, timing, attentes..."
                      rows={3}
                      required
                    />
                  </div>

                  <div className="grid gap-6 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="timeline">Echeance</Label>
                      <Input
                        id="timeline"
                        value={form.timeline}
                        onChange={(e) => handleChange("timeline", e.target.value)}
                        placeholder="ex: Demarrage sous 4 semaines"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="exclusivity">Option commission</Label>
                      <select
                        id="exclusivity"
                        value={form.exclusivity}
                        onChange={(e) => handleChange("exclusivity", e.target.value)}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {EXCLUSIVITY_OPTIONS.map((opt) => (
                          <option key={opt.value || "empty"} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes complementaires</Label>
                    <Textarea
                      id="notes"
                      value={form.notes}
                      onChange={(e) => handleChange("notes", e.target.value)}
                      placeholder="Concurrence, canaux deja testes, contraintes legales..."
                      rows={3}
                    />
                  </div>

                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Envoi en cours..." : "Envoyer la demande"}
                  </Button>
                </form>

                <div className="space-y-4">
                  <div className="mkt-card p-6">
                    <h3 className="text-lg font-semibold text-[hsl(var(--mkt-ink))]">Ce que vous recevez</h3>
                    <ul className="mt-4 space-y-3 text-sm text-[hsl(var(--mkt-ink-muted))]">
                      {[
                        "Etude rapide de votre offre et positionnement",
                        "Plan de prospection cible et priorites",
                        "Premiers contacts qualifies",
                        "Reporting clair et actionnable",
                      ].map((item) => (
                        <li key={item} className="flex items-start gap-2">
                          <Check className="h-4 w-4 text-[hsl(var(--mkt-primary))] shrink-0 mt-0.5" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mkt-card p-6">
                    <h3 className="text-lg font-semibold text-[hsl(var(--mkt-ink))]">Documents a preparer</h3>
                    <ul className="mt-4 space-y-3 text-sm text-[hsl(var(--mkt-ink-muted))]">
                      {[
                        "Kbis et documents legaux",
                        "Brochures et fiches produits",
                        "Tarifs, MOQ, conditions commerciales",
                        "Visuels et catalogues",
                      ].map((item) => (
                        <li key={item} className="flex items-start gap-2">
                          <Check className="h-4 w-4 text-[hsl(var(--mkt-primary))] shrink-0 mt-0.5" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded-2xl border border-[hsl(var(--mkt-blue-100))] bg-[hsl(var(--mkt-surface-muted))] p-5 text-sm text-[hsl(var(--mkt-ink-muted))]">
                    <div className="flex items-start gap-3">
                      <Mail className="mt-1 h-4 w-4 text-[hsl(var(--mkt-primary))]" />
                      <p>
                        Vous pouvez aussi ecrire directement :
                        <a
                          className="ml-1 font-semibold text-[hsl(var(--mkt-ink))]"
                          href="mailto:contact@exportfrancefacile.com"
                        >
                          contact@exportfrancefacile.com
                        </a>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-white py-16">
        <div className="mkt-container">
          <div className="mkt-card flex flex-col items-center gap-6 p-10 text-center">
            <h2 className="text-3xl font-semibold text-[hsl(var(--mkt-ink))]">Pret a lancer la prospection ?</h2>
            <p className="max-w-2xl text-sm text-[hsl(var(--mkt-ink-muted))]">
              Demandez le contrat, choisissez l'option d'exclusivite et demarrez une prospection structuree.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button asChild className="mkt-btn mkt-btn-primary">
                <a href="#contact-prospection">Demander le contrat</a>
              </Button>
              <Button asChild variant="outline" className="mkt-btn mkt-btn-outline">
                <Link to="/pricing#prospection">Voir le forfait 150 EUR/mois</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </PremiumMarketingLayout>
  );
}
