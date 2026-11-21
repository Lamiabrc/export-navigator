import { Link } from "react-router-dom";
import { ArrowRight, BookOpenCheck, Brain, CheckCircle2, Compass, Mail, Phone, Scale, Users } from "lucide-react";

import { MarketingLayout } from "@/components/marketing/MarketingLayout";
import { usePageMeta } from "@/hooks/usePageMeta";

const PHONE_RAW = "0676435551";
const PHONE_PRETTY = "06 76 43 55 51";
const EMAIL = "contact@exportfrancefacile.com";

const PATH = [
  {
    icon: Compass,
    title: "Le terrain export, depuis 2018",
    body: "Diplômée en import-export à Rennes en 2018, j'ai travaillé avec des PME comme avec des grands groupes, au plus près de leurs process : ce qui est indispensable, ce qui bloque, ce qui fait gagner du temps.",
  },
  {
    icon: BookOpenCheck,
    title: "L'international et ses signaux",
    body: "Le certificat « Environnement international des entreprises » du CNAM m'a apporté une lecture des pays, des risques et du contexte qui pèsent sur les flux.",
  },
  {
    icon: Scale,
    title: "Le droit et la conformité",
    body: "Une licence de droit pour mieux comprendre les responsabilités, les documents, les clauses et les points de vigilance réglementaires.",
  },
  {
    icon: Brain,
    title: "L'IA, au service des équipes",
    body: "Aujourd'hui, je rassemble ce parcours pour aider les équipes export à intégrer l'IA dans leur travail quotidien, sur leurs propres dossiers.",
  },
];

const CONVICTIONS = [
  "Partir de vos produits, de vos marchés et de leur réglementation, pas d'un discours général sur l'IA.",
  "Travailler avec l'équipe déjà en place : assistante export, ADV, commerciaux, responsable export.",
  "L'IA prépare le travail, votre équipe garde la décision et la vérification.",
  "Les points sensibles (douane, normes, fiscalité) se vérifient toujours auprès de sources officielles.",
];

export default function About() {
  usePageMeta("meta.about.title", "meta.about.description");

  return (
    <MarketingLayout>
      <main className="bg-[linear-gradient(135deg,#f1f5f9,#ffffff_45%,#ecfdf5)]">
        <section className="mkt-section">
          <div className="mkt-container grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-6">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">MPL Export Conseil · À propos</p>
              <h1 className="max-w-2xl text-4xl font-bold leading-tight tracking-tight text-slate-950 sm:text-5xl">
                Lamia Bréchet, l'export et l'IA au service de votre équipe.
              </h1>
              <p className="max-w-xl text-lg leading-relaxed text-slate-600">
                J'accompagne les PME et ETI qui exportent à intégrer l'IA dans le travail de leurs équipes, sans s'y perdre :
                un devis et un cadrage sur votre réalité, un atelier sur mesure, puis un suivi pour que les nouveaux usages tiennent.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link to="/contact?offer=atelier" className="inline-flex items-center gap-2 rounded-full bg-emerald-700 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-800">
                  Demander un devis <ArrowRight className="h-4 w-4" />
                </Link>
                <Link to="/pricing" className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-50">
                  Découvrir l'atelier IA & Export
                </Link>
              </div>
            </div>
            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/40 sm:p-8">
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-emerald-700">
                <Users className="h-4 w-4" />Ce que je défends
              </p>
              <ul className="mt-5 space-y-4">
                {CONVICTIONS.map((item) => (
                  <li key={item} className="flex gap-3 text-sm leading-relaxed text-slate-700">
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-700" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="mkt-section bg-white">
          <div className="mkt-container space-y-8">
            <div className="max-w-2xl space-y-3">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">Mon parcours</p>
              <h2 className="text-3xl font-bold tracking-tight text-slate-950">Une expertise construite sur le terrain</h2>
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              {PATH.map(({ icon: Icon, title, body }) => (
                <div key={title} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-6">
                  <Icon className="h-6 w-6 text-emerald-700" />
                  <h3 className="mt-4 text-lg font-semibold text-slate-900">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mkt-section">
          <div className="mkt-container">
            <div className="rounded-[28px] bg-slate-950 p-8 text-white sm:p-10">
              <h2 className="text-2xl font-bold sm:text-3xl">Parlons de votre équipe export</h2>
              <p className="mt-3 max-w-2xl text-slate-300">
                Présentez-moi vos produits, vos marchés et votre organisation : le devis part de là.
              </p>
              <div className="mt-6 flex flex-wrap gap-4 text-sm">
                <a href={`tel:${PHONE_RAW}`} className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 font-semibold text-slate-950">
                  <Phone className="h-4 w-4" />{PHONE_PRETTY}
                </a>
                <a href={`mailto:${EMAIL}`} className="inline-flex items-center gap-2 rounded-full border border-white/30 px-5 py-3 font-semibold text-white">
                  <Mail className="h-4 w-4" />{EMAIL}
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>
    </MarketingLayout>
  );
}
