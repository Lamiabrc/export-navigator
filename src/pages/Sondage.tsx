import * as React from "react";
import { Link, useSearchParams } from "react-router-dom";
import logo from "@/assets/mpl-logo.webp";

/*
 * Sondage express « IA & export » : 4 questions à gros boutons, puis résultats des pairs.
 * Lien prospection : /sondage?src=linkedin&utm_campaign=...
 */

const NAVY = "#08285a";
const RED = "#e2141e";
const MIN_RESULTS = 20; // en dessous, on n'affiche pas de pourcentages (échantillon trop faible)

type Key = "heures" | "tache" | "ia" | "region";
const QUESTIONS: { key: Key; q: string; options: { v: string; label: string; icon: string }[] }[] = [
  {
    key: "heures",
    q: "Combien d'heures par semaine votre équipe export passe-t-elle sur l'administratif ?",
    options: [
      { v: "lt2", label: "Moins de 2 h", icon: "⏱️" },
      { v: "2-5", label: "2 à 5 h", icon: "🕑" },
      { v: "5-10", label: "5 à 10 h", icon: "🕔" },
      { v: "10+", label: "Plus de 10 h", icon: "🔥" },
    ],
  },
  {
    key: "tache",
    q: "La tâche qui vous fait perdre le plus de temps ?",
    options: [
      { v: "devis", label: "Devis et offres", icon: "🧾" },
      { v: "documents", label: "Documents et douane", icon: "📦" },
      { v: "relances", label: "E-mails et relances", icon: "✉️" },
      { v: "regles", label: "Suivre les règles pays", icon: "🌍" },
    ],
  },
  {
    key: "ia",
    q: "L'IA dans votre service export ?",
    options: [
      { v: "non", label: "Pas encore", icon: "🚫" },
      { v: "teste", label: "On teste", icon: "🧪" },
      { v: "quotidien", label: "Au quotidien", icon: "⚡" },
    ],
  },
  {
    key: "region",
    q: "Votre région ?",
    options: [
      { v: "bretagne", label: "Bretagne", icon: "📍" },
      { v: "pdl", label: "Pays de la Loire", icon: "📍" },
      { v: "normandie", label: "Normandie", icon: "📍" },
      { v: "idf", label: "Île-de-France", icon: "📍" },
      { v: "autre", label: "Ailleurs", icon: "🗺️" },
    ],
  },
];

type Stats = { total: number } & Record<Key, Record<string, number>>;

export default function Sondage() {
  const [sp] = useSearchParams();
  const [step, setStep] = React.useState(0);
  const [answers, setAnswers] = React.useState<Partial<Record<Key, string>>>({});
  const [stats, setStats] = React.useState<Stats | null>(null);
  const [sending, setSending] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [emailSent, setEmailSent] = React.useState(false);

  React.useEffect(() => {
    document.title = "Sondage express : votre service export et l'IA | MPL Export Conseil";
  }, []);

  const done = step >= QUESTIONS.length;
  const source = (sp.get("src") || sp.get("utm_source") || "direct").slice(0, 60);
  const campaign = (sp.get("utm_campaign") || "sondage-ia-export").slice(0, 80);

  async function submit(final: Partial<Record<Key, string>>) {
    setSending(true);
    try {
      const r = await fetch("/api/survey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...final, source, campaign }),
      });
      const j = await r.json();
      if (j.ok) setStats(j.stats);
    } catch {
      /* les résultats restent indisponibles, le parcours continue */
    } finally {
      setSending(false);
    }
    if (typeof window !== "undefined" && typeof window.gtag === "function") {
      window.gtag("event", "sondage_done", { source, ...final });
    }
  }

  function choose(key: Key, v: string) {
    const next = { ...answers, [key]: v };
    setAnswers(next);
    const s = step + 1;
    setStep(s);
    if (s >= QUESTIONS.length) submit(next);
  }

  async function sendEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email.trim())) return;
    await fetch("/api/survey", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), source, campaign: campaign + "-resultats" }),
    }).catch(() => null);
    setEmailSent(true);
  }

  const pct = (k: Key, v: string) => {
    if (!stats) return 0;
    const m = stats[k] || {};
    const tot = Object.values(m).reduce((a, b) => a + b, 0);
    return tot ? Math.round(((m[v] || 0) / tot) * 100) : 0;
  };
  const enough = !!stats && stats.total >= MIN_RESULTS;

  return (
    <div className="min-h-screen text-white" style={{ background: `radial-gradient(circle at 20% 0%, #1d4f9a 0%, ${NAVY} 55%)` }}>
      <div className="h-2 w-full" style={{ background: RED }} />
      <header className="mx-auto flex max-w-3xl items-center justify-between px-5 py-5">
        <Link to="/" className="flex items-center gap-3">
          <span className="rounded-xl bg-white p-1.5"><img src={logo} alt="MPL Export Conseil" className="h-10 w-10 object-contain" /></span>
          <span className="hidden text-sm font-semibold text-blue-100 sm:inline">MPL Export Conseil</span>
        </Link>
        {!done && (
          <div className="flex gap-2" aria-label={`Question ${step + 1} sur ${QUESTIONS.length}`}>
            {QUESTIONS.map((_, i) => (
              <span key={i} className="h-2.5 w-8 rounded-full transition-all" style={{ background: i <= step ? RED : "rgba(255,255,255,.25)" }} />
            ))}
          </div>
        )}
      </header>

      <main className="mx-auto max-w-3xl px-5 pb-16">
        {!done ? (
          <section key={step} className="animate-in fade-in slide-in-from-bottom-4 duration-300">
            {step === 0 && <p className="mb-3 text-xs font-bold uppercase tracking-[0.25em] text-red-300">Sondage express · 4 clics · anonyme</p>}
            <h1 className="text-3xl font-extrabold leading-tight sm:text-5xl">{QUESTIONS[step].q}</h1>
            <div className={`mt-8 grid gap-4 ${QUESTIONS[step].options.length > 4 ? "sm:grid-cols-3" : "sm:grid-cols-2"} grid-cols-1`}>
              {QUESTIONS[step].options.map((o) => (
                <button
                  key={o.v}
                  type="button"
                  onClick={() => choose(QUESTIONS[step].key, o.v)}
                  className="group flex items-center gap-4 rounded-2xl border-2 border-white/20 bg-white/10 px-6 py-6 text-left text-xl font-bold backdrop-blur transition hover:-translate-y-0.5 hover:border-white hover:bg-white hover:text-[#08285a] active:scale-[.98] sm:text-2xl"
                >
                  <span className="text-3xl">{o.icon}</span>
                  {o.label}
                </button>
              ))}
            </div>
            {step > 0 && (
              <button type="button" onClick={() => setStep(step - 1)} className="mt-6 text-sm text-blue-200 underline-offset-4 hover:underline">
                ← Question précédente
              </button>
            )}
          </section>
        ) : (
          <section className="space-y-8">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-red-300">Merci !</p>
              <h1 className="mt-2 text-3xl font-extrabold sm:text-5xl">
                {sending ? "Calcul des résultats…" : enough ? `Ce que répondent ${stats!.total} pros de l'export` : "Vous faites partie des premiers répondants"}
              </h1>
              {!sending && !enough && (
                <p className="mt-3 text-lg text-blue-100">Les résultats s'affichent dès {MIN_RESULTS} réponses. Laissez votre e-mail pour les recevoir.</p>
              )}
            </div>

            {enough &&
              QUESTIONS.slice(0, 3).map((q) => (
                <div key={q.key} className="rounded-2xl bg-white/10 p-5">
                  <p className="font-semibold text-blue-100">{q.q}</p>
                  <div className="mt-4 space-y-3">
                    {q.options.map((o) => {
                      const p = pct(q.key, o.v);
                      const mine = answers[q.key] === o.v;
                      return (
                        <div key={o.v}>
                          <div className="flex justify-between text-sm font-semibold">
                            <span>{o.icon} {o.label}{mine ? "  · votre réponse" : ""}</span>
                            <span>{p} %</span>
                          </div>
                          <div className="mt-1 h-4 rounded-full bg-white/15">
                            <div className="h-4 rounded-full transition-all duration-700" style={{ width: `${Math.max(p, 2)}%`, background: mine ? RED : "#ffffff" }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

            <div className="grid gap-4 sm:grid-cols-2">
              <Link
                to={`/test-export-ia?utm_source=${encodeURIComponent(source)}&utm_campaign=${encodeURIComponent(campaign)}`}
                className="flex flex-col rounded-2xl p-6 text-white shadow-xl transition hover:-translate-y-0.5"
                style={{ background: RED }}
              >
                <span className="text-3xl">⏱️</span>
                <span className="mt-2 text-2xl font-extrabold">Combien d'heures récupérer ?</span>
                <span className="mt-1 text-sm text-red-100">Test chiffré en 2 min →</span>
              </Link>
              <Link to="/contact?offer=diagnostic" className="flex flex-col rounded-2xl bg-white p-6 text-[#08285a] shadow-xl transition hover:-translate-y-0.5">
                <span className="text-3xl">📞</span>
                <span className="mt-2 text-2xl font-extrabold">Diagnostic gratuit</span>
                <span className="mt-1 text-sm text-slate-500">30 min avec Lamia Bréchet →</span>
              </Link>
            </div>

            <form onSubmit={sendEmail} className="flex flex-col gap-3 rounded-2xl bg-white/10 p-5 sm:flex-row">
              {emailSent ? (
                <p className="font-semibold">✅ C'est noté : vous recevrez les résultats du sondage.</p>
              ) : (
                <>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Votre e-mail pour recevoir les résultats"
                    className="flex-1 rounded-xl px-4 py-3 text-[#08285a] outline-none"
                    aria-label="E-mail"
                  />
                  <button type="submit" className="rounded-xl bg-white px-5 py-3 font-bold text-[#08285a] hover:bg-blue-50">Recevoir</button>
                </>
              )}
            </form>
            <p className="text-xs text-blue-200">Réponses anonymes. L'e-mail, facultatif, sert uniquement à envoyer les résultats.</p>
          </section>
        )}
      </main>
    </div>
  );
}
