import * as React from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

type LegalDoc = {
  title: string;
  description?: string;
  sections: Array<{ title: string; content: React.ReactNode }>;
};

const LEGAL_DOCS: Record<string, LegalDoc> = {
  "mentions-legales": {
    title: "Mentions légales",
    description: "Informations légales du site MPL Export Conseil.",
    sections: [
      {
        title: "Éditeur du site",
        content: (
          <div className="space-y-2">
            <p>Nom / Raison sociale : <span className="font-semibold">À compléter</span></p>
            <p>Adresse : <span className="font-semibold">À compléter</span></p>
            <p>Email : <span className="font-semibold">À compléter</span></p>
            <p>SIRET / RCS : <span className="font-semibold">À compléter</span></p>
            <p>Directeur de publication : <span className="font-semibold">À compléter</span></p>
          </div>
        ),
      },
      {
        title: "Hébergement",
        content: (
          <div className="space-y-2">
            <p>Hébergeur : <span className="font-semibold">Vercel Inc.</span></p>
            <p>Le site est déployé via une infrastructure cloud.</p>
          </div>
        ),
      },
      {
        title: "Propriété intellectuelle",
        content: (
          <p>
            Les contenus (textes, visuels, marque, logo) sont protégés. Toute reproduction sans autorisation est interdite.
          </p>
        ),
      },
      {
        title: "Contact",
        content: (
          <p>
            Pour toute question :{" "}
            <Link className="underline underline-offset-4" to="/contact">
              contactez-nous
            </Link>
            .
          </p>
        ),
      },
    ],
  },

  confidentialite: {
    title: "Politique de confidentialité",
    description: "Comment nous collectons et utilisons vos données.",
    sections: [
      {
        title: "Données collectées",
        content: (
          <ul className="list-disc space-y-1 pl-5">
            <li>Email (Lead magnet / Newsletter / Veille)</li>
            <li>Préférences de veille (pays, codes HS) si vous les enregistrez</li>
            <li>Données techniques minimales (ex: user-agent) pour la sécurité et le diagnostic</li>
          </ul>
        ),
      },
      {
        title: "Finalités",
        content: (
          <ul className="list-disc space-y-1 pl-5">
            <li>Envoi du rapport PDF demandé</li>
            <li>Activation et envoi de la veille (si consentement)</li>
            <li>Amélioration du service (statistiques anonymisées / debugging)</li>
          </ul>
        ),
      },
      {
        title: "Base légale",
        content: (
          <ul className="list-disc space-y-1 pl-5">
            <li>Exécution du service demandé (rapport PDF)</li>
            <li>Consentement (newsletter / veille)</li>
            <li>Intérêt légitime (sécurité, prévention fraude, amélioration)</li>
          </ul>
        ),
      },
      {
        title: "Durées de conservation",
        content: (
          <p>
            À adapter selon votre politique. Par défaut : conservation limitée au nécessaire (ex: 12–24 mois)
            pour la veille, suppression sur demande.
          </p>
        ),
      },
      {
        title: "Vos droits",
        content: (
          <p>
            Vous pouvez demander l’accès, la rectification ou la suppression de vos données via{" "}
            <Link className="underline underline-offset-4" to="/contact">
              le formulaire de contact
            </Link>
            .
          </p>
        ),
      },
    ],
  },

  cookies: {
    title: "Cookies",
    description: "Informations sur l’usage des cookies.",
    sections: [
      {
        title: "Ce site utilise-t-il des cookies ?",
        content: (
          <p>
            Le site peut utiliser des stockages locaux (localStorage) pour améliorer l’expérience (ex: historique,
            préférences). Des cookies peuvent être ajoutés si vous activez des outils d’analytics.
          </p>
        ),
      },
      {
        title: "Gestion",
        content: (
          <p>
            Vous pouvez gérer les cookies via votre navigateur. Si vous ajoutez un bandeau de consentement, cette page
            doit être ajustée.
          </p>
        ),
      },
    ],
  },

  cgu: {
    title: "Conditions Générales d’Utilisation (CGU)",
    description: "Règles d’utilisation de la plateforme.",
    sections: [
      {
        title: "Objet",
        content: (
          <p>
            La plateforme fournit des outils d’aide à la décision export (estimation, veille, checklists). Les résultats
            sont indicatifs et nécessitent une validation humaine selon les cas.
          </p>
        ),
      },
      {
        title: "Responsabilité",
        content: (
          <p>
            MPL Export Conseil ne peut être tenu responsable d’une décision prise uniquement sur la base d’une estimation
            indicative. Vérifiez HS, origine, incoterms, sanctions et licences.
          </p>
        ),
      },
      {
        title: "Accès au service",
        content: (
          <p>
            L’accès peut être restreint à certaines fonctionnalités (espaces protégés). Des interruptions peuvent survenir
            pour maintenance.
          </p>
        ),
      },
    ],
  },

  cgv: {
    title: "Conditions Générales de Vente (CGV)",
    description: "Conditions applicables aux prestations/audits si vous facturez.",
    sections: [
      {
        title: "Prestations",
        content: (
          <p>
            Décrire ici vos offres (validation express, audit complet, accompagnement). À compléter selon votre modèle
            commercial.
          </p>
        ),
      },
      {
        title: "Tarification et paiement",
        content: <p>À compléter (prix, modalités, délais, facturation, etc.).</p>,
      },
      {
        title: "Rétractation / annulation",
        content: <p>À compléter selon votre cadre (B2B/B2C) et votre politique.</p>,
      },
    ],
  },
};

function getDoc(slug?: string): LegalDoc {
  const key = (slug || "").toLowerCase();
  return (
    LEGAL_DOCS[key] || {
      title: "Document légal",
      description: "Document introuvable.",
      sections: [
        {
          title: "Erreur",
          content: (
            <p>
              Ce document n’existe pas encore. Retournez à{" "}
              <Link className="underline underline-offset-4" to="/mentions-legales">
                Mentions légales
              </Link>
              .
            </p>
          ),
        },
      ],
    }
  );
}

export default function Legal() {
  const navigate = useNavigate();
  const { slug } = useParams();

  const doc = React.useMemo(() => getDoc(slug), [slug]);

  const links = [
    { to: "/mentions-legales", label: "Mentions légales" },
    { to: "/confidentialite", label: "Confidentialité" },
    { to: "/cookies", label: "Cookies" },
    { to: "/cgu", label: "CGU" },
    { to: "/cgv", label: "CGV" },
  ];

  return (
    <PublicLayout>
      <div className="space-y-8">
        <section className="space-y-3">
          <p className="text-xs uppercase tracking-[0.35em] text-blue-200">Informations</p>
          <h1 className="text-4xl font-semibold text-white">{doc.title}</h1>
          {doc.description ? <p className="text-lg text-slate-200">{doc.description}</p> : null}

          <div className="flex flex-wrap gap-2">
            {links.map((l) => (
              <Button
                key={l.to}
                variant="outline"
                className="border-white/20 text-slate-100 hover:bg-white/10"
                onClick={() => navigate(l.to)}
              >
                {l.label}
              </Button>
            ))}
          </div>
        </section>

        <Card className="border border-white/15 bg-white/10 text-white backdrop-blur">
          <CardHeader>
            <CardTitle>Contenu</CardTitle>
            <CardDescription className="text-slate-200">
              Pense à compléter les champs “À compléter” avec tes infos légales réelles.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            {doc.sections.map((s) => (
              <div key={s.title} className="space-y-2">
                <h2 className="text-xl font-semibold">{s.title}</h2>
                <div className="text-sm text-slate-200 leading-relaxed">{s.content}</div>
              </div>
            ))}

            <div className="flex flex-wrap gap-3 pt-2">
              <Button onClick={() => navigate("/contact")}>Nous contacter</Button>
              <Button
                variant="outline"
                className="border-white/20 text-slate-100 hover:bg-white/10"
                onClick={() => navigate("/")}
              >
                Retour accueil
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </PublicLayout>
  );
}
