import { FormEvent, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { MarketingLayout } from "@/components/marketing/MarketingLayout";
import { useI18n } from "@/contexts/LanguageContext";
import { usePageMeta } from "@/hooks/usePageMeta";

type Topic = "audit" | "ddp" | "tvadouane" | "sanctions" | "autre";

export default function Contact() {
  const { t } = useI18n();
  usePageMeta("meta.contact.title", "meta.contact.description");

  const [searchParams] = useSearchParams();

  const formCopy =
    (t("contactPage.form") as {
      name: string;
      email: string;
      message: string;
      submit: string;
    }) ?? {
      name: "Nom / société",
      email: "Email professionnel",
      message: "Votre demande",
      submit: "Envoyer et réserver",
    };

  const blockCopy =
    (t("contactPage.bookBlock") as {
      title: string;
      body: string;
      cta: string;
    }) ?? {
      title: "Réserver un appel 20 min",
      body: "Je vous rappelle pour valider vos risques TVA, douane et DDP avant toute expédition.",
      cta: "Choisir un créneau",
    };

  // Coordonnées (demandées)
  const phoneRaw = "0676435551";
  const phonePretty = "06 76 43 55 51";
  const emailMain = "contact@exportfrancefacile.com";
  const emailDirect = "lamia.brechet@outlook.fr";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [topic, setTopic] = useState<Topic>("audit");
  const [message, setMessage] = useState("");

  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [copied, setCopied] = useState<null | "phone" | "emailMain" | "emailDirect">(null);

  // ✅ Support du CTA /contact?offer=diagnostic (depuis MarketingLayout)
  useEffect(() => {
    const offer = (searchParams.get("offer") || "").toLowerCase().trim();
    if (!offer) return;

    // mapping simple
    if (offer === "diagnostic" || offer === "audit" || offer === "express") setTopic("audit");
    else if (offer === "ddp") setTopic("ddp");
    else if (offer === "tvadouane" || offer === "tva" || offer === "douane") setTopic("tvadouane");
    else if (offer === "sanctions" || offer === "conformite") setTopic("sanctions");
    else if (offer === "autre") setTopic("autre");
  }, [searchParams]);

  const messageCount = message.trim().length;

  const canSubmit = useMemo(() => {
    return (
      name.trim().length > 1 &&
      email.trim().length > 4 &&
      message.trim().length > 10 &&
      status !== "sending"
    );
  }, [name, email, message, status]);

  const topicLabel = (value: Topic) => {
    switch (value) {
      case "audit":
        return "Audit express";
      case "ddp":
        return "DDP / Incoterms";
      case "tvadouane":
        return "TVA / Douane";
      case "sanctions":
        return "Sanctions / conformité";
      case "autre":
        return "Autre";
      default:
        return "Audit express";
    }
  };

  const copy = async (value: string, kind: "phone" | "emailMain" | "emailDirect") => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 1200);
    } catch {
      // silencieux : pas bloquant
    }
  };

  const buildMailto = () => {
    const subject = `[ExportFranceFacile] Demande — ${topicLabel(topic)} — ${name || "Nouveau contact"}`;
    const body =
      `Bonjour,\n\n` +
      `Je vous contacte via exportfrancefacile.com\n\n` +
      `Nom / société : ${name}\n` +
      `Email : ${email}\n` +
      `Sujet : ${topicLabel(topic)}\n\n` +
      `Message :\n${message}\n\n` +
      `—\nRappel : ${phonePretty} | ${emailMain}`;

    // ✅ Ne pas encoder l’adresse dans mailto:
    return `mailto:${emailMain}?cc=${encodeURIComponent(emailDirect)}&subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;

    setStatus("sending");

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          topic,
          message,
          to: [emailMain, emailDirect],
          source: "contact-page",
        }),
      });

      if (res.ok) {
        setStatus("sent");
        return;
      }

      // API répond mais pas OK => fallback mailto
      window.location.href = buildMailto();
      setStatus("sent");
    } catch {
      // Pas d’API / erreur réseau => fallback mailto
      window.location.href = buildMailto();
      setStatus("sent");
    }
  };

  return (
    <MarketingLayout>
      {/* HERO */}
      <section className="relative overflow-hidden bg-white">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(15,23,42,0.06),transparent_55%)]" />
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr]">
            <div>
              <p className="text-xs uppercase tracking-[0.5em] text-slate-400">
                {t("contactPage.headline")}
              </p>
              <h1 className="mt-3 text-4xl font-semibold text-slate-900">
                {t("contactPage.headline")}
              </h1>
              <p className="mt-4 max-w-xl text-base text-slate-700">{t("contactPage.body")}</p>

              {/* TOPIC CHIPS */}
              <div className="mt-8 flex flex-wrap gap-2">
                {([
                  { key: "audit", label: "Audit express" },
                  { key: "ddp", label: "DDP / Incoterms" },
                  { key: "tvadouane", label: "TVA / Douane" },
                  { key: "sanctions", label: "Sanctions / conformité" },
                  { key: "autre", label: "Autre" },
                ] as const).map((item) => {
                  const active = topic === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setTopic(item.key)}
                      className={[
                        "rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] transition",
                        active
                          ? "bg-slate-900 text-white"
                          : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                      ].join(" ")}
                      aria-pressed={active}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>

              {/* FORM */}
              <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                <label className="flex flex-col gap-2 text-sm text-slate-700">
                  <span className="font-semibold">{formCopy.name}</span>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm shadow-sm focus:border-slate-900 focus:outline-none"
                    placeholder={formCopy.name}
                    required
                  />
                </label>

                <label className="flex flex-col gap-2 text-sm text-slate-700">
                  <span className="font-semibold">{formCopy.email}</span>
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    type="email"
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm shadow-sm focus:border-slate-900 focus:outline-none"
                    placeholder={formCopy.email}
                    required
                  />
                </label>

                <label className="flex flex-col gap-2 text-sm text-slate-700">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{formCopy.message}</span>
                    <span className="text-xs text-slate-500">{messageCount}/800</span>
                  </div>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value.slice(0, 800))}
                    rows={5}
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm shadow-sm focus:border-slate-900 focus:outline-none"
                    placeholder={formCopy.message}
                    required
                  />
                  <p className="text-xs text-slate-500">
                    Conseil : ajoute ton pays de destination + HS code si tu les as (même approximatif).
                  </p>
                </label>

                <button
                  type="submit"
                  disabled={!canSubmit}
                  className={[
                    "w-full rounded-2xl px-5 py-3 text-sm font-semibold uppercase tracking-[0.4em] text-white transition",
                    canSubmit ? "bg-slate-900 hover:bg-slate-800" : "bg-slate-300 cursor-not-allowed",
                  ].join(" ")}
                >
                  {status === "sending" ? "Envoi..." : formCopy.submit}
                </button>

                {/* STATUS */}
                {status === "sent" && (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                    <div className="font-semibold">Message prêt ✅</div>
                    <div className="mt-1 text-emerald-900/80">
                      Si l’envoi automatique n’est pas configuré, ton email s’ouvre en brouillon (fallback). Sinon, c’est
                      bien envoyé.
                    </div>
                  </div>
                )}

                {status === "error" && (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
                    Un souci est survenu. Réessaye ou écris directement à{" "}
                    <a className="underline" href={`mailto:${emailMain}`}>
                      {emailMain}
                    </a>
                    .
                  </div>
                )}

                <div className="flex flex-wrap gap-2 pt-2">
                  <a
                    href={buildMailto()}
                    className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-slate-700 transition hover:bg-slate-50"
                  >
                    Ouvrir en email
                  </a>
                  <a
                    href={`tel:${phoneRaw}`}
                    className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-slate-700 transition hover:bg-slate-50"
                  >
                    Appeler
                  </a>
                </div>
              </form>
            </div>

            {/* SIDEBAR */}
            <div className="space-y-6">
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-8 shadow-lg">
                <h2 className="text-xl font-semibold text-slate-900">{blockCopy.title}</h2>
                <p className="mt-3 text-sm text-slate-600">{blockCopy.body}</p>
