# Import CSV (gratuit)

Fichiers a deposer dans `data-import/` avant import Supabase.

## 1) Countries
- Fichier: `data-import/countries.csv`
- Colonnes: `code_iso2,label,zone,lat,lon`

## 2) Trade flows
- Fichier: `data-import/trade_flows.csv`
- Colonnes: `flow_date,hs_code,reporter_country,partner_country,flow_type,value_eur,volume_kg,source`

## Ordre recommande
1. countries.csv
2. trade_flows.csv

## Import dans Supabase
Utilise l'onglet "Table Editor" -> "Import data" sur chaque table.
