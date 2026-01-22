# Guide d'import CSV (local-first)

Placez vos fichiers CSV dans le dossier `data-import/` à la racine du projet. L'outil lit ensuite ces fichiers côté app (page Imports) et applique les validations décrites ci-dessous.

## Ordre recommandé
1. `products.csv`
2. `competitors.csv`
3. `markets.csv`
4. `price_points.csv`
5. `fx_rates.csv` (optionnel)
6. `shipments.csv` (optionnel – alimente Tour de contrôle)
7. `invoices.csv` (optionnel – alimente Factures)
8. `lpp_reference.csv` (optionnel – remboursements)

## Spécifications par fichier

### products.csv
- Clé: `id`
- Colonnes obligatoires: `id` (string), `sku` (string), `name` (string), `category` (string)
- Colonnes recommandées: `lpp_code` (string), `cost` (number > 0), `currency` (ISO 4217)
- Règles: `cost` > 0 si présent

### competitors.csv
- Clé: `id`
- Colonnes obligatoires: `id`, `name`
- Colonnes recommandées: `brand_code` (enum: THUASNE | DONJOY_ENOVIS | GIBAUD | AUTRE), `notes`

### markets.csv
- Clé: `id`
- Colonnes obligatoires: `id`, `label`, `zone` (enum: UE | DROM | HORS_UE), `country_code` (ISO 3166-1 alpha-2)
- Colonnes recommandées: `currency` (ISO 4217)

### price_points.csv
- Clé: `id`
- Colonnes obligatoires: `id`, `product_id`, `brand` (MPL | THUASNE | DONJOY_ENOVIS | GIBAUD), `market`, `channel`, `currency` (ISO), `price` (>0), `price_type` (HT|TTC), `date` (ISO), `source_label`, `confidence` (0–100)
- Règles: `confidence` >= min confiance (par défaut 65) pour être exploité; `price` > 0

### fx_rates.csv (optionnel)
- Colonnes obligatoires: `base_currency`, `quote_currency`, `rate` (>0), `date` (ISO)

### shipments.csv (optionnel)
- Clé: `id`
- Colonnes obligatoires: `id`, `flow_code`, `incoterm`, `destination`, `departure_date` (ISO), `delivery_date` (ISO)
- Recommandé: `carrier`, `awb`, `bl`, `customs_status`
- Règles: dates ISO; incoterm 2020

### invoices.csv (optionnel)
- Clé: `id` ou `invoice_number`
- Colonnes obligatoires: `invoice_number`, `client_name`, `invoice_date` (ISO), `currency` (ISO), `amount_ht` (>0)
- Recommandé: `amount_ttc`, `tva_amount`, `incoterm`, `destination`, `flow_code`, `awb`, `bl`

### lpp_reference.csv (optionnel)
- Clé: `code`
- Colonnes obligatoires: `code`, `label`
- Recommandé: `reimbursement_rate` (0–100), `notes`

## Gestion des doublons
- Tous les fichiers sont upsertés par leur clé primaire : une clé identique écrase l'enregistrement précédent.

## Validation
- Types numériques > 0, dates en ISO `YYYY-MM-DD`, devises en ISO 4217.
- `zone` doit appartenir à {UE, DROM, HORS_UE}, `price_type` à {HT, TTC}, `brand` à {MPL, THUASNE, DONJOY_ENOVIS, GIBAUD}.

## Templates
- Des templates CSV téléchargeables sont exposés dans la page `Imports` (section Ordre recommandé). Vous pouvez aussi les copier depuis `src/lib/csvSchemas.ts` (fonction `getCsvTemplate`).
