# Architecture & Plan - Export Navigator

## Pages / Routes (etat & cible)
- Controle unifie : `CommandCenter` sur `/control-tower` (Dashboard + Strategy + Conformite). Routes legacy `/dashboard`, `/strategy`, `/control-tower-legacy`, `/dashboard-legacy`, `/strategy-hub` redirigees/masquees.
- Referentiels : `Flows` (`/flows/:id?`), `Clients`, `Products`, `ReferenceLibrary`, `Guide` (export), `Settings`/`Admin`.
- Facturation : `Invoices`, `InvoiceVerification` (a renommer/faire evoluer en "Invoice Control"), `Simulator`, `MarginAnalysis`.
- Autres/legacy a isoler : `PricingPositioning`, `CompetitiveIntel`, `ScenarioLab`, dossier `pages/_unused`.

## Modules metier (a centraliser dans `/lib`)
- Pricing & taxes : `costCalculator` avec `customsCode` (HS) pour OM/OMR + TVA import, marge, payeur selon incoterm/transport. Transit fee a rendre parametrable via Supabase (`export_destinations` ou `export_settings`).
- References : chargement `reference_rates` (VAT, transport, services) + merge `export_hs_catalog` pour OM/OMR par destination + hs_code.
- Incoterms & payeurs : regles payeur par incoterm/transport (source `export_incoterms` ou fallback local).
- OM/OMR & TVA : mapping zone, recherche HS (8/6/4 digits), autoliquidation TVA selon destination.
- Conformite : checklists docs/incoterms (Control Center), controle facture (Invoice Control) et ecarts.

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
- Pilotage : **Control Center** (unique), Flows.
- Facturation & conformite : Invoices, Invoice Control, Simulator, Margin Analysis.
- Referentiels : Clients, Products, Reference Library, Guide (export).
- Administration : Settings/Admin (guard UI role admin).
- Legacy caches : Dashboard/ControlTower/StrategyHub/Competitive/PricingPositioning/ScenarioLab (accessibles seulement via route directe si besoin).

## Pages a conserver / fusionner
- Conserver : CommandCenter (Control Center), Flows/CircuitDetail, Finance, Guide (export), Invoices, InvoiceVerification->Invoice Control, Simulator, MarginAnalysis, ReferenceLibrary, Products, Clients, Settings/Admin.
- Fusion/suppression : remplacer Dashboard + ControlTower + StrategyHub par Control Center ; ne plus afficher les pages legacy dans la nav.

## Data layer (priorites)
- Supprimer localStorage pour donnees metier : `useReferenceRates`, `useProducts`, `useClients`, `useFlows` doivent lire Supabase avec typage strict + fallback message si env absentes.
- Helpers : produits (`getProductByCodeArticle`, `searchProducts`, `topProductsByZone`), clients (`filterByZone`, `computeClientType`), flows (validation schema data jsonb).
- Mode degrade : si `VITE_SUPABASE_URL/ANON_KEY` manquants, afficher message et utiliser defaults non persistants.
