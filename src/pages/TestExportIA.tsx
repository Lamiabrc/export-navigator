import * as React from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, CheckCircle2, Clock, Gauge, Sparkles } from "lucide-react";
import { MarketingLayout } from "@/components/marketing/MarketingLayout";

/*
 * Test « Combien de temps votre service export peut gagner avec l'IA ? »
 * Aucun appel à une IA : calcul local, hypothèses affichées (mêmes que la page d'accueil).
 * Lien personnalisable depuis un mail : /test-export-ia?e=NomEntreprise&utm_source=email&utm_campaign=...
 */

const HOURLY_COST = 30; // €/h chargé, assistante export (Hays 2026 + charges Urssaf ≈ 42 %)
const WEEKS = 45; // semaines travaillées par an
const SHARE_LOW = 0.3; // part du temps répétitif reprise par l'IA, hypothèse prudente
const SHARE_HIGH = 0.5; // hypothèse haute, celle de la page d'accueil

const HOURS_OPTIONS = [
  { value: 3, label: "Moins de 4 h" },
  { value: 7, label: "Entre 4 et 10 h" },
  { value: 12, label: "Entre 10 et 15 h" },
  { value: 18, label: "Plus de 15 h" },
];

const TASKS = [
  { id: "devis", label: "Devis et offres de prix", tip: "Préparer un devis à partir de vos tarifs, Incoterms et conditions client." },
  { id: "docs", label: "Documents export (factures, packing lists, certificats)", tip: "Pré-remplir les documents à partir de la commande, à vérifier avant envoi." },
  { id: "mails", label: "Réponses aux e-mails clients et importateurs", tip: "Brouillons de réponses dans la langue du client, à partir de vos informations." },
  { id: "regles", label: "Recherche de règles pays, normes, Incoterms", tip: "Synthèse rapide des points à vérifier, avec renvoi vers les sources officielles." },
  { id: "traduction", label: "Traductions (fiches produits, offres)", tip: "Traductions fidèles à votre vocabulaire technique." },
  { id: "suivi", label: "Suivi de commandes et relances", tip: "Relances et points d'étape rédigés automatiquement." },
];

const MATURITY = [
  {
    id: "usage",
    q: "Votre équipe utilise-t-elle déjà des outils d'IA (ChatGPT, Copilot, Mistral…) ?",
    options: ["Non, pas encore", "Ponctuellement, chacun de son côté", "Régulièrement, avec des règles communes"],
  },
  {
    id: "equipe",
    q: "Avez-vous une équipe ou un référent IA / numérique en interne ?",
    options: ["Non", "Un référent ou un prestataire", "Oui, une équipe dédiée"],
  },
  {
    id: "donnees",
    q: "Vos informations export (tarifs, fiches produits, clients) sont-elles centralisées ?",
    options: ["Non, dispersées (fichiers, e-mails)", "En partie", "Oui (ERP, CRM, base partagée)"],
  },
];

const LEVELS = [
  {
    name: "Découverte",
    text: "Le bon point de départ : un atelier pratique pour que l'équipe export prenne en main l'IA sur ses vraies tâches, avec des règles simples (données, vérification).",
  },
  {
    name: "Prise en main",
    text: "Vos équipes testent déjà. L'enjeu est de passer des essais individuels à des usages communs et fiables, et de cibler 2 ou 3 tâches export à fort volume.",
  },
  {
    name: "Accélération",
    text: "Vous avez les bases (outils, compétences, données). Un agent IA sur mesure, branché sur vos informations export, peut maintenant faire gagner du temps à toute l'équipe.",
  },
];

const fmt = (n: number) => Math.round(n).toLocaleString("fr-FR");

export default function TestExportIA() {
  const [searchParams] = useSearchParams();
  const company = (searchParams.get("e") || "").slice(0, 80);
  const [people, setPeople] = React.useState(2);
  const [hours, setHours] = React.useState(7);
  const [tasks, setTasks] = React.useState<string[]>(["devis", "docs", "mails"]);
  const [answers, setAnswers] = React.useState<Record<string, number>>({});
  const [done, setDone] = React.useState(false);
  const resultRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    document.title = "Test : combien de temps votre service export peut gagner avec l'IA | MPL Export Conseil";
    const desc = document.querySelector('meta[name="description"]');
    desc?.setAttribute("content", "Test gratuit en 2 minutes : estimez les heures que l'IA peut rendre à votre équipe export et votre niveau de maturité IA.");
  }, []);

  const toggleTask = (id: string) => setTasks((cur) => (cur.includes(id) ? cur.filter((t) => t !== id) : [...cur, id]));

  const yearly = people * hours * WEEKS;
  const low = yearly * SHARE_LOW;
  const high = yearly * SHARE_HIGH;
  const answered = MATURITY.every((m) => answers[m.id] !== undefined);
  const score = MATURITY.reduce((s, m) => s + (answers[m.id] ?? 0), 0);
  const level = score <= 1 ? LEVELS[0] : score <= 3 ? LEVELS[1] : LEVELS[2];
  const canSubmit = tasks.length > 0 && answered;

  function showResult() {
    if (!canSubmit) return;
    setDone(true);
    if (typeof window !== "undefined" && typeof window.gtag === "function") {
      window.gtag("event", "test_export_ia_done", { company: company || "direct", level: level.name, people, hours });
    }
    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  const contactMessage = [
    `Bonjour, j'ai fait le test « IA & export »${company ? ` pour ${company}` : ""}.`,
    `Équipe export : ${people} personne(s), environ ${hours} h par semaine et par personne sur des tâches répétitives.`,
    `Estimation : ${fmt(low)} à ${fmt(high)} heures par an récupérables.`,
    `Tâches prioritaires : ${TASKS.filter((t) => tasks.includes(t.id)).map((t) => t.label).join(", ")}.`,
    `Niveau de maturité IA : ${level.name}.`,
    "Je souhaite recevoir mon diagnostic gratuit.",
  ].join("\n");
  const contactHref = `/contact?offer=diagnostic${company ? `&company=${encodeURIComponent(company)}` : ""}&message=${encodeURIComponent(contactMessage)}&utm_source=${encodeURIComponent(searchParams.get("utm_source") || "test")}&utm_campaign=${encodeURIComponent(searchParams.get("utm_campaign") || "test-export-ia")}`;

  const card = "rounded-[24px] border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/40 sm:p-8";
  const chip = (active: boolean) =>
    `rounded-xl border px-4 py-3 text-left text-sm transition ${active ? "border-emerald-600 bg-emerald-50 font-semibold text-emerald-900" : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"}`;

  return (
    <MarketingLayout>
      <main className="bg-[linear-gradient(135deg,#f1f5f9,#ffffff_45%,#ecfdf5)]">
        <section className="mkt-section">
          <div className="mkt-container max-w-3xl space-y-8">
            <header className="space-y-4">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">
                Test gratuit · 2 minutes{company ? ` · préparé pour ${company}` : ""}
              </p>
              <h1 className="text-3xl font-bold leading-tight tracking-tight text-slate-950 sm:text-4xl">
                Combien de temps votre service export peut-il gagner avec l'IA ?
              </h1>
              <p className="text-lg leading-relaxed text-slate-600">
                Répondez à quelques questions : vous obtenez une estimation en heures par an, les tâches à traiter en premier et votre niveau de maturité IA.
                Aucune inscription, rien n'est enregistré.
              </p>
            </header>

            <div className={card}>
              <h2 className="flex items-center gap-2 text-lg font-bold text-slate-950"><Clock className="h-5 w-5 text-emerald-700" />1. Votre équipe export</h2>
              <label className="mt-5 block text-sm font-semibold text-slate-800">
                Nombre de personnes qui traitent l'export : <span className="text-emerald-700">{people}</span>
                <input type="range" min={1} max={20} value={people} onChange={(e) => setPeople(Number(e.target.value))} className="mt-3 w-full accent-emerald-700" />
              </label>
              <p className="mt-6 text-sm font-semibold text-slate-800">Temps passé par personne et par semaine sur des tâches répétitives (devis, documents, e-mails…)</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {HOURS_OPTIONS.map((o) => (
                  <button key={o.value} type="button" onClick={() => setHours(o.value)} className={chip(hours === o.value)}>{o.label}</button>
                ))}
              </div>
            </div>

            <div className={card}>
              <h2 className="flex items-center gap-2 text-lg font-bold text-slate-950"><Sparkles className="h-5 w-5 text-emerald-700" />2. Les tâches qui prennent le plus de temps</h2>
              <p className="mt-1 text-sm text-slate-500">Cochez toutes celles qui concernent votre équipe.</p>
              <div className="mt-4 grid gap-2">
                {TASKS.map((t) => (
                  <button key={t.id} type="button" onClick={() => toggleTask(t.id)} className={chip(tasks.includes(t.id))} aria-pressed={tasks.includes(t.id)}>
                    {tasks.includes(t.id) ? "✓ " : ""}{t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className={card}>
              <h2 className="flex items-center gap-2 text-lg font-bold text-slate-950"><Gauge className="h-5 w-5 text-emerald-700" />3. Où en êtes-vous avec l'IA ?</h2>
              <div className="mt-4 space-y-6">
                {MATURITY.map((m) => (
                  <fieldset key={m.id}>
                    <legend className="text-sm font-semibold text-slate-800">{m.q}</legend>
                    <div className="mt-2 grid gap-2">
                      {m.options.map((label, i) => (
                        <button key={label} type="button" onClick={() => setAnswers((a) => ({ ...a, [m.id]: i }))} className={chip(answers[m.id] === i)}>{label}</button>
                      ))}
                    </div>
                  </fieldset>
                ))}
              </div>
            </div>

            <div className="text-center">
              <button type="button" onClick={showResult} disabled={!canSubmit} className="inline-flex items-center gap-2 rounded-full bg-emerald-700 px-8 py-4 text-base font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300">
                Voir mon résultat <ArrowRight className="h-4 w-4" />
              </button>
              {!canSubmit && <p className="mt-2 text-xs text-slate-500">Cochez au moins une tâche et répondez aux 3 questions.</p>}
            </div>

            {done && (
              <div ref={resultRef} className="space-y-6 rounded-[28px] bg-[#08285a] p-6 text-white shadow-xl sm:p-10">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">Votre résultat{company ? ` · ${company}` : ""}</p>
                <div>
                  <p className="text-4xl font-bold sm:text-5xl">{fmt(low)} à {fmt(high)} h / an</p>
                  <p className="mt-2 text-lg text-slate-200">
                    soit environ {fmt(low / 7)} à {fmt(high / 7)} jours de travail, ou {fmt(low * HOURLY_COST)} à {fmt(high * HOURLY_COST)} € de temps chargé par an.
                  </p>
                </div>
                <div>
                  <p className="font-semibold text-emerald-300">Par où commencer</p>
                  <ul className="mt-3 space-y-3">
                    {TASKS.filter((t) => tasks.includes(t.id)).slice(0, 3).map((t) => (
                      <li key={t.id} className="flex gap-3 text-sm leading-relaxed text-slate-100">
                        <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-300" />
                        <span><strong>{t.label}</strong> : {t.tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-2xl bg-white/10 p-5">
                  <p className="font-semibold">Maturité IA : <span className="text-emerald-300">{level.name}</span></p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-200">{level.text}</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Link to={contactHref} className="inline-flex items-center gap-2 rounded-full bg-[#e2141e] px-6 py-3 text-sm font-semibold text-white hover:bg-[#c0101a]">
                    Recevoir mon diagnostic gratuit <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link to="/about" className="inline-flex items-center gap-2 rounded-full border border-white/40 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10">
                    Qui vous accompagne
                  </Link>
                </div>
                <p className="text-xs leading-relaxed text-slate-300">
                  Estimation indicative, pas une promesse. Hypothèses : l'IA reprend 30 à 50 % du temps passé sur les tâches répétitives ;
                  {" "}{WEEKS} semaines travaillées par an ; ≈ {HOURLY_COST} € de l'heure chargé (salaire médian assistante export Hays 2026, charges ≈ 42 % Urssaf).
                  Les points sensibles (douane, normes, fiscalité) restent vérifiés par votre équipe et les sources officielles.
                </p>
              </div>
            )}
          </div>
        </section>
      </main>
    </MarketingLayout>
  );
}
