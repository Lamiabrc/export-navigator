insert into public.product_rule_cards (hs2, lang, card_key, card_title, card_body)
values
  ('08', 'fr', 'fresh-fruit', 'Produits frais', 'Vérifier exigences phytosanitaires et chaîne du froid.'),
  ('08', 'en', 'fresh-fruit', 'Fresh produce', 'Check phytosanitary requirements and cold-chain controls.'),
  ('87', 'fr', 'auto-parts', 'Pièces auto', 'Contrôler normes techniques, sécurité et marquage.'),
  ('87', 'en', 'auto-parts', 'Auto parts', 'Validate technical standards, safety and product marking.')
on conflict (hs2, lang, card_key) do update
set card_title = excluded.card_title,
    card_body = excluded.card_body;
