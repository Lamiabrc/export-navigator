# START HERE - Importer vos donnees

## Ou placer vos fichiers
- Deposez vos CSV dans le dossier local `data-import/` a la racine du projet.
- L'app lit ces fichiers en local (pas d'envoi serveur). Vous pouvez les remplacer et relancer l'import depuis la page **Imports**.

## Ordre d'import recommande
1. `products.csv`
2. `competitors.csv`
3. `markets.csv`
4. `price_points.csv`
5. `fx_rates.csv` (optionnel)
6. `shipments.csv` (optionnel)
7. `invoices.csv` (optionnel)
8. `ref_reference.csv` (optionnel)

## Colonnes attendues (resume)
- products.csv : `id, sku, name, category` (+ `ref_code, cost, currency`)
- competitors.csv : `id, name` (+ `brand_code` enum THUASNE|DONJOY_ENOVIS|GIBAUD|AUTRE)
- markets.csv : `id, label, zone` (UE|DROM|HORS_UE), `country_code` (ISO) (+ `currency`)
- price_points.csv : `id, product_id, brand` (MPL|THUASNE|DONJOY_ENOVIS|GIBAUD), `market, channel, currency, price, price_type` (HT|TTC), `date` (ISO), `source_label, confidence`
- fx_rates.csv : `base_currency, quote_currency, rate, date`
- shipments.csv : `id, flow_code, incoterm, destination, departure_date, delivery_date` (+ `carrier, awb, bl`)
- invoices.csv : `invoice_number, client_name, invoice_date, currency, amount_ht` (+ `amount_ttc, tva_amount, incoterm, destination, flow_code, awb, bl`)
- ref_reference.csv : `code, label` (+ `reimbursement_rate, notes`)

Regles generales : valeurs numeriques > 0, dates au format ISO `YYYY-MM-DD`, devises ISO 4217, zones = UE/DROM/HORS_UE, price_type = HT|TTC, brand conforme a la liste.

## Comment importer
1. Ouvrez la page **Imports** dans l'app.
2. Telechargez les templates CSV depuis la section "Ordre recommande" ou generez vos propres exports avec les colonnes ci-dessus.
3. Deposez vos fichiers dans `data-import/` puis chargez-les via la page (ou utilisez l'upload direct).
4. Corrigez les eventuelles erreurs (types, colonnes manquantes). Les lignes invalides sont listees en preview.

## Exemple rapide (price_points.csv)
```
id,product_id,brand,market,channel,currency,price,price_type,date,source_label,confidence
pp-1,p1,MPL,FR,Pharmacie,EUR,42,TTC,2024-12-01,Retail panel,90
pp-2,p1,THUASNE,FR,Pharmacie,EUR,39,TTC,2024-12-01,Retail panel,90
```

## Checklist qualite
- IDs uniques et stables (pas d'espaces).
- Dates ISO (YYYY-MM-DD) coherentes avec les periodes de validite.
- Devises ISO 4217, montants positifs.
- Zones et incoterms conformes (Incoterms 2020). En cas de doute sur un incoterm: notez "a verifier".
- Confiance (confidence) entre 0 et 100. Filtrage par defaut a 65.

Pour plus de details, voir `docs/DATA_IMPORT_GUIDE.md`.
