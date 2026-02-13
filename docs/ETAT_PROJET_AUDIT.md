# Audit technique — Export Navigator

## 1) Synthèse exécutive

Le projet est **riche fonctionnellement** et déjà structuré autour d’un socle moderne (React + Vite + TypeScript + Supabase + API Vercel + Electron), avec une vraie ambition produit (contrôle export, conformité, pricing, veille, assistant IA). L’état actuel montre un produit utilisable côté UI, mais avec des **dettes techniques concrètes** à traiter avant de viser une robustesse “production strict”.

### Ce qui fonctionne bien
- Build front en production OK (`vite build`).
- Routage très complet (public + privé + aliases legacy) avec protections par authentification et par plan.
- Gestion de dégradation partielle quand Supabase n’est pas configuré (mode démo/fallback).
- Base SQL/migrations riche (billing, alerts, watch, KB, go/no-go, etc.).

### Ce qui bloque ou fragilise
- Le typecheck TypeScript échoue à cause d’un bug simple (double import `React` dans `TaxesOm.tsx`).
- Nombreuses alertes ESLint (dépendances de hooks, fichiers “too much exports”, directives inutiles).
- Beaucoup de routes legacy/redirections, et plusieurs pages présentes mais non raccordées au routeur principal.
- Surface API importante, avec dépendance forte à la configuration d’env (`OPENAI_*`, `SUPABASE_*`, Stripe, email).

---

## 2) Cartographie globale (frontend + backend)

### Frontend
- `53` pages React (`src/pages`).
- `27` hooks custom (`src/hooks`).
- `103` composants (`src/components`).
- `28` modules métier (`src/lib`).

### Backend (serverless)
- `22` endpoints TypeScript dans `api/`.
- Helpers HTTP/Supabase partagés (`src/server/http.ts`, `src/server/supabaseAdmin.ts`, `api/_lib/http.ts`, `api/_supabase.ts`).

### Données
- Supabase avec migrations nombreuses (`supabase/migrations/*.sql`) et schéma complet (`supabase/schema_full.sql`).
- Présence de tables orientées produit + conformité + billing + IA + veille.

---

## 3) Analyse frontend détaillée

### 3.1 Architecture applicative
- `src/App.tsx` centralise providers (QueryClient, Auth, Theme, Plan, Language, Filters) et toutes les routes.
- Le routeur contient environ `87` chemins déclarés (publics, privés, aliases legacy).
- La stratégie actuelle favorise la compatibilité historique via redirections, mais augmente la complexité cognitive.

### 3.2 Pages / routes
- Routes publiques marketing + “gates” vers l’app privée (`PublicAppGate`).
- Routes privées protégées (`ProtectedRoute`) + gating abonnement (`RequirePlan`) pour certaines fonctionnalités.
- Pages legacy encore présentes mais parfois redirigées vers une nouvelle structure (`/app/control-tower`, `/app/taxes-om`, etc.).

### 3.3 Hooks et state management
- Utilisation majoritaire de hooks maison + état local React.
- Plusieurs hooks data connectés à Supabase avec fallback démo.
- Signaux de dette: hooks avec dépendances `useEffect`/`useCallback` incomplètes (signalé par lint).

### 3.4 Points solides UX/produit
- Cohérence “app privée” vs “site public” via `PublicAppGate`.
- Contrôle d’accès par plan bien pensé (FREE/PRO/PRO_VISIO/PILOTAGE_HEBDO).
- Intentions de parcours claires: simulation, conformité, veille, assistant.

### 3.5 Risques frontend
- `src/pages/TaxesOm.tsx` a un double import React, ce qui casse `npm run typecheck`.
- `ControlTower.tsx` est volumineux et concentre énormément de responsabilités (risque maintenance/testabilité).
- Bundle principal très lourd (>2MB minifié), avec warning Vite sur la taille des chunks.

---

## 4) Analyse backend/API détaillée

### 4.1 Organisation
- API Vercel structurée par domaines: ask (IA), go-no-go, rss, alerts, stripe, contact, hs, ingest, etc.
- Helpers CORS/JSON/lecture body mutualisés, bonne base de standardisation.

### 4.2 Connexions externes
- Supabase (auth + data) côté frontend et backend.
- OpenAI sur endpoints IA (`api/ask.ts`, embeddings + chat).
- Stripe (checkout/portal/webhook).
- Email via Resend ou SMTP (`api/contact.ts`).

### 4.3 Points forts backend
- Vérification Bearer + résolution utilisateur Supabase dans plusieurs endpoints sensibles.
- Logique quota/plan déjà intégrée (ex: go/no-go en FREE limité).
- Couche CORS et utilitaires HTTP partagés.

### 4.4 Risques backend
- Forte dépendance env vars: en absence de config, certaines routes seront KO runtime.
- Duplication/dispersion des helpers Supabase/HTTP (source potentielle d’incohérences futures).
- CORS permissif par défaut (`*`) dans les utilitaires: pratique en dev, à durcir en prod.

---

## 5) Ce qui fonctionne vs ce qui ne fonctionne pas (vérifié)

## Fonctionne
- `npm run build` passe et génère `dist/`.
- `npm run lint` passe (avec warnings uniquement, pas d’erreur bloquante).

## Ne fonctionne pas / non conforme qualité cible
- `npm run typecheck` échoue actuellement:
  - `Duplicate identifier 'React'` dans `src/pages/TaxesOm.tsx`.
- Qualité statique incomplète:
  - `32` warnings ESLint (hooks deps, react-refresh constraints, directives inutiles).

---

## 6) Axes d’amélioration prioritaires (ordre recommandé)

### P0 — Stabilisation immédiate (1 à 2 jours)
1. Corriger le bug TS bloquant (`TaxesOm.tsx`: supprimer import React dupliqué).
2. Passer le pipeline minimal en “vert strict”:
   - `typecheck` OK,
   - `lint` sans warnings critiques.
3. Ajouter une CI (lint + typecheck + build) obligatoire sur PR.

### P1 — Réduction de complexité front (3 à 7 jours)
1. Découper `ControlTower.tsx` en sous-modules (data, compute, UI blocs, actions API).
2. Élaguer les routes/pages legacy non utilisées (ou documenter clairement leur statut).
3. Unifier la stratégie de data loading (React Query plus systématique au lieu d’état local dispersé).

### P1 — Fiabilisation backend
1. Normaliser 100% des handlers autour d’un même helper HTTP (erreurs, logs, CORS, auth).
2. Vérifier toutes les routes critiques pour:
   - authentification requise,
   - contrôle plan/quota,
   - validation de payload (zod conseillé).
3. Durcir CORS en production (liste d’origines connues).

### P2 — Performance & observabilité
1. Réduire le chunk principal (lazy loading ciblé sur pages lourdes).
2. Mettre des métriques (latence API, erreurs 4xx/5xx, taux de succès Stripe/OpenAI).
3. Préparer des tests e2e clés (auth, paiement, go/no-go, assistant, contact).

### P3 — Documentation opérationnelle
1. Créer une “runbook prod” (env vars complètes, rotation clés, plan de reprise).
2. Cartographier clairement modules actifs vs legacy.
3. Documenter le modèle de données réellement exploité par le front actuel.

---

## 7) Observations importantes pour ton ami développeur

- Le produit est **déjà avancé** et couvre beaucoup de cas métier.
- Le principal enjeu n’est pas de “rajouter des features”, mais de **stabiliser**:
  - qualité statique,
  - cohérence architecture,
  - discipline CI/CD,
  - réduction de dette legacy.
- Une phase courte de hardening technique peut fortement augmenter la fiabilité perçue par les utilisateurs et simplifier les futures évolutions.

