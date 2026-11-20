import * as React from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, CheckCircle2, Mail, ShieldCheck } from "lucide-react";
import { MarketingLayout } from "@/components/marketing/MarketingLayout";
import { usePageMeta } from "@/hooks/usePageMeta";

const OFFER_OPTIONS = [
  { value: "export", label: "Développement export" },
  { value: "atelier", label: "Atelier IA & Export" },
  { value: "accompagnement", label: "Accompagnement sur mesure" },
  { value: "diagnostic", label: "Diagnostic de mon projet" },
  { value: "autre", label: "Autre demande" },
] as const;

export default function Contact() {
  usePageMeta("meta.contact.title", "meta.contact.description", { brandSuffix: "MPL Export Conseil" });
  const [searchParams] = useSearchParams();
  const incomingOffer = searchParams.get("offer") || "diagnostic";
  const [offer, setOffer] = React.useState(OFFER_OPTIONS.some((item) => item.value === incomingOffer) ? incomingOffer : "autre");
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [company, setCompany] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [website, setWebsite] = React.useState("");
  const [consent, setConsent] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [success, setSuccess] = React.useState(false);
  const [error, setError] = React.useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!consent || name.trim().length < 2 || message.trim().length < 10 || !email.includes("@")) {
      setError("Renseignez vos coordonnées, décrivez votre projet (10 caractères minimum) et confirmez le consentement.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: name.trim(),
          email: email.trim(),
          company: company.trim(),
          subject: OFFER_OPTIONS.find((item) => item.value === offer)?.label || "Demande de contact",
          topic: offer,
          offerType: offer,
          message: message.trim(),
          source: "contact-commercial",
          scenarioSummary: [window.location.pathname, "utm_source=" + (searchParams.get("utm_source") || "direct"), "utm_campaign=" + (searchParams.get("utm_campaign") || "")].join(" | "),
          website,
        }),
      });
      const data = await response.json().catch(() => null) as { ok?: boolean; stored?: boolean; emailSent?: boolean; detail?: string } | null;
      if (!response.ok || !data?.ok || (!data.stored && !data.emailSent)) {
        throw new Error(data?.detail || "La transmission de votre demande a échoué. Merci de réessayer.");
      }
      setSuccess(true);
      if (typeof window !== "undefined" && typeof window.gtag === "function") {
        window.gtag("event", "generate_lead", { lead_source: "contact-commercial", offer });
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Le service est momentanément indisponible.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <MarketingLayout>
      <main className="mkt-section bg-[linear-gradient(135deg,#f1f5f9,#ffffff_45%,#ecfdf5)]">
        <div className="mkt-container grid items-start gap-10 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="space-y-6 py-4">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">MPL Export Conseil · Contact</p>
            <h1 className="max-w-xl text-4xl font-bold leading-tight tracking-tight text-slate-950 sm:text-5xl">Parlons de votre prochain projet.</h1>
            <p className="max-w-xl text-lg leading-relaxed text-slate-600">Développement export, intelligence artificielle ou accompagnement opérationnel : décrivez votre situation et l'objectif que vous souhaitez atteindre.</p>
            <div className="space-y-4 rounded-2xl border border-slate-200 bg-white/80 p-6">
              <h2 className="text-lg font-semibold text-slate-900">Comment se passe le premier échange ?</h2>
              <p className="flex gap-3 text-sm text-slate-700"><CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-700" />Vous nous présentez votre besoin et vos contraintes.</p>
              <p className="flex gap-3 text-sm text-slate-700"><CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-700" />Nous précisons ensemble les priorités et les prochaines étapes possibles.</p>
              <p className="flex gap-3 text-sm text-slate-700"><CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-700" />Une éventuelle prestation fait l'objet d'une proposition claire, sans engagement préalable.</p>
            </div>
            <p className="flex items-start gap-2 text-sm text-slate-500"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />Vos informations servent uniquement à répondre à votre demande. Ne transmettez pas de données sensibles dans le formulaire.</p>
            <Link to="/pricing" className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-800 hover:underline">Découvrir la méthode de l'atelier <ArrowRight className="h-4 w-4" /></Link>
          </div>
          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/40 sm:p-8">
            {success ? (
              <div role="status" className="space-y-5 py-10 text-center">
                <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-600" />
                <h2 className="text-2xl font-bold text-slate-900">Votre demande a été transmise.</h2>
                <p className="text-slate-600">Merci pour votre confiance. Nous reviendrons vers vous après étude de votre besoin.</p>
                <Link to="/" className="inline-flex rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white">Retour à l'accueil</Link>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-5">
                <div>
                  <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-emerald-700"><Mail className="h-4 w-4" />Votre demande</p>
                  <h2 className="mt-2 text-2xl font-bold text-slate-900">Décrivez votre projet</h2>
                  <p className="mt-1 text-sm text-slate-500">Les champs marqués * sont nécessaires.</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="text-sm font-medium text-slate-700">Nom / prénom *
                    <input required maxLength={120} autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-emerald-600" placeholder="Votre nom" />
                  </label>
                  <label className="text-sm font-medium text-slate-700">Email professionnel *
                    <input required type="email" maxLength={254} autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-emerald-600" placeholder="vous@entreprise.fr" />
                  </label>
                </div>
                <label className="block text-sm font-medium text-slate-700">Entreprise (facultatif)
                  <input maxLength={200} autoComplete="organization" value={company} onChange={(event) => setCompany(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-600" placeholder="Nom de votre structure" />
                </label>
                <label className="block text-sm font-medium text-slate-700">Votre besoin *
                  <select value={offer} onChange={(event) => setOffer(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-emerald-600">
                    {OFFER_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </select>
                </label>
                <label className="block text-sm font-medium text-slate-700">Votre projet en quelques lignes *
                  <textarea required minLength={10} maxLength={4000} rows={5} value={message} onChange={(event) => setMessage(event.target.value)} className="mt-2 w-full resize-y rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-600" placeholder="Votre activité, votre difficulté principale et le résultat recherché..." />
                </label>
                <div aria-hidden="true" className="absolute -left-[10000px] h-px w-px overflow-hidden"><label>Site web<input tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} /></label></div>
                <label className="flex items-start gap-3 text-sm leading-relaxed text-slate-600">
                  <input type="checkbox" required checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-1 accent-emerald-700" />
                  J'accepte d'être recontacté(e) par MPL Export Conseil au sujet de cette demande. *
                </label>
                {error ? <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
                <button type="submit" disabled={busy} className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-emerald-700 px-6 py-3.5 text-base font-semibold text-white hover:bg-emerald-800 disabled:opacity-60">
                  {busy ? "Transmission..." : "Envoyer ma demande"}<ArrowRight className="h-5 w-5" />
                </button>
              </form>
            )}
          </div>
        </div>
      </main>
    </MarketingLayout>
  );
}
