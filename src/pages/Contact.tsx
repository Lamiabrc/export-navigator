import * as React from "react";
import { Link, useSearchParams } from "react-router-dom";

import { MarketingLayout } from "@/components/marketing/MarketingLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/contexts/LanguageContext";
import {
  Mail,
  Phone,
  Clock,
  Shield,
  CheckCircle2,
  FileCheck2,
  Target,
  BellRing,
} from "lucide-react";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type FormState = {
  name: string;
  email: string;
  company: string;
  phone: string;
  offer: string;
  message: string;
};

const INITIAL_FORM: FormState = {
  name: "",
  email: "",
  company: "",
  phone: "",
  offer: "",
  message: "",
};

const OFFER_OPTIONS = [
  { value: "diagnostic", labelFr: "Demande de diagnostic", labelEn: "Request a diagnostic" },
  { value: "express", labelFr: "Validation express", labelEn: "Express validation" },
  { value: "audit", labelFr: "Audit complet", labelEn: "Full audit" },
  { value: "vip", labelFr: "Offre VIP (veille personnalisée)", labelEn: "VIP offer (personalized watch)" },
  { value: "online", labelFr: "Offre en ligne 65 €/mois", labelEn: "Online plan €65/month" },
  { value: "other", labelFr: "Autre demande", labelEn: "Other request" },
];

export default function Contact() {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const isFr = lang === "fr";

  const [form, setForm] = React.useState<FormState>(() => {
    const offerParam = searchParams.get("offer") || "";
    return { ...INITIAL_FORM, offer: offerParam };
  });
  const [loading, setLoading] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);

  const handleChange = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.name.trim() || !form.email.trim()) {
      toast({
        title: isFr ? "Champs obligatoires" : "Required fields",
        description: isFr ? "Merci de renseigner votre nom et email." : "Please fill in your name and email.",
      });
      return;
    }

    if (!EMAIL_RE.test(form.email)) {
      toast({
        title: isFr ? "Email invalide" : "Invalid email",
        description: isFr ? "Merci de vérifier votre adresse email." : "Please check your email address.",
      });
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        throw new Error(isFr ? "Erreur serveur" : "Server error");
      }

      setSubmitted(true);
      toast({
        title: isFr ? "Message envoyé" : "Message sent",
        description: isFr ? "Nous vous répondrons sous 24-48h." : "We will respond within 24-48h.",
      });
    } catch (err: any) {
      toast({
        title: isFr ? "Erreur" : "Error",
        description: err?.message || (isFr ? "Impossible d'envoyer le message." : "Unable to send the message."),
      });
    } finally {
      setLoading(false);
    }
  };

  const benefits = isFr
    ? [
        { icon: Clock, text: "Réponse sous 24-48h" },
        { icon: Shield, text: "Vos données restent confidentielles (RGPD)" },
        { icon: FileCheck2, text: "Premier échange gratuit et sans engagement" },
        { icon: Target, text: "Conseils adaptés à votre situation export" },
      ]
    : [
        { icon: Clock, text: "Response within 24-48h" },
        { icon: Shield, text: "Your data stays confidential (GDPR)" },
        { icon: FileCheck2, text: "First exchange free, no commitment" },
        { icon: Target, text: "Advice tailored to your export situation" },
      ];

  const services = isFr
    ? [
        { icon: Target, title: "Diagnostic export", desc: "Analyse de votre situation, risques et opportunités." },
        { icon: FileCheck2, title: "Validation express", desc: "Contrôle rapide avant expédition (48h)." },
        { icon: BellRing, title: "Veille VIP", desc: "Alertes personnalisées dans l'outil (réservé VIP)." },
      ]
    : [
        { icon: Target, title: "Export diagnostic", desc: "Analysis of your situation, risks, and opportunities." },
        { icon: FileCheck2, title: "Express validation", desc: "Quick check before shipment (48h)." },
        { icon: BellRing, title: "VIP watch", desc: "Personalized alerts in the tool (VIP only)." },
      ];

  if (submitted) {
    return (
      <MarketingLayout>
        <section className="mkt-section mkt-section-hero">
          <div className="mkt-container">
            <div className="mx-auto max-w-2xl text-center">
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
              <h1 className="mkt-display mkt-display-lg">
                {isFr ? "Message envoyé !" : "Message sent!"}
              </h1>
              <p className="mt-4 text-lg text-muted-foreground">
                {isFr
                  ? "Merci pour votre message. Nous vous répondrons dans les 24-48h."
                  : "Thank you for your message. We will respond within 24-48h."}
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-4">
                <Button asChild>
                  <Link to="/analyse">{isFr ? "Lancer une analyse" : "Start an analysis"}</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/">{isFr ? "Retour à l'accueil" : "Back to home"}</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </MarketingLayout>
    );
  }

  return (
    <MarketingLayout>
      {/* Hero */}
      <section className="mkt-section-dark mkt-section-hero">
        <div className="mkt-container">
          <div className="mx-auto max-w-3xl text-center">
            <p className="mkt-eyebrow" style={{ color: "rgba(255,255,255,0.6)" }}>
              {isFr ? "Contact" : "Contact"}
            </p>
            <h1 className="mkt-display mkt-display-lg mt-4">
              {isFr ? "Parlons de votre projet export" : "Let's discuss your export project"}
            </h1>
            <p className="mt-6 text-lg" style={{ color: "rgba(255,255,255,0.8)" }}>
              {isFr
                ? "Besoin d'un diagnostic, d'un audit ou d'une veille personnalisée ? Nous vous répondons sous 24-48h."
                : "Need a diagnostic, audit, or personalized watch? We respond within 24-48h."}
            </p>
          </div>
        </div>
      </section>

      {/* Form + Info */}
      <section className="mkt-section">
        <div className="mkt-container">
          <div className="grid gap-12 lg:grid-cols-5">
            {/* Form */}
            <div className="lg:col-span-3">
              <Card className="mkt-card p-8">
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid gap-6 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="name">{isFr ? "Nom *" : "Name *"}</Label>
                      <Input
                        id="name"
                        value={form.name}
                        onChange={(e) => handleChange("name", e.target.value)}
                        placeholder={isFr ? "Votre nom" : "Your name"}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">{isFr ? "Email *" : "Email *"}</Label>
                      <Input
                        id="email"
                        type="email"
                        value={form.email}
                        onChange={(e) => handleChange("email", e.target.value)}
                        placeholder={isFr ? "votre@email.com" : "your@email.com"}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid gap-6 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="company">{isFr ? "Entreprise" : "Company"}</Label>
                      <Input
                        id="company"
                        value={form.company}
                        onChange={(e) => handleChange("company", e.target.value)}
                        placeholder={isFr ? "Nom de votre entreprise" : "Your company name"}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">{isFr ? "Téléphone" : "Phone"}</Label>
                      <Input
                        id="phone"
                        type="tel"
                        value={form.phone}
                        onChange={(e) => handleChange("phone", e.target.value)}
                        placeholder={isFr ? "06 XX XX XX XX" : "+33 6 XX XX XX XX"}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="offer">{isFr ? "Objet de la demande" : "Subject"}</Label>
                    <select
                      id="offer"
                      value={form.offer}
                      onChange={(e) => handleChange("offer", e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="">{isFr ? "Sélectionnez..." : "Select..."}</option>
                      {OFFER_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {isFr ? opt.labelFr : opt.labelEn}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="message">{isFr ? "Votre message" : "Your message"}</Label>
                    <Textarea
                      id="message"
                      value={form.message}
                      onChange={(e) => handleChange("message", e.target.value)}
                      placeholder={
                        isFr
                          ? "Décrivez votre situation, vos besoins, vos questions..."
                          : "Describe your situation, needs, questions..."
                      }
                      rows={5}
                    />
                  </div>

                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading
                      ? isFr
                        ? "Envoi en cours..."
                        : "Sending..."
                      : isFr
                      ? "Envoyer le message"
                      : "Send message"}
                  </Button>
                </form>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-8 lg:col-span-2">
              {/* Contact info */}
              <Card className="mkt-card p-6">
                <h3 className="text-lg font-semibold">
                  {isFr ? "Coordonnées directes" : "Direct contact"}
                </h3>
                <div className="mt-4 space-y-4">
                  <a
                    href="mailto:contact@exportfrancefacile.com"
                    className="flex items-center gap-3 text-sm text-muted-foreground hover:text-foreground transition"
                  >
                    <Mail className="h-5 w-5" />
                    contact@exportfrancefacile.com
                  </a>
                  <a
                    href="tel:+33676435551"
                    className="flex items-center gap-3 text-sm text-muted-foreground hover:text-foreground transition"
                  >
                    <Phone className="h-5 w-5" />
                    06 76 43 55 51
                  </a>
                </div>
              </Card>

              {/* Benefits */}
              <Card className="mkt-card p-6">
                <h3 className="text-lg font-semibold">
                  {isFr ? "Ce que vous obtenez" : "What you get"}
                </h3>
                <ul className="mt-4 space-y-3">
                  {benefits.map((item) => (
                    <li key={item.text} className="flex items-start gap-3 text-sm text-muted-foreground">
                      <item.icon className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                      {item.text}
                    </li>
                  ))}
                </ul>
              </Card>

              {/* Services */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">
                  {isFr ? "Nos services" : "Our services"}
                </h3>
                {services.map((service) => (
                  <div key={service.title} className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                      <service.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{service.title}</p>
                      <p className="text-sm text-muted-foreground">{service.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mkt-section mkt-section-muted">
        <div className="mkt-container">
          <div className="mx-auto max-w-3xl text-center">
            <p className="mkt-eyebrow">{isFr ? "Veille personnalisée" : "Personalized watch"}</p>
            <h2 className="mkt-display mkt-display-md mt-4">
              {isFr
                ? "Veille personnalisée dans l'outil = réservée VIP"
                : "Personalized watch in the tool = VIP only"}
            </h2>
            <p className="mt-4 text-muted-foreground">
              {isFr
                ? "Pour recevoir des alertes ciblées sur vos marchés et codes HS directement dans le cockpit."
                : "To receive targeted alerts on your markets and HS codes directly in the cockpit."}
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <Button asChild>
                <Link to="/pricing#vip">{isFr ? "Voir l'offre VIP" : "See VIP offer"}</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/analyse">{isFr ? "Essayer l'analyse" : "Try analysis"}</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
