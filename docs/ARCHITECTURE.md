# Architecture & Plan – Export Navigator

## Pages / Routes (état & cible)
- Contrôle unifié : `CommandCenter` sur `/control-tower` (Dashboard + Strategy + Conformité). Routes legacy `/dashboard`, `/strategy`, `/control-tower-legacy`, `/dashboard-legacy`, `/strategy-hub` redirigées/masquées.
- Référentiels : `Flows` (`/flows/:id?`), `Clients`, `Products`, `ReferenceLibrary`, `Guide` (incl. DROM Playbook), `Settings`/`Admin`.
- Facturation : `Invoices`, `InvoiceVerification` (à renommer/faire évoluer en “Invoice Control”), `Simulator`, `MarginAnalysis`.
- Autres/legacy à isoler : `Imports` (CSV), `PricingPositioning`, `CompetitiveIntel`, `ScenarioLab`, dossier `pages/_unused`.

## Modules métier (à centraliser dans `/lib`)
- Pricing & taxes : `costCalculator` avec `customsCode` (HS) pour OM/OMR + TVA import, marge, payeur selon incoterm/transport. Transit fee à rendre paramétrable via Supabase (`export_destinations` ou `export_settings`).
- Références : chargement `reference_rates` (VAT, transport, services) + merge `export_hs_catalog` pour OM/OMR par destination + hs_code.
- Incoterms & payeurs : règles payeur par incoterm/transport (source `export_incoterms` ou fallback local).
- OM/OMR & TVA : mapping zone, recherche HS (8/6/4 digits), autoliquidation TVA selon destination.
- Conformité : checklists docs/incoterms (Control Center), contrôle facture (Invoice Control) et écarts.

## Modèle de données (Supabase – source de vérité)
- `products` : id, code_article, libelle_article, hs_code, tva_percent, prix/catalogue, poids/dimensions…
- `clients` : id, name, export_zone (UE/DROM/Hors UE), drom_code, canal (direct/indirect/depositaire), depositaire_id, groupement_id, groupement, groupement_remise.
- `flows` : id, flow_code, data (jsonb) validée, created_at/updated_at.
- `export_settings` : clés structurées (`reference_rates`, `guide_drom`, futur `transit_fee_pct` par destination/mode).
- `export_hs_catalog` : destination + hs_code + om_rate + omr_rate + label/notes.
- `export_destinations` : paramètres par destination (zone, transit_fee_pct, éventuels plafonds).
- `export_incoterms` : payeur par incoterm/transport (transport principal, douane export/import, droits, OM, TVA).
- `export_destinations` / `eu_country` / vues `v_clients_*` : aides de mapping (zones, pays UE).

## Navigation cible (Sidebar)
- Pilotage : **Control Center** (unique), Flows.
- Facturation & conformité : Invoices, Invoice Control, Simulator, Margin Analysis.
- Référentiels : Clients, Products, Reference Library, Guide (onglet DROM Playbook).
- Administration : Settings/Admin (guard UI rôle admin).
- Legacy cachés : Dashboard/ControlTower/StrategyHub/Imports/Competitive/PricingPositioning/ScenarioLab (accessibles seulement via route directe si besoin).

## Pages à conserver / fusionner
- Conserver : CommandCenter (Control Center), Flows/CircuitDetail, Finance, Guide (+ DROM Playbook), Invoices, InvoiceVerification→Invoice Control, Simulator, MarginAnalysis, ReferenceLibrary, Products, Clients, Settings/Admin.
- Fusion/suppression : remplacer Dashboard + ControlTower + StrategyHub par Control Center ; ne plus afficher Imports dans la nav.

## Data layer (priorités)
- Supprimer localStorage pour données métier : `useReferenceRates`, `useProducts`, `useClients`, `useFlows` doivent lire Supabase avec typage strict + fallback message si env absentes.
- Helpers : produits (`getProductByCodeArticle`, `searchProducts`, `topProductsByZone`), clients (`filterByZone`, `filterByDrom`, `computeClientType`), flows (validation schema data jsonb).
- Mode dégradé : si `VITE_SUPABASE_URL/ANON_KEY` manquants, afficher message et utiliser defaults non persistants.
