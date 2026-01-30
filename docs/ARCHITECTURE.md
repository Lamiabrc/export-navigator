# Architecture & Plan - Export Navigator

## Pages / Routes (etat & cible)
- Controle unifie : `CommandCenter` sur `/command-center` (dashboard + conformite). Routes legacy `/dashboard` et `/hub` redirigees/masquees.
- Referentiels : `Flows` (`/flows/:id?`), `Products`, `ReferenceLibrary`, `Guide` (export), `Settings`/`Admin`.
- Facturation : `Invoices` et `Simulator`.
- Autres/legacy a isoler : `PricingPositioning`, `CompetitiveIntel`, `ScenarioLab`, dossier `pages/_unused`.

## Modules metier (a centraliser dans `/lib`)
- Pricing & taxes : `costCalculator` avec `customsCode` (HS) pour OM/OMR + TVA import, marge, payeur selon incoterm/transport. Transit fee a rendre parametrable via Supabase (`export_destinations` ou `export_settings`).
- References : chargement `reference_rates` (VAT, transport, services) + merge `export_hs_catalog` pour OM/OMR par destination + hs_code.
- Incoterms & payeurs : regles payeur par incoterm/transport (source `export_incoterms` ou fallback local).
- OM/OMR & TVA : mapping zone, recherche HS (8/6/4 digits), autoliquidation TVA selon destination.
- Conformite : checklists docs/incoterms (Control Center) et ecarts.

## Modele de donnees (Supabase - source de verite)
- `products` : id, code_article, libelle_article, hs_code, tva_percent, prix/catalogue, poids/dimensions...
- `clients` : id, name, export_zone (UE/Hors UE), canal (direct/indirect/depositaire), depositaire_id, groupement_id, groupement, groupement_remise.
- `flows` : id, flow_code, data (jsonb) validee, created_at/updated_at.
- `export_settings` : cles structurees (`reference_rates`, `guide_export`, futur `transit_fee_pct` par destination/mode).
- `export_hs_catalog` : destination + hs_code + om_rate + omr_rate + label/notes.
- `export_destinations` : parametres par destination (zone, transit_fee_pct, eventuels plafonds).
- `export_incoterms` : payeur par incoterm/transport (transport principal, douane export/import, droits, OM, TVA).
- `export_destinations` / `eu_country` / vues `v_clients_*` : aides de mapping (zones, pays UE).

## Navigation cible (Sidebar)
- Pilotage : **Command Center** (unique), Flows.
- Facturation & conformite : Invoices, Simulator.
- Referentiels : Products, Reference Library, Guide (export).
- Administration : Settings/Admin (guard UI role admin).
- Legacy caches : Dashboard/StrategyHub/Competitive/PricingPositioning/ScenarioLab (accessibles seulement via route directe si besoin).

## Pages a conserver / fusionner
- Conserver : CommandCenter, Flows/CircuitDetail, Finance, Guide (export), Invoices, Simulator, ReferenceLibrary, Products, Settings/Admin.
- Fusion/suppression : remplacer Dashboard + StrategyHub par CommandCenter ; ne plus afficher les pages legacy dans la nav.

## Data layer (priorites)
- Supprimer localStorage pour donnees metier : `useReferenceRates`, `useProducts`, `useFlows` doivent lire Supabase avec typage strict + fallback message si env absentes.
- Helpers : produits (`getProductByCodeArticle`, `searchProducts`, `topProductsByZone`), clients (`filterByZone`, `computeClientType`), flows (validation schema data jsonb).
- Mode degrade : si `VITE_SUPABASE_URL/ANON_KEY` manquants, afficher message et utiliser defaults non persistants.
