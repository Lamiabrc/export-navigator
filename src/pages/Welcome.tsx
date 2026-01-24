import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/BrandLogo";

const TOOL_ROUTE = "/export-navigator";
const CONTACT_ROUTE = "/contact";
const LEAD_MAGNET_ROUTE = "/lead-magnet";

const PHONE = "+33676435551";
const PHONE_LABEL = "06 76 43 55 51";
const EMAIL = "lamia.brechet@outlook.fr";

const audience = [
  "PME / ETI qui exportent (ou veulent exporter) depuis la France",
  "ADV, Supply, Douane, Finance, Direction",
  "Entreprises exposées aux litiges, retards, surcoûts et blocages",
];

const painPoints = [
  "Documents incomplets ou incohérents (facture, packing, origine, licences…)",
  "Mauvais Incoterms / responsabilités floues → surcoûts & litiges",
  "Risque sanctions / conformité (contrôles, restrictions, exigences pays)",
  "Manque de visibilité : coûts réels, délais, risques, priorités",
];

const outcomes = [
  "Un diagnostic clair + une checklist actionnable en 24–72h",
  "Un plan d’action priorisé (quick wins + structure)",
  "Des modèles prêts à l’emploi : checklists, trames, process, RACI",
  "Un “copilote IA Export” pour obtenir un 1er niveau de réponse en autonomie",
];

const methodology = [
  "Cadrage (30–45 min) : périmètre, pays, contraintes, objectifs",
  "Collecte : docs, expéditions, coûts, process, outils",
  "Analyse : risques, causes racines, priorités et impacts",
  "Restitution : plan d’action + outils (checklists + templates)",
];

const faqs = [
  {
    q: "Je vends un produit X vers un pays Y : quels documents sont indispensables ?",
    a: "L’outil IA te donne un premier niveau de réponse (documents, points de vigilance, contrôle des incohérences). Ensuite, on sécurise selon ton cas réel (produit, pays, incoterm, transport, client, règlementation).",
  },
  {
    q: "Est-ce que vous remplacez un transitaire / un déclarant ?",
    a: "Non. On fiabilise ton flux et tes décisions (process, conformité, coûts, responsabilités). On travaille avec tes partenaires (transitaire, douane, transport) pour que tout soit carré.",
  },
  {
    q: "Est-ce que c’est compatible avec une petite structure (PME) ?",
    a: "Oui. L’approche est pensée pour être simple, pragmatique et rentable : quick wins + structure légère, sans usine à gaz.",
  },
  {
    q: "Combien de temps pour voir des résultats ?",
    a: "Souvent dès le diagnostic : on identifie rapidement les erreurs récurrentes (docs, incoterms, responsabilités, coûts). Ensuite on stabilise avec checklists & pilotage.",
  },
  {
    q: "Mes données sont-elles confidentielles ?",
    a: "Oui. On peut travailler avec des documents anonymisés si besoin, et on formalise un cadre de confidentialité (NDA) si tu le souhaites.",
  },
  {
    q: "Je veux juste un avis rapide avant une expédition : c’est possible ?",
    a: "Oui. Le diagnostic flash est fait pour ça : entretien + revue rapide + actions immédiates.",
  },
];

function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
}

export default function Welcome() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <div className="h-2 bg-gradient-to-r from-blue-600 via-white to-red-600" />
      <div className="absolute inset-x-0 top-0 h-[360px] bg-gradient-to-br from-white via-blue-50 to-red-50" />

      <div className="relative z-10 max-w-6xl mx-auto px-6 pt-10 pb-16 space-y-12">
        {/* Header */}
        <header className="flex items-center justify-between gap-4">
          <BrandLogo
            className="flex items-center gap-3"
            imageClassName="h-9"
            titleClassName="text-sm font-semibold uppercase tracking-[0.2em] text-slate-900"
            subtitleClassName="text-xs text-slate-500"
          />

          <div className="hidden md:flex items-center gap-2 text-sm">
            <button
              className="px-3 py-2 rounded-lg hover:bg-slate-50 text-slate-600"
              onClick={() => scrollToId("services")}
            >
              Prestations
            </button>
            <button
              className="px-3 py-2 rounded-lg hover:bg-slate-50 text-slate-600"
              onClick={() => scrollToId("outil")}
            >
              Outil IA
            </button>
            <button
              className="px-3 py-2 rounded-lg hover:bg-slate-50 text-slate-600"
              onClick={() => scrollToId("tarifs")}
            >
              Tarifs
            </button>
            <button
              className="px-3 py-2 rounded-lg hover:bg-slate-50 text-slate-600"
              onClick={() => scrollToId("faq")}
            >
              FAQ
            </button>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => navigate("/login")}>
              Se connecter
            </Button>
            <Button onClick={() => navigate("/register")}>Créer un compte</Button>
          </div>
        </header>

        {/* Hero */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-10 items-start"
        >
          <div className="space-y-6">
            <div className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-4 py-1 text-xs uppercase tracking-[0.35em] text-blue-700">
              MPL Conseil Export — Audit, Support & Copilote IA
            </div>

            <h1 className="text-4xl md:text-5xl font-semibold leading-tight text-slate-900">
              Sécurisez vos opérations export.
              <span className="block text-slate-700">
                Réduisez les risques, les coûts et les erreurs.
              </span>
            </h1>

            <p className="text-lg text-slate-600 leading-relaxed">
              Un accompagnement clair et pragmatique pour exporter depuis la France en conformité,
              avec une méthode, des checklists, et un outil IA pour répondre aux premières questions
              (produit + destination + incoterm).
            </p>

            <div className="flex flex-wrap gap-3">
              <Button onClick={() => navigate(TOOL_ROUTE)}>
                Tester l’outil IA (diagnostic rapide)
              </Button>
              <Button variant="outline" onClick={() => navigate(CONTACT_ROUTE)}>
                Demander un audit / conseil
              </Button>
              <Button variant="outline" onClick={() => navigate(LEAD_MAGNET_ROUTE)}>
                Recevoir la checklist Export
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600">
              <span className="font-semibold text-slate-900">Rendez-vous gratuit (20–30 min)</span>
              <a className="text-slate-900 hover:underline" href={`tel:${PHONE}`}>
                {PHONE_LABEL}
              </a>
              <a className="text-slate-900 hover:underline" href={`mailto:${EMAIL}`}>
                {EMAIL}
              </a>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white/70 px-4 py-3 text-sm text-slate-600">
              <span className="font-semibold text-slate-900">Objectif :</span>{" "}
              te donner une réponse exploitable immédiatement (outil IA), puis sécuriser ton flux avec
              un audit et des actions concrètes.
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">À qui s’adresse MPL Conseil Export ?</h3>
              <ul className="mt-3 space-y-2 text-sm text-slate-600 list-disc pl-5">
                {audience.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>

            <div className="border-t border-slate-100 pt-5">
              <h3 className="text-sm font-semibold text-slate-900">Situations fréquentes</h3>
              <ul className="mt-3 space-y-2 text-sm text-slate-600 list-disc pl-5">
                {painPoints.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </motion.section>

        {/* Outil IA */}
        <section id="outil" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Copilote IA Export</h2>
              <p className="mt-1 text-sm text-slate-600">
                Pour répondre aux premières questions, orienter les documents, et détecter les incohérences.
                (Puis validation humaine selon les cas.)
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button onClick={() => navigate(TOOL_ROUTE)}>Lancer un diagnostic</Button>
              <Button variant="outline" onClick={() => navigate(CONTACT_ROUTE)}>
                Parler à un expert
              </Button>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-slate-600">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div className="font-semibold text-slate-900">Entrées simples</div>
              <div className="mt-1">Produit, destination, incoterm, mode de transport.</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div className="font-semibold text-slate-900">Sorties utiles</div>
              <div className="mt-1">Documents attendus, points de vigilance, checklist.</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div className="font-semibold text-slate-900">Action commerciale</div>
              <div className="mt-1">À tout moment : demander un audit ou un support.</div>
            </div>
          </div>
        </section>

        {/* Ce que vous obtenez */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">Ce que vous obtenez</h3>
            <ul className="mt-4 space-y-2 text-sm text-slate-600 list-disc pl-5">
              {outcomes.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>

            <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
              <span className="font-semibold">Astuce :</span> commencez par l’outil IA → vous aurez déjà une base,
              et l’audit viendra sécuriser et industrialiser.
            </div>
          </div>

          <div id="services" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">Prestations principales</h3>
            <div className="mt-4 grid grid-cols-1 gap-4 text-sm text-slate-600">
              <div>
                <div className="font-semibold text-slate-900">Vérification des flux Export</div>
                <div>Cartographie du flux, contrôle docs, Incoterms, checklist “zéro oubli”.</div>
              </div>
              <div>
                <div className="font-semibold text-slate-900">Veille & conformité</div>
                <div>Points de vigilance, exigences documentaires, mise à jour des process.</div>
              </div>
              <div>
                <div className="font-semibold text-slate-900">Optimisation des coûts</div>
                <div>Transport, assurances, écarts de facturation, quick wins.</div>
              </div>
              <div>
                <div className="font-semibold text-slate-900">Étude concurrentielle</div>
                <div>Benchmark, positionnement, opportunités pays et segments.</div>
              </div>
            </div>
          </div>
        </section>

        {/* Tarifs */}
        <section id="tarifs" className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">Méthodologie</h3>
            <ol className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-slate-600 list-decimal pl-5">
              {methodology.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ol>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">Formules & tarifs (à partir de)</h3>
            <div className="mt-4 space-y-4 text-sm text-slate-600">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="font-semibold text-slate-900">Pack Diagnostic Flash (1–2 jours)</div>
                  <div>Entretien + revue rapide + 10 actions immédiates</div>
                </div>
                <div className="font-semibold text-slate-900 whitespace-nowrap">650 € HT</div>
              </div>

              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="font-semibold text-slate-900">Pack Audit Complet (3–7 jours)</div>
                  <div>Cartographie + contrôle + plan d’action complet</div>
                </div>
                <div className="font-semibold text-slate-900 whitespace-nowrap">1 950 € HT</div>
              </div>

              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="font-semibold text-slate-900">Pilotage & veille (mensuel)</div>
                  <div>Veille + point mensuel + mise à jour checklists</div>
                </div>
                <div className="font-semibold text-slate-900 whitespace-nowrap">290 € HT / mois</div>
              </div>

              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
                Options : optimisation coûts, étude concurrentielle, kit export, support opérationnel.
                <div className="mt-1 text-red-800">TJM : 450–650 € HT / jour.</div>
              </div>

              <div className="flex flex-wrap gap-3 pt-1">
                <Button onClick={() => navigate(CONTACT_ROUTE)}>Demander un devis</Button>
                <Button variant="outline" onClick={() => navigate(TOOL_ROUTE)}>
                  Tester l’outil IA
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">FAQ — premières questions</h3>
          <div className="mt-4 space-y-3">
            {faqs.map((item) => (
              <details
                key={item.q}
                className="group rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
              >
                <summary className="cursor-pointer list-none font-semibold text-slate-900 flex items-center justify-between gap-3">
                  <span>{item.q}</span>
                  <span className="text-slate-500 group-open:rotate-180 transition-transform">⌄</span>
                </summary>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">{item.a}</p>
              </details>
            ))}
          </div>

          <div className="mt-5 text-xs text-slate-500">
            Note : les informations fournies par l’outil IA sont un premier niveau d’orientation.
            La validation finale dépend du contexte réel (produit, pays, client, transport, incoterms, exigences).
          </div>
        </section>

        {/* Footer CTA */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="text-sm text-slate-600">
            <span className="font-semibold text-slate-900">MPL Conseil Export</span> — Lamia Bréchet —
            <span className="mx-2">•</span>
            <a className="hover:underline" href={`mailto:${EMAIL}`}>
              {EMAIL}
            </a>
            <span className="mx-2">•</span>
            <a className="hover:underline" href={`tel:${PHONE}`}>
              {PHONE_LABEL}
            </a>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => navigate("/login")}>
              Se connecter
            </Button>
            <Button onClick={() => navigate("/register")}>Créer un compte</Button>
          </div>
        </section>
      </div>
    </div>
  );
}
