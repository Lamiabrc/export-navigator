# Export Navigator — TOOL_BLUEPRINT

## Principes de gouvernance
- Mission : outil de contrôle/cohérence export (Incoterms, TVA DOM/DDP, coûts transport/douane/transit) + dashboards.
- Données front uniquement (localStorage + JSON de référence). Aucune dépendance backend en V1.
- Règle d’architecture : **zéro logique métier dans les pages** (`src/pages`). Les pages orchestrent l’UI et appellent des fonctions pures depuis `src/lib/*`.
- Clefs de stockage : flows (`mpl_flows`), factures importées (`SAGE_INVOICES_KEY`), coûts réels (`COST_DOCS_KEY`), référentiel override (`reference_overrides`), factures upload locales historique (`mpl_invoices` existant).

## Pages et missions (1 phrase chacune) + sources de données (lecture/écriture)
- `Auth.tsx` : écran de connexion local ; ne lit/écrit que l’état d’auth local (provider, pas de localStorage direct).
- `Index.tsx` : redirection vers le dashboard ; aucun accès données.
- `Dashboard.tsx` : vision directionnelle (KPIs synthèse flux) ; lecture `mpl_flows` via hook.
- `ExportDashboard.tsx` : vue détaillée export avec exports CSV/JSON ; lecture `mpl_flows`.
- `Flows.tsx` : catalogue des circuits et mind-map ; lecture données statiques circuits + dérivés `mpl_flows` si besoin.
- `CircuitDetail.tsx` : fiche d’un circuit/flux, alerts & rapprochements ; lecture `mpl_flows`, `SAGE_INVOICES_KEY`, `COST_DOCS_KEY`, référentiel.
- `Logistics.tsx` : suivi logistique/checklists ; lecture/écriture `mpl_flows`.
- `Finance.tsx` : calcul charges/déductibilité ; lecture `mpl_flows` + référentiel règles.
- `MarginAnalysis.tsx` : analyse marge/couverture ; lecture `mpl_flows`, rapprochements (`SAGE_INVOICES_KEY`, `COST_DOCS_KEY`).
- `Simulator.tsx` : simulation coûts/marge ; lecture référentiel, aucune écriture.
- `Guide.tsx` : guide opérationnel ; lecture référentiel (incoterms/destinations).
- `ReferenceLibrary.tsx` : consultation/édition du référentiel ; lecture/écriture référentiel (`reference_overrides`).
- `Settings.tsx` : paramètres, import/export référentiel ; lecture/écriture référentiel (`reference_overrides`).
- `Invoices.tsx` : contrôle factures + rapprochement ; lecture/écriture `SAGE_INVOICES_KEY`, `COST_DOCS_KEY`, dérivés `mpl_flows`.
- `Imports.tsx` : import CSV factures Sage et coûts réels ; lecture/écriture `SAGE_INVOICES_KEY`, `COST_DOCS_KEY`.
- `NotFound.tsx` : 404, aucune donnée.

## Modules `src/lib` à créer/stabiliser
- `src/lib/imports/parseCsv.ts` : parse CSV → lignes brutes (fonction pure, sans dépendance DOM).
- `src/lib/imports/mapping.ts` : mapping colonnes CSV → modèles métiers (Sage, coûts), validation + rapport d’erreurs.
- `src/lib/reco/reconcile.ts` : rapprochement factures/coûts → `ExportCase[]` avec score et manquants.
- `src/lib/kpi/exportKpis.ts` : calculs marge/couverture/transit/CA/écarts par case.
- `src/lib/rules/riskEngine.ts` : règles d’alertes (couverture transit, DDP sans douane, incohérences HT/TVA/TTC, etc.).
- `src/lib/rules/incotermRules.ts` : qui paie quoi selon incoterm.
- `src/lib/rules/taxRules.ts` : TVA/OM/OMR selon destination/zone.
- `src/lib/rules/checklistRules.ts` : documents requis par destination/transport.
- `src/lib/rules/riskFlags.ts` (optionnel) : catégorisation des alertes.
- `src/lib/stats/computeStats.ts` : agrégations KPIs flux.
- `src/lib/simulations/costModel.ts` : modèle de coûts/marge pour simulateur.

## Données de référence (versionnées + override localStorage)
- JSON versionnés : `src/data/reference/incoterms.json`, `src/data/reference/destinations.json`.
- Hook : `src/hooks/useReferenceData.ts` pour charger/écrire un override local (`reference_overrides`) et fournir le référentiel aux pages/lib.

## Rappels d’implémentation
- Toute logique métier (calcul, validation, scoring, mapping) vit dans `src/lib/*` (fonctions pures et typées).
- Les pages utilisent uniquement des hooks/stores et fonctions pures ; pas de calcul inline.
- Tests unitaires ciblent `src/lib/*` en priorité (Vitest).

## Hypothèses & limites
- L’outil ne remplace ni Sage ni un conseil fiscal/juridique : il fait des contrôles de cohérence (rapprochement, couverture transit, alertes incoterm/TVA) et signale les écarts ; la validation finale reste côté finance/transitaire/déclarant.
- Les données sources viennent d’exports CSV/JSON (Sage factures, coûts réels) et du référentiel local. Toute incohérence ou champ manquant dans les exports réduit la qualité des contrôles.
- Les calculs de TVA/OM/OMR et droits sont indicatifs : pas de calcul de taux officiels, uniquement détection de manquants ou d’écarts HT/TVA/TTC si présents.
- Les règles d’alerte sont versionnées dans `src/lib/rules` et basées sur les données disponibles. Aucune prise en compte automatique de cas particuliers douaniers (pays, nomenclature, exemptions).
- LocalStorage est la source de vérité en V1 : pas de multi-utilisateur ni de synchronisation serveur ; un reset local efface les données.
