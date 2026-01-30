# Export Navigator - TOOL_BLUEPRINT

## Principes de gouvernance
- Mission : outil de controle/coherence export (Incoterms, TVA import/DDP, couts transport/douane/transit) + dashboards.
- Regle d'architecture : zero logique metier dans les pages (`src/pages`). Les pages orchestrent l'UI et appellent des fonctions pures depuis `src/lib/*`.
- Donnees de reference versionnees, avec overrides locaux si necessaire.

## Pages et missions (1 phrase chacune)
- `CommandCenter.tsx` : pilotage et synthese.
- `Simulator.tsx` : simulation couts/marge ; lecture referentiels, aucune ecriture.
- `Guide.tsx` : guide operationnel ; lecture referentiels (incoterms/destinations).
- `ReferenceLibrary.tsx` : consultation/edition du referentiel.
- `Settings.tsx` : parametres, gestion du referentiel.
- `NotFound.tsx` : 404.

## Modules `src/lib` a stabiliser
- `src/lib/rules/incotermRules.ts` : qui paie quoi selon incoterm.
- `src/lib/rules/taxRules.ts` : TVA/OM/OMR selon destination/zone.
- `src/lib/rules/checklistRules.ts` : documents requis par destination/transport.
- `src/lib/stats/computeStats.ts` : aggregations KPIs flux.
- `src/lib/simulations/costModel.ts` : modele de couts/marge pour simulateur.

## Donnees de reference
- JSON versionnes : `src/data/reference/incoterms.json`, `src/data/reference/destinations.json`.
- Hook : `src/hooks/useReferenceData.ts` pour charger/ecrire un override local.

## Rappels d'implementation
- Toute logique metier (calcul, validation, scoring) vit dans `src/lib/*` (fonctions pures et typees).
- Les pages utilisent uniquement des hooks/stores et fonctions pures ; pas de calcul inline.
- Tests unitaires ciblent `src/lib/*` en priorite (Vitest).

## Hypotheses & limites
- L'outil ne remplace pas un conseil fiscal/juridique : il fait des controles de coherence et signale les ecarts.
- Les calculs de TVA/OM/OMR et droits sont indicatifs : pas de calcul de taux officiels, uniquement detection de manquants ou ecarts HT/TVA/TTC si presents.
- LocalStorage peut etre une source de verite en V1 : pas de multi-utilisateur ni de synchronisation serveur.
