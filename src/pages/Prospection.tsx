
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
import { useI18n } from "@/contexts/LanguageContext";
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

export default function Prospection() {
  const { toast } = useToast();
  const { lang } = useI18n();
  const isFr = lang === "fr";

  const copy = React.useMemo(() => {
    if (isFr) {
      return {
        hero: {
          eyebrow: "Forfait Prospection",
          title: "Prospection et representation commerciale",
          subtitle:
            "Forfait mensuel 150 EUR + commission sur les ventes generees. Cadre clair, objectifs definis, reporting regulier.",
          ctaPrimary: "Demander le contrat",
          ctaSecondary: "Voir le forfait 150 EUR/mois",
          badge: "Option exclusivite disponible - commission ajustee",
        },
        offer: {
          eyebrow: "Forfait",
          title: "150 EUR / mois + commission sur resultats",
          description: "Un modele simple : forfait mensuel + commission sur les ventes generees.",
          cards: [
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
          ],
        },
        options: {
          eyebrow: "Options",
          title: "Commission claire, option exclusivite",
          description: "Deux modalites simples pour cadrer la representation commerciale.",
          standardLabel: "Option standard",
          standardTitle: "25% de commission",
          standardDesc: "Sans exclusivite. Vous gardez la liberte de travailler avec d'autres canaux.",
          standardBullets: [
            "Liberte de prospection",
            "Commission sur ventes generees",
            "Reporting hebdomadaire",
          ],
          exclusiveLabel: "Option exclusivite",
          exclusiveTitle: "15% de commission",
          exclusiveDesc: "Exclusivite sur un perimetre defini (territoire, segment, gamme).",
          exclusiveBullets: ["Exclusivite par perimetre", "Commission reduite", "Priorite sur les leads"],
        },
        contract: {
          eyebrow: "Contrat",
          title: "Contrat de prospection de representation (resume explicite)",
          description: "Un cadre clair pour demarrer vite, sans ambiguite.",
          clausesTitle: "Clauses essentielles",
          clauses: [
            "Objet : prospection et representation commerciale pour vos produits.",
            "Commission : 25% standard, 15% si exclusivite.",
            "Perimetre : territoires, segments et objectifs definis ensemble.",
            "Livrables : listes de leads, reporting hebdo, suivi des actions.",
            "Confidentialite : protection des donnees clients et produits.",
          ],
          provideTitle: "A fournir apres signature",
          provideList: [
            "Liste produits + quantites + tarifs",
            "Documents de l'entreprise (Kbis, RIB, statuts si besoin)",
            "Brochures, fiches techniques, visuels",
            "Certifications / normes / conformite",
            "Conditions commerciales et SAV",
          ],
          noteTitle: "Important",
          noteBody:
            "Ce resume est informatif. Le contrat complet precise les modalites juridiques et operationnelles.",
        },
        process: {
          eyebrow: "Process",
          title: "Comment ca se passe",
          description: "Un parcours simple, oriente resultat.",
          steps: [
            { step: "01", title: "Cadrage", desc: "Cibles, marches, positionnement." },
            { step: "02", title: "Contrat", desc: "Signature + option d'exclusivite." },
            { step: "03", title: "Onboarding", desc: "Docs, produits, brochures, quantites." },
            { step: "04", title: "Prospection", desc: "Contacts, relances, reporting." },
          ],
        },
        contact: {
          eyebrow: "Prise de contact",
          title: "Parlons de vos produits et objectifs",
          notice: "Ce formulaire envoie directement un courrier a notre boite mail",
          sentTitle: "Message envoye",
          sentBody: "Merci pour votre demande. Nous revenons vers vous sous 24-48h.",
          sentPrimary: "Voir le forfait",
          sentSecondary: "Ecrire par email",
        },
        form: {
          nameLabel: "Nom et prenom *",
          namePlaceholder: "Votre nom",
          emailLabel: "Email *",
          emailPlaceholder: "vous@email.com",
          companyLabel: "Entreprise",
          companyPlaceholder: "Nom de votre entreprise",
          phoneLabel: "Telephone",
          phonePlaceholder: "06 XX XX XX XX",
          productsLabel: "Produits a representer *",
          productsPlaceholder: "Liste des produits, gammes, references, prix indicatifs...",
          quantitiesLabel: "Quantites / volumes",
          quantitiesPlaceholder: "ex: 200 units/mois",
          marketsLabel: "Pays ou marches cibles",
          marketsPlaceholder: "ex: UE, Afrique du Nord",
          objectiveLabel: "Objectif commercial *",
          objectivePlaceholder: "Vos objectifs, volume vise, timing, attentes...",
          timelineLabel: "Echeance",
          timelinePlaceholder: "ex: Demarrage sous 4 semaines",
          exclusivityLabel: "Option commission",
          exclusivityOptions: [
            { value: "", label: "Choisir une option" },
            { value: "standard", label: "Standard (25% de commission)" },
            { value: "exclusive", label: "Exclusivite (15% de commission)" },
          ],
          notesLabel: "Notes complementaires",
          notesPlaceholder: "Concurrence, canaux deja testes, contraintes legales...",
          submitIdle: "Envoyer la demande",
          submitLoading: "Envoi en cours...",
        },
        sidebar: {
          whatYouGetTitle: "Ce que vous recevez",
          whatYouGetItems: [
            "Etude rapide de votre offre et positionnement",
            "Plan de prospection cible et priorites",
            "Premiers contacts qualifies",
            "Reporting clair et actionnable",
          ],
          docsTitle: "Documents a preparer",
          docsItems: [
            "Kbis et documents legaux",
            "Brochures et fiches produits",
            "Tarifs, MOQ, conditions commerciales",
            "Visuels et catalogues",
          ],
          mailPrefix: "Vous pouvez aussi ecrire directement :",
        },
        cta: {
          title: "Pret a lancer la prospection ?",
          description: "Demandez le contrat, choisissez l'option d'exclusivite et demarrez une prospection structuree.",
          primary: "Demander le contrat",
          secondary: "Voir le forfait 150 EUR/mois",
        },
        toast: {
          requiredTitle: "Champs obligatoires",
          requiredDesc: "Merci de renseigner votre nom, email, produits et objectif.",
          invalidEmailTitle: "Email invalide",
          invalidEmailDesc: "Merci de verifier votre adresse email.",
          errorTitle: "Erreur",
          errorDesc: "Impossible d'envoyer le message.",
          successTitle: "Message envoye",
          successDesc: "Votre demande a ete transmise. Nous revenons vers vous sous 24-48h.",
        },
        message: {
          subjectPrefix: "Prospection",
          subjectFallback: "nouvelle demande",
          title: "Demande de prospection commerciale",
          objective: "Objectif",
          products: "Produits",
          quantities: "Quantites",
          markets: "Pays/markets cibles",
          timeline: "Echeance",
          option: "Option choisie",
          optionStandard: "Standard",
          optionExclusive: "Exclusivite",
          notes: "Notes complementaires",
          phone: "Telephone",
          page: "Page",
        },
      } as const;
    }

    return {
      hero: {
        eyebrow: "Prospecting Plan",
        title: "Prospecting and commercial representation",
        subtitle:
          "Monthly fee 150 EUR + commission on generated sales. Clear scope, defined objectives, regular reporting.",
        ctaPrimary: "Request the contract",
        ctaSecondary: "See the 150 EUR/month plan",
        badge: "Exclusivity option available - adjusted commission",
      },
      offer: {
        eyebrow: "Plan",
        title: "150 EUR / month + commission on results",
        description: "Simple model: monthly fee + commission on generated sales.",
        cards: [
          {
            title: "Active prospecting",
            desc: "Targeting, scripts, sequences and qualification tailored to your products.",
            icon: Target,
          },
          {
            title: "Representation",
            desc: "Commercial presence, lead follow-up, reminders and conversion.",
            icon: Users,
          },
          {
            title: "Reporting",
            desc: "Weekly pipeline: contacts, progress, blockers.",
            icon: ShieldCheck,
          },
        ],
      },
      options: {
        eyebrow: "Options",
        title: "Clear commission, exclusivity option",
        description: "Two simple options to frame commercial representation.",
        standardLabel: "Standard option",
        standardTitle: "25% commission",
        standardDesc: "No exclusivity. You keep freedom to work with other channels.",
        standardBullets: ["Full prospecting freedom", "Commission on generated sales", "Weekly reporting"],
        exclusiveLabel: "Exclusivity option",
        exclusiveTitle: "15% commission",
        exclusiveDesc: "Exclusivity on a defined scope (territory, segment, range).",
        exclusiveBullets: ["Exclusivity by scope", "Reduced commission", "Priority on leads"],
      },
      contract: {
        eyebrow: "Contract",
        title: "Prospecting representation contract (clear summary)",
        description: "A clear framework to start fast, without ambiguity.",
        clausesTitle: "Key clauses",
        clauses: [
          "Scope: prospecting and commercial representation for your products.",
          "Commission: 25% standard, 15% with exclusivity.",
          "Perimeter: territories, segments and objectives defined together.",
          "Deliverables: lead lists, weekly reporting, action follow-up.",
          "Confidentiality: protection of client and product data.",
        ],
        provideTitle: "To provide after signature",
        provideList: [
          "Product list + quantities + pricing",
          "Company documents (registration, bank details, statutes if needed)",
          "Brochures, technical sheets, visuals",
          "Certifications / standards / compliance",
          "Commercial terms and after-sales",
        ],
        noteTitle: "Important",
        noteBody: "This summary is informative. The full contract specifies legal and operational terms.",
      },
      process: {
        eyebrow: "Process",
        title: "How it works",
        description: "Simple path, result oriented.",
        steps: [
          { step: "01", title: "Scoping", desc: "Targets, markets, positioning." },
          { step: "02", title: "Contract", desc: "Signature + exclusivity option." },
          { step: "03", title: "Onboarding", desc: "Docs, products, brochures, quantities." },
          { step: "04", title: "Prospecting", desc: "Contacts, follow-ups, reporting." },
        ],
      },
      contact: {
        eyebrow: "Contact",
        title: "Tell us about your products and objectives",
        notice: "This form sends an email directly to our mailbox",
        sentTitle: "Message sent",
        sentBody: "Thanks for your request. We will get back to you within 24-48h.",
        sentPrimary: "See the plan",
        sentSecondary: "Email us",
      },
      form: {
        nameLabel: "Full name *",
        namePlaceholder: "Your name",
        emailLabel: "Email *",
        emailPlaceholder: "you@email.com",
        companyLabel: "Company",
        companyPlaceholder: "Your company name",
        phoneLabel: "Phone",
        phonePlaceholder: "+33 6 XX XX XX XX",
        productsLabel: "Products to represent *",
        productsPlaceholder: "List of products, ranges, references, indicative prices...",
        quantitiesLabel: "Quantities / volumes",
        quantitiesPlaceholder: "e.g. 200 units/month",
        marketsLabel: "Target countries or markets",
        marketsPlaceholder: "e.g. EU, North Africa",
        objectiveLabel: "Commercial objective *",
        objectivePlaceholder: "Your objectives, target volume, timing, expectations...",
        timelineLabel: "Timeline",
        timelinePlaceholder: "e.g. Start within 4 weeks",
        exclusivityLabel: "Commission option",
        exclusivityOptions: [
          { value: "", label: "Choose an option" },
          { value: "standard", label: "Standard (25% commission)" },
          { value: "exclusive", label: "Exclusivity (15% commission)" },
        ],
        notesLabel: "Additional notes",
        notesPlaceholder: "Competition, channels already tested, legal constraints...",
        submitIdle: "Send request",
        submitLoading: "Sending...",
      },
      sidebar: {
        whatYouGetTitle: "What you receive",
        whatYouGetItems: [
          "Quick review of your offer and positioning",
          "Target prospecting plan and priorities",
          "First qualified contacts",
          "Clear, actionable reporting",
        ],
        docsTitle: "Documents to prepare",
        docsItems: [
          "Registration and legal documents",
          "Brochures and product sheets",
          "Pricing, MOQ, commercial terms",
          "Visuals and catalogues",
        ],
        mailPrefix: "You can also write directly:",
      },
      cta: {
        title: "Ready to launch prospecting?",
        description: "Request the contract, choose the exclusivity option and start structured prospecting.",
        primary: "Request the contract",
        secondary: "See the 150 EUR/month plan",
      },
      toast: {
        requiredTitle: "Required fields",
        requiredDesc: "Please provide your name, email, products and objective.",
        invalidEmailTitle: "Invalid email",
        invalidEmailDesc: "Please check your email address.",
        errorTitle: "Error",
        errorDesc: "Unable to send the message.",
        successTitle: "Message sent",
        successDesc: "Your request has been sent. We will reply within 24-48h.",
      },
      message: {
        subjectPrefix: "Prospecting",
        subjectFallback: "new request",
        title: "Prospecting request",
        objective: "Objective",
        products: "Products",
        quantities: "Quantities",
        markets: "Target markets",
        timeline: "Timeline",
        option: "Selected option",
        optionStandard: "Standard",
        optionExclusive: "Exclusivity",
        notes: "Additional notes",
        phone: "Phone",
        page: "Page",
      },
    } as const;
  }, [isFr]);

  const [form, setForm] = React.useState<ProspectionFormState>(INITIAL_FORM);
  const [loading, setLoading] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);

  const exclusivityOptions = copy.form.exclusivityOptions;

  const handleChange = (field: keyof ProspectionFormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const buildScenarioSummary = (pageUrl: string | null) => {
    const lines = [
      form.objective ? `${copy.message.objective}: ${form.objective}` : null,
      form.products ? `${copy.message.products}: ${form.products}` : null,
      form.quantities ? `${copy.message.quantities}: ${form.quantities}` : null,
      form.targetMarkets ? `${copy.message.markets}: ${form.targetMarkets}` : null,
      form.timeline ? `${copy.message.timeline}: ${form.timeline}` : null,
      form.exclusivity
        ? `${copy.message.option}: ${
            form.exclusivity === "exclusive" ? copy.message.optionExclusive : copy.message.optionStandard
          }`
        : null,
      form.phone ? `${copy.message.phone}: ${form.phone}` : null,
      pageUrl ? `${copy.message.page}: ${pageUrl}` : null,
    ].filter(Boolean);

    return lines.join("\n");
  };

  const buildMessage = (pageUrl: string | null) => {
    const lines = [
      copy.message.title,
      "",
      `${copy.message.objective}:`,
      form.objective,
      "",
      `${copy.message.products}:`,
      form.products,
      form.quantities ? `${copy.message.quantities}: ${form.quantities}` : null,
      form.targetMarkets ? `${copy.message.markets}: ${form.targetMarkets}` : null,
      form.timeline ? `${copy.message.timeline}: ${form.timeline}` : null,
      form.exclusivity
        ? `${copy.message.option}: ${
            form.exclusivity === "exclusive" ? copy.message.optionExclusive : copy.message.optionStandard
          }`
        : null,
      form.notes ? "" : null,
      form.notes ? `${copy.message.notes}:` : null,
      form.notes ? form.notes : null,
      pageUrl ? "" : null,
      pageUrl ? `${copy.message.page}: ${pageUrl}` : null,
    ].filter(Boolean);

    return lines.join("\n");
  };
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!form.name.trim() || !form.email.trim() || !form.products.trim() || !form.objective.trim()) {
      toast({
        title: copy.toast.requiredTitle,
        description: copy.toast.requiredDesc,
      });
      return;
    }

    if (!EMAIL_RE.test(form.email)) {
      toast({
        title: copy.toast.invalidEmailTitle,
        description: copy.toast.invalidEmailDesc,
      });
      return;
    }

    setLoading(true);

    try {
      const pageUrl = typeof window !== "undefined" ? window.location.href : null;
      const scenarioSummary = buildScenarioSummary(pageUrl);
      const message = buildMessage(pageUrl);
      const subject = `${copy.message.subjectPrefix} - ${form.company || form.name || copy.message.subjectFallback}`;

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
        throw new Error("server_error");
      }

      setSubmitted(true);
      toast({
        title: copy.toast.successTitle,
        description: copy.toast.successDesc,
      });
    } catch (err: any) {
      toast({
        title: copy.toast.errorTitle,
        description: err?.message || copy.toast.errorDesc,
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
              {copy.hero.eyebrow}
            </p>
            <h1 className="mkt-display mkt-display-xl mt-4 text-white">{copy.hero.title}</h1>
            <p className="mt-6 text-lg" style={{ color: "rgba(255, 255, 255, 0.8)" }}>
              {copy.hero.subtitle}
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <a href="#contact-prospection" className="mkt-btn mkt-btn-primary">
                {copy.hero.ctaPrimary}
              </a>
              <Link to="/pricing#prospection" className="mkt-btn mkt-btn-light">
                {copy.hero.ctaSecondary}
              </Link>
            </div>

            <div className="mt-6 inline-flex items-center gap-3 rounded-full border border-white/15 bg-white/5 px-5 py-2 text-xs text-white/70">
              <Sparkles className="h-3.5 w-3.5" />
              {copy.hero.badge}
            </div>
          </div>
        </div>
      </section>

      {/* Offer summary */}
      <SectionPremium eyebrow={copy.offer.eyebrow} title={copy.offer.title} description={copy.offer.description}>
        <div className="grid gap-6 md:grid-cols-3">
          {copy.offer.cards.map((item) => (
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
        eyebrow={copy.options.eyebrow}
        title={copy.options.title}
        description={copy.options.description}
        variant="muted"
      >
        <div className="grid gap-6 md:grid-cols-2">
          <div className="mkt-card p-6">
            <p className="mkt-label">{copy.options.standardLabel}</p>
            <h3 className="mt-2 text-2xl font-semibold text-[hsl(var(--mkt-ink))]">{copy.options.standardTitle}</h3>
            <p className="mt-2 text-sm text-[hsl(var(--mkt-ink-muted))]">{copy.options.standardDesc}</p>
            <ul className="mt-4 space-y-2 text-sm text-[hsl(var(--mkt-ink))]">
              {copy.options.standardBullets.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-[hsl(var(--mkt-primary))] shrink-0 mt-0.5" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className={cn("mkt-card p-6", "border-[hsl(var(--mkt-primary)/0.25)]") }>
            <p className="mkt-label">{copy.options.exclusiveLabel}</p>
            <h3 className="mt-2 text-2xl font-semibold text-[hsl(var(--mkt-ink))]">{copy.options.exclusiveTitle}</h3>
            <p className="mt-2 text-sm text-[hsl(var(--mkt-ink-muted))]">{copy.options.exclusiveDesc}</p>
            <ul className="mt-4 space-y-2 text-sm text-[hsl(var(--mkt-ink))]">
              {copy.options.exclusiveBullets.map((item) => (
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
        eyebrow={copy.contract.eyebrow}
        title={copy.contract.title}
        description={copy.contract.description}
      >
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="mkt-card p-6">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-[hsl(var(--mkt-primary))]" />
              <h3 className="font-semibold text-[hsl(var(--mkt-ink))]">{copy.contract.clausesTitle}</h3>
            </div>
            <ul className="mt-4 space-y-3 text-sm text-[hsl(var(--mkt-ink))]">
              {copy.contract.clauses.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-1 h-2 w-2 rounded-full bg-[hsl(var(--mkt-primary))]" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-4">
            <div className="mkt-card p-6">
              <h4 className="font-semibold text-[hsl(var(--mkt-ink))]">{copy.contract.provideTitle}</h4>
              <ul className="mt-3 space-y-2 text-sm text-[hsl(var(--mkt-ink-muted))]">
                {copy.contract.provideList.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-[hsl(var(--mkt-primary))] shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-[hsl(var(--mkt-blue-100))] bg-[hsl(var(--mkt-surface-muted))] p-5 text-sm text-[hsl(var(--mkt-ink-muted))]">
              <p className="font-semibold text-[hsl(var(--mkt-ink))]">{copy.contract.noteTitle}</p>
              <p className="mt-2">{copy.contract.noteBody}</p>
            </div>
          </div>
        </div>
      </SectionPremium>

      {/* Process */}
      <SectionPremium
        eyebrow={copy.process.eyebrow}
        title={copy.process.title}
        description={copy.process.description}
        variant="muted"
      >
        <div className="grid gap-6 md:grid-cols-4">
          {copy.process.steps.map((item) => (
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
              <p className="mkt-eyebrow">{copy.contact.eyebrow}</p>
              <h2 className="mkt-display mkt-display-md mt-3">{copy.contact.title}</h2>
              <p className="mt-3 text-sm text-[hsl(var(--mkt-ink-muted))]">
                {copy.contact.notice}
                <span className="font-semibold"> contact@exportfrancefacile.com</span>.
              </p>
            </div>

            {submitted ? (
              <div className="mkt-card p-8 text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
                  <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                </div>
                <h3 className="text-xl font-semibold text-[hsl(var(--mkt-ink))]">{copy.contact.sentTitle}</h3>
                <p className="mt-2 text-sm text-[hsl(var(--mkt-ink-muted))]">{copy.contact.sentBody}</p>
                <div className="mt-5 flex flex-wrap justify-center gap-3">
                  <Button asChild className="mkt-btn mkt-btn-primary">
                    <Link to="/pricing#prospection">{copy.contact.sentPrimary}</Link>
                  </Button>
                  <Button asChild variant="outline" className="mkt-btn mkt-btn-outline">
                    <a href="mailto:contact@exportfrancefacile.com">{copy.contact.sentSecondary}</a>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
                <form onSubmit={handleSubmit} className="mkt-card space-y-6 p-8">
                  <div className="grid gap-6 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="name">{copy.form.nameLabel}</Label>
                      <Input
                        id="name"
                        value={form.name}
                        onChange={(e) => handleChange("name", e.target.value)}
                        placeholder={copy.form.namePlaceholder}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">{copy.form.emailLabel}</Label>
                      <Input
                        id="email"
                        type="email"
                        value={form.email}
                        onChange={(e) => handleChange("email", e.target.value)}
                        placeholder={copy.form.emailPlaceholder}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid gap-6 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="company">{copy.form.companyLabel}</Label>
                      <Input
                        id="company"
                        value={form.company}
                        onChange={(e) => handleChange("company", e.target.value)}
                        placeholder={copy.form.companyPlaceholder}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">{copy.form.phoneLabel}</Label>
                      <Input
                        id="phone"
                        type="tel"
                        value={form.phone}
                        onChange={(e) => handleChange("phone", e.target.value)}
                        placeholder={copy.form.phonePlaceholder}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="products">{copy.form.productsLabel}</Label>
                    <Textarea
                      id="products"
                      value={form.products}
                      onChange={(e) => handleChange("products", e.target.value)}
                      placeholder={copy.form.productsPlaceholder}
                      rows={4}
                      required
                    />
                  </div>

                  <div className="grid gap-6 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="quantities">{copy.form.quantitiesLabel}</Label>
                      <Input
                        id="quantities"
                        value={form.quantities}
                        onChange={(e) => handleChange("quantities", e.target.value)}
                        placeholder={copy.form.quantitiesPlaceholder}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="targetMarkets">{copy.form.marketsLabel}</Label>
                      <Input
                        id="targetMarkets"
                        value={form.targetMarkets}
                        onChange={(e) => handleChange("targetMarkets", e.target.value)}
                        placeholder={copy.form.marketsPlaceholder}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="objective">{copy.form.objectiveLabel}</Label>
                    <Textarea
                      id="objective"
                      value={form.objective}
                      onChange={(e) => handleChange("objective", e.target.value)}
                      placeholder={copy.form.objectivePlaceholder}
                      rows={3}
                      required
                    />
                  </div>

                  <div className="grid gap-6 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="timeline">{copy.form.timelineLabel}</Label>
                      <Input
                        id="timeline"
                        value={form.timeline}
                        onChange={(e) => handleChange("timeline", e.target.value)}
                        placeholder={copy.form.timelinePlaceholder}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="exclusivity">{copy.form.exclusivityLabel}</Label>
                      <select
                        id="exclusivity"
                        value={form.exclusivity}
                        onChange={(e) => handleChange("exclusivity", e.target.value)}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {exclusivityOptions.map((opt) => (
                          <option key={opt.value || "empty"} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="notes">{copy.form.notesLabel}</Label>
                    <Textarea
                      id="notes"
                      value={form.notes}
                      onChange={(e) => handleChange("notes", e.target.value)}
                      placeholder={copy.form.notesPlaceholder}
                      rows={3}
                    />
                  </div>

                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? copy.form.submitLoading : copy.form.submitIdle}
                  </Button>
                </form>
                <aside className="space-y-6">
                  <div className="mkt-card p-6">
                    <div className="flex items-center gap-3">
                      <Sparkles className="h-5 w-5 text-[hsl(var(--mkt-primary))]" />
                      <h3 className="font-semibold text-[hsl(var(--mkt-ink))]">{copy.sidebar.whatYouGetTitle}</h3>
                    </div>
                    <ul className="mt-4 space-y-3 text-sm text-[hsl(var(--mkt-ink))]">
                      {copy.sidebar.whatYouGetItems.map((item) => (
                        <li key={item} className="flex items-start gap-2">
                          <Check className="h-4 w-4 text-[hsl(var(--mkt-primary))] shrink-0 mt-0.5" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mkt-card p-6">
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-[hsl(var(--mkt-primary))]" />
                      <h3 className="font-semibold text-[hsl(var(--mkt-ink))]">{copy.sidebar.docsTitle}</h3>
                    </div>
                    <ul className="mt-4 space-y-3 text-sm text-[hsl(var(--mkt-ink))]">
                      {copy.sidebar.docsItems.map((item) => (
                        <li key={item} className="flex items-start gap-2">
                          <Check className="h-4 w-4 text-[hsl(var(--mkt-primary))] shrink-0 mt-0.5" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded-2xl border border-[hsl(var(--mkt-blue-100))] bg-[hsl(var(--mkt-surface-muted))] p-5">
                    <div className="flex items-center gap-2 text-sm font-semibold text-[hsl(var(--mkt-ink))]">
                      <Mail className="h-4 w-4 text-[hsl(var(--mkt-primary))]" />
                      {copy.sidebar.mailPrefix}
                    </div>
                    <a
                      href="mailto:contact@exportfrancefacile.com"
                      className="mt-3 inline-flex text-sm font-semibold text-[hsl(var(--mkt-primary))] hover:underline"
                    >
                      contact@exportfrancefacile.com
                    </a>
                  </div>
                </aside>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mkt-section">
        <div className="mkt-container">
          <div className="rounded-3xl border border-white/10 bg-gradient-to-r from-[#1E3A8A] via-[#0B1220] to-[#DC2626] p-8 text-white shadow-xl">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-2xl font-semibold">{copy.cta.title}</div>
                <p className="mt-2 text-sm text-white/80">{copy.cta.description}</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <a
                  href="#contact-prospection"
                  className="inline-flex rounded-full bg-white px-6 py-3 text-xs font-semibold uppercase tracking-[0.35em] text-slate-900 transition hover:bg-white/90"
                >
                  {copy.cta.primary}
                </a>
                <Link
                  to="/pricing#prospection"
                  className="inline-flex rounded-full border border-white/60 px-6 py-3 text-xs font-semibold uppercase tracking-[0.35em] text-white transition hover:bg-white/10"
                >
                  {copy.cta.secondary}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </PremiumMarketingLayout>
  );
}
