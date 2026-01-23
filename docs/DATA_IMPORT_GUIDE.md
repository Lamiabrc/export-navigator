# Guide d'import CSV (local-first)

Placez vos fichiers CSV dans le dossier `data-import/` a la racine du projet. L'outil lit ensuite ces fichiers cote app (page Imports) et applique les validations decrites ci-dessous.

## Ordre recommande
1. `products.csv`
2. `competitors.csv`
3. `markets.csv`
4. `price_points.csv`
5. `fx_rates.csv` (optionnel)
6. `shipments.csv` (optionnel - alimente Tour de controle)
7. `invoices.csv` (optionnel - alimente Factures)
8. `ref_reference.csv` (optionnel - references)

## Specifications par fichier

### products.csv
- Cle: `id`
- Colonnes obligatoires: `id` (string), `sku` (string), `name` (string), `category` (string)
- Colonnes recommandees: `ref_code` (string), `cost` (number > 0), `currency` (ISO 4217)
- Regles: `cost` > 0 si present

### competitors.csv
- Cle: `id`
- Colonnes obligatoires: `id`, `name`
- Colonnes recommandees: `brand_code` (enum: THUASNE | DONJOY_ENOVIS | GIBAUD | AUTRE), `notes`

### markets.csv
- Cle: `id`
- Colonnes obligatoires: `id`, `label`, `zone` (enum: UE | HORS_UE), `country_code` (ISO 3166-1 alpha-2)
- Colonnes recommandees: `currency` (ISO 4217)

### price_points.csv
- Cle: `id`
- Colonnes obligatoires: `id`, `product_id`, `brand` (MPL | THUASNE | DONJOY_ENOVIS | GIBAUD), `market`, `channel`, `currency` (ISO), `price` (>0), `price_type` (HT|TTC), `date` (ISO), `source_label`, `confidence` (0-100)
- Regles: `confidence` >= min confiance (par defaut 65) pour etre exploite; `price` > 0

### fx_rates.csv (optionnel)
- Colonnes obligatoires: `base_currency`, `quote_currency`, `rate` (>0), `date` (ISO)

### shipments.csv (optionnel)
- Cle: `id`
- Colonnes obligatoires: `id`, `flow_code`, `incoterm`, `destination`, `departure_date` (ISO), `delivery_date` (ISO)
- Recommande: `carrier`, `awb`, `bl`, `customs_status`
- Regles: dates ISO; incoterm 2020

### invoices.csv (optionnel)
- Cle: `id` ou `invoice_number`
- Colonnes obligatoires: `invoice_number`, `client_name`, `invoice_date` (ISO), `currency` (ISO), `amount_ht` (>0)
- Recommande: `amount_ttc`, `tva_amount`, `incoterm`, `destination`, `flow_code`, `awb`, `bl`

### ref_reference.csv (optionnel)
- Cle: `code`
- Colonnes obligatoires: `code`, `label`
- Recommande: `reimbursement_rate` (0-100), `notes`

## Gestion des doublons
- Tous les fichiers sont upsertes par leur cle primaire : une cle identique ecrase l'enregistrement precedent.

## Validation
- Types numeriques > 0, dates en ISO `YYYY-MM-DD`, devises en ISO 4217.
- `zone` doit appartenir a {UE, HORS_UE}, `price_type` a {HT, TTC}, `brand` a {MPL, THUASNE, DONJOY_ENOVIS, GIBAUD}.

## Templates
- Des templates CSV telechargeables sont exposes dans la page `Imports` (section Ordre recommande). Vous pouvez aussi les copier depuis `src/lib/csvSchemas.ts` (fonction `getCsvTemplate`).
