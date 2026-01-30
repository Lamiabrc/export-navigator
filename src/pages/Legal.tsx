import { Link, useParams } from "react-router-dom";

type LegalDoc = {
  title: string;
  intro?: string;
  sections: { h: string; p: string[] }[];
};

const DOCS: Record<string, LegalDoc> = {
  "mentions-legales": {
    title: "Mentions légales",
    intro: "Informations légales obligatoires — à compléter avec les données de l’éditeur.",
    sections: [
      {
        h: "Éditeur du site",
        p: [
          "Nom / Raison sociale : [À compléter]",
          "SIRET : [À compléter]",
          "Adresse : [À compléter]",
          "Email : [À compléter]",
        ],
      },
      { h: "Directeur de publication", p: ["[À compléter]"] },
      { h: "Hébergement", p: ["Hébergeur : Vercel Inc. (infrastructure cloud)."] },
    ],
  },
  confidentialite: {
    title: "Politique de confidentialité",
    intro: "Explique comment MPL Export Conseil collecte et utilise les données (contact, newsletter, comptes…).",
    sections: [
      {
        h: "Données collectées",
        p: [
          "Formulaire de contact : nom, email, message (et éventuellement société).",
          "Newsletter : email (et préférences si ajoutées).",
          "Compte : email, informations de profil (selon configuration).",
        ],
      },
      {
        h: "Finalités",
        p: ["Répondre aux demandes, fournir le service, améliorer l’outil, envoyer des infos si consentement."],
      },
      { h: "Durées de conservation", p: ["[À compléter]"] },
      { h: "Vos droits", p: ["Accès, rectification, suppression, opposition, portabilité — contact : [email]."] },
    ],
  },
  cookies: {
    title: "Politique cookies",
    intro: "Décrit les cookies et traceurs utilisés sur le site.",
    sections: [
      { h: "Cookies strictement nécessaires", p: ["Ex. session, authentification, préférences d’affichage."] },
      { h: "Mesure d’audience", p: ["[À compléter : outil, opt-in/opt-out, durée]."] },
      { h: "Gestion", p: ["Vous pouvez gérer vos choix via votre navigateur ou la bannière cookies."] },
    ],
  },
  cgu: {
    title: "Conditions Générales d’Utilisation (CGU)",
    intro: "Encadre l’utilisation du site et de l’outil (responsabilités, limites, disponibilité).",
    sections: [
      { h: "Accès au service", p: ["[À compléter]"] },
      { h: "Responsabilités", p: ["[À compléter]"] },
      { h: "Propriété intellectuelle", p: ["[À compléter]"] },
    ],
  },
  cgv: {
    title: "Conditions Générales de Vente (CGV)",
    intro: "Si tu vends une prestation (audit, consulting, abonnement), c’est ici.",
    sections: [
      { h: "Offres et prix", p: ["[À compléter]"] },
      { h: "Paiement et facturation", p: ["[À compléter]"] },
      { h: "Annulation / rétractation", p: ["[À compléter]"] },
    ],
  },
};

export default function Legal() {
  const { slug } = useParams();
  const doc = (slug && DOCS[slug]) || null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link to="/solutions" className="text-sm underline opacity-80 hover:opacity-100">
            ← Retour
          </Link>
          <div className="flex flex-wrap gap-3 text-sm">
            <Link to="/mentions-legales" className="underline opacity-80 hover:opacity-100">
              Mentions
            </Link>
            <Link to="/confidentialite" className="underline opacity-80 hover:opacity-100">
              Confidentialité
            </Link>
            <Link to="/cookies" className="underline opacity-80 hover:opacity-100">
              Cookies
            </Link>
            <Link to="/cgu" className="underline opacity-80 hover:opacity-100">
              CGU
            </Link>
            <Link to="/cgv" className="underline opacity-80 hover:opacity-100">
              CGV
            </Link>
          </div>
        </div>

        {!doc ? (
          <div className="rounded-xl border p-6">
            <h1 className="text-2xl font-bold">Document introuvable</h1>
            <p className="mt-2 opacity-80">Le document demandé n’existe pas. Utilise le menu ci-dessus.</p>
          </div>
        ) : (
          <article className="rounded-xl border p-6">
            <h1 className="text-3xl font-bold">{doc.title}</h1>
            {doc.intro ? <p className="mt-2 opacity-80">{doc.intro}</p> : null}

            <div className="mt-8 space-y-6">
              {doc.sections.map((s) => (
                <section key={s.h}>
                  <h2 className="text-xl font-semibold">{s.h}</h2>
                  <div className="mt-2 space-y-2">
                    {s.p.map((line, idx) => (
                      <p key={idx} className="leading-relaxed opacity-90">
                        {line}
                      </p>
                    ))}
                  </div>
                </section>
              ))}
            </div>

            <div className="mt-10 rounded-lg bg-muted p-4">
              <p className="text-sm opacity-80">
                Modèle à compléter avec tes informations légales.
              </p>
            </div>
          </article>
        )}
      </div>
    </div>
  );
}
