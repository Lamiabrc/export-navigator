import * as React from "react";
import { Link, useSearchParams } from "react-router-dom";
import logo from "@/assets/mpl-logo.webp";

/*
 * Webinaire « Export & IA » en LinkedIn Live.
 * Inscription via /api/survey?kind=webinar (table webinar_registrations).
 * Lien prospection : /webinaire?src=linkedin
 */

const NAVY = "#08285a";
const RED = "#e2141e";
const SHOW_COUNT_FROM = 10;

// À renseigner dès que l'événement LinkedIn Live est créé (laisser vide sinon : le bouton est masqué).
const LINKEDIN_EVENT_URL = "https://www.linkedin.com/events/7530640702569992192/";

const SESSION = {
  id: "export-ia-2026-12",
  label: "Jeudi 10 décembre 2026",
  hours: "12 h 15 – 12 h 55",
  startUtc: "20261210T111500Z",
  endUtc: "20261210T115500Z",
};
const NEXT_SESSION = "jeudi 14 janvier 2027";

const TITLE = "Export & IA : combien d'heures votre équipe peut récupérer ?";

const AGENDA = [
  { icon: "🌍", title: "Le constat", text: "Droits de douane, règles pays qui bougent : ce que ça coûte en temps à un service export." },
  { icon: "⚡", title: "Démo en direct", text: "Un devis et un document export préparés avec l'IA, sous vos yeux." },
  { icon: "💬", title: "Vos questions", text: "10 minutes pour vos cas concrets." },
];

function icsHref() {
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//MPL Export Conseil//Webinaire//FR",
    "BEGIN:VEVENT",
    `UID:${SESSION.id}@exportfrancefacile.com`,
    `DTSTAMP:${SESSION.startUtc}`,
    `DTSTART:${SESSION.startUtc}`,
    `DTEND:${SESSION.endUtc}`,
    `SUMMARY:Webinaire LinkedIn Live – ${TITLE}`,
    `DESCRIPTION:En direct sur LinkedIn (MPL Export Conseil / Lamia Bréchet). ${LINKEDIN_EVENT_URL || "https://exportfrancefacile.com/webinaire"}`,
    `URL:${LINKEDIN_EVENT_URL || "https://exportfrancefacile.com/webinaire"}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
}

export default function Webinaire() {
  const [sp] = useSearchParams();
  const source = (sp.get("src") || sp.get("utm_source") || "direct").slice(0, 60);
  const campaign = (sp.get("utm_campaign") || "webinaire-export-ia").slice(0, 80);

  const [prenom, setPrenom] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [entreprise, setEntreprise] = React.useState("");
  const [pilote, setPilote] = React.useState(false);
  const [state, setState] = React.useState<"idle" | "sending" | "done" | "error">("idle");
  const [count, setCount] = React.useState<number | null>(null);

  React.useEffect(() => {
    document.title = `Webinaire LinkedIn Live : ${TITLE} | MPL Export Conseil`;
    fetch(`/api/survey?kind=webinar&webinar=${SESSION.id}`)
      .then((r) => r.json())
      .then((j) => j.ok && setCount(j.count))
      .catch(() => null);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email.trim())) return setState("error");
    setState("sending");
    try {
      const r = await fetch("/api/survey?kind=webinar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webinar: SESSION.id, prenom, email: email.trim(), entreprise, pilote, source, campaign }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error);
      if (typeof j.count === "number") setCount(j.count);
      setState("done");
      if (typeof window !== "undefined" && typeof window.gtag === "function") {
        window.gtag("event", "webinaire_inscription", { source, pilote });
      }
    } catch {
      setState("error");
    }
  }

  return (
    <div className="min-h-screen text-white" style={{ background: `radial-gradient(circle at 20% 0%, #1d4f9a 0%, ${NAVY} 55%)` }}>
      <div className="h-2 w-full" style={{ background: RED }} />
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
        <Link to="/" className="flex items-center gap-3">
          <span className="rounded-xl bg-white p-1.5"><img src={logo} alt="MPL Export Conseil" className="h-10 w-10 object-contain" /></span>
          <span className="hidden text-sm font-semibold text-blue-100 sm:inline">MPL Export Conseil</span>
        </Link>
        <span className="rounded-full bg-[#0a66c2] px-3 py-1 text-xs font-bold">● LinkedIn Live</span>
      </header>

      <main className="mx-auto grid max-w-5xl gap-10 px-5 pb-16 lg:grid-cols-[1.2fr_1fr]">
        <section>
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-red-300">Webinaire gratuit · 40 min · en direct</p>
          <h1 className="mt-3 text-4xl font-extrabold leading-tight sm:text-5xl">{TITLE}</h1>
          <div className="mt-6 inline-flex flex-wrap items-center gap-3 rounded-2xl bg-white px-5 py-4 text-[#08285a]">
            <span className="text-3xl">📅</span>
            <span>
              <span className="block text-xl font-extrabold">{SESSION.label}</span>
              <span className="block font-semibold">{SESSION.hours} · sur LinkedIn</span>
            </span>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {AGENDA.map((a) => (
              <div key={a.title} className="rounded-2xl border border-white/15 bg-white/10 p-5">
                <span className="text-3xl">{a.icon}</span>
                <p className="mt-2 text-lg font-extrabold">{a.title}</p>
                <p className="mt-1 text-sm text-blue-100">{a.text}</p>
              </div>
            ))}
          </div>

          <p className="mt-8 text-blue-100">
            Animé par <strong className="text-white">Lamia Bréchet</strong>, MPL Export Conseil (Rennes). Pour les équipes export et commerce international
            des PME du Grand Ouest et de Paris.
          </p>
          <p className="mt-2 text-sm text-blue-200">Prochaine session : {NEXT_SESSION}.</p>
        </section>

        <section className="self-start rounded-3xl bg-white p-6 text-[#08285a] shadow-2xl sm:p-8">
          {state === "done" ? (
            <div className="space-y-5">
              <p className="text-4xl">✅</p>
              <h2 className="text-2xl font-extrabold">C'est noté{prenom ? `, ${prenom}` : ""} !</h2>
              <p className="text-slate-600">Vous recevrez le lien du direct par e-mail avant le webinaire.</p>
              <a href={icsHref()} download="webinaire-export-ia.ics" className="block rounded-xl px-5 py-3 text-center font-bold text-white" style={{ background: NAVY }}>
                📅 Ajouter à mon agenda
              </a>
              {LINKEDIN_EVENT_URL && (
                <a href={LINKEDIN_EVENT_URL} target="_blank" rel="noreferrer" className="block rounded-xl bg-[#0a66c2] px-5 py-3 text-center font-bold text-white">
                  Voir l'événement sur LinkedIn
                </a>
              )}
              <Link to={`/test-export-ia?utm_source=${encodeURIComponent(source)}&utm_campaign=webinaire`} className="block rounded-xl px-5 py-3 text-center font-bold text-white" style={{ background: RED }}>
                ⏱️ En attendant : le test en 2 min
              </Link>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <h2 className="text-2xl font-extrabold">Je réserve ma place</h2>
              {count !== null && count >= SHOW_COUNT_FROM && <p className="text-sm font-semibold text-slate-500">{count} inscrits</p>}
              <input value={prenom} onChange={(e) => setPrenom(e.target.value)} placeholder="Prénom" aria-label="Prénom" className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-[#08285a]" />
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail professionnel *" aria-label="E-mail" className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-[#08285a]" />
              <input value={entreprise} onChange={(e) => setEntreprise(e.target.value)} placeholder="Entreprise" aria-label="Entreprise" className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-[#08285a]" />
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border-2 p-4 transition" style={{ borderColor: pilote ? RED : "#e2e8f0", background: pilote ? "#fff1f2" : "white" }}>
                <input type="checkbox" checked={pilote} onChange={(e) => setPilote(e.target.checked)} className="mt-1 h-5 w-5 accent-[#e2141e]" />
                <span>
                  <span className="block font-bold">🚀 Je veux être entreprise pilote</span>
                  <span className="block text-sm text-slate-500">On en parle 15 min après le webinaire.</span>
                </span>
              </label>
              <button type="submit" disabled={state === "sending"} className="w-full rounded-xl px-5 py-4 text-lg font-extrabold text-white transition hover:opacity-90 disabled:opacity-60" style={{ background: RED }}>
                {state === "sending" ? "Envoi…" : "Je m'inscris (gratuit)"}
              </button>
              {state === "error" && <p className="text-sm font-semibold text-red-600">Vérifiez votre e-mail et réessayez.</p>}
              <p className="text-xs text-slate-400">Votre e-mail sert uniquement à vous envoyer le lien et le replay.</p>
            </form>
          )}
        </section>
      </main>
    </div>
  );
}
