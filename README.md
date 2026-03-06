# Export Navigator

Export Navigator est un outil SaaS d'aide a la decision import/export pour PME, ETI et equipes operations.
Il centralise des controles de conformite, des simulations de couts et des workflows de pilotage commercial/reglementaire.
Le produit est concu pour un usage bilingue FR/EN avec une mise en route rapide en environnement de test.
L'objectif: reduire les erreurs operationnelles et accelerer les decisions terrain.

## Fonctionnalites principales

- Cockpit export/import: vues de suivi, alertes, historique et priorisation des actions.
- Simulateurs et aides de calcul: couts, marges, taxes, incoterms, estimations de landed cost.
- Controles conformite: checks documentaires, screening de risques, parcours de verification.
- Veille et intelligence operationnelle: flux reglementaires/commerciaux et centre de veille.
- Copilot export (FR/EN): assistance conversationnelle et parcours guides.

## Cas d'usage

- Evaluer rapidement la faisabilite d'une operation export vers un pays cible.
- Preparer une proposition commerciale avec estimation de marge et points de vigilance.
- Verifier une facture/import avant validation interne.
- Suivre un portefeuille de dossiers export avec priorites quotidiennes.
- Partager des recommandations actionnables entre direction, commerce et operations.

## Stack technique

- Frontend: React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui.
- Backend: Vercel Functions (Node/TypeScript) + integrations Stripe/Supabase.
- Data: Supabase (auth, base de donnees, fonctions), avec certains fallbacks locaux en mode test.
- Outils: ESLint, TypeScript, scripts Node pour seed/import.

## Installation locale

Prerequis:

- Node.js 20+
- npm 10+

Etapes:

```bash
npm install
cp .env.example .env.local
npm run dev
```

Build de verification:

```bash
npm run build
```

## Variables d'environnement requises

Le fichier de reference est `.env.example`.

Variables minimales pour un fonctionnement connecte:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Variables backend frequentes selon modules:

- `OPENAI_API_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `APP_URL`
- `EMAIL_TRANSPORT_URL` (ou provider equivalent)
- `CRON_SECRET`

Notes de coherence:

- Certaines vues peuvent utiliser des donnees locales/de demonstration si Supabase n'est pas configure.
- Plusieurs modules API (billing, ingest, email) exigent des variables serveur pour etre operationnels.
- Des composants restent en cours de stabilisation; ils sont utilisables en mode test mais pas tous finalises pour production critique.

## Deploiement Vercel

1. Importer le repo dans Vercel.
2. Configurer les variables d'environnement depuis `Settings > Environment Variables` (Development, Preview, Production).
3. Verifier que les routes `api/*` sont bien deployees.
4. Lancer un deploiement Preview puis Production.

Commandes utiles locales avant push:

```bash
npm run typecheck
npm run build
```

## Securite et bonnes pratiques

- Ne jamais commiter de secrets (`.env`, cles API, certificats).
- Conserver uniquement des placeholders dans `.env.example`.
- Utiliser les variables d'environnement Vercel et Supabase pour tous les secrets.
- Regenerer immediatement toute cle exposee accidentellement.
- Voir `SECURITY.md` pour la procedure minimale.

## Statut produit

Version de test gratuite.

Le produit est deja exploitable pour evaluation fonctionnelle, avec plusieurs modules metier actifs.
Certaines briques (notamment quelques parcours avances et integrations) sont en cours de stabilisation.
