create table if not exists public.product_catalog (
  code text primary key,
  label_fr text not null,
  label_en text not null,
  hs6 text not null,
  tags text[] not null default '{}'::text[],
  created_at timestamptz not null default now()
);

create index if not exists product_catalog_hs6_idx on public.product_catalog (hs6);
create index if not exists product_catalog_tags_gin_idx on public.product_catalog using gin (tags);

alter table public.product_catalog enable row level security;

drop policy if exists product_catalog_select_public on public.product_catalog;
create policy product_catalog_select_public
  on public.product_catalog for select
  to anon, authenticated
  using (true);

insert into public.product_catalog (code, label_fr, label_en, hs6, tags)
values
  ('strawberries', 'Fraises fraiches', 'Fresh strawberries', '081010', array['agri','fresh']),
  ('frozen_berries', 'Fruits rouges surgeles', 'Frozen berries', '081190', array['agri','frozen']),
  ('olive_oil', 'Huile d''olive', 'Olive oil', '150910', array['food']),
  ('wine', 'Vin en bouteille', 'Bottled wine', '220421', array['beverage']),
  ('chocolate', 'Chocolat', 'Chocolate', '180690', array['food']),
  ('cheese', 'Fromage affine', 'Aged cheese', '040690', array['food']),
  ('yogurt', 'Yaourt', 'Yogurt', '040310', array['food','cold_chain']),
  ('coffee', 'Cafe torrefie', 'Roasted coffee', '090121', array['food']),
  ('tea', 'The noir', 'Black tea', '090240', array['food']),
  ('honey', 'Miel', 'Honey', '040900', array['food']),
  ('biscuits', 'Biscuits', 'Biscuits', '190531', array['food']),
  ('baby_food', 'Aliments pour bebes', 'Baby food', '190110', array['food','regulated']),
  ('perfume', 'Parfum', 'Perfume', '330300', array['cosmetics']),
  ('cream', 'Creme de soin', 'Skincare cream', '330499', array['cosmetics']),
  ('shampoo', 'Shampooing', 'Shampoo', '330510', array['cosmetics']),
  ('soap', 'Savon', 'Soap', '340111', array['cosmetics']),
  ('medical_gloves', 'Gants medicaux', 'Medical gloves', '401519', array['medical']),
  ('syringes', 'Seringues', 'Syringes', '901831', array['medical']),
  ('diagnostic_kits', 'Kits diagnostiques', 'Diagnostic kits', '382219', array['medical','regulated']),
  ('pharma_pack', 'Conditionnement pharma', 'Pharma packaging', '392329', array['medical']),
  ('cotton_tshirts', 'T-shirts coton', 'Cotton t-shirts', '610910', array['textile']),
  ('sports_shoes', 'Chaussures sport', 'Sports shoes', '640411', array['textile']),
  ('handbags', 'Sacs a main', 'Handbags', '420221', array['fashion']),
  ('wool_coats', 'Manteaux laine', 'Wool coats', '620211', array['fashion']),
  ('leather_belts', 'Ceintures cuir', 'Leather belts', '420330', array['fashion']),
  ('ceramic_tiles', 'Carrelage ceramique', 'Ceramic tiles', '690721', array['construction']),
  ('aluminium_profiles', 'Profiles aluminium', 'Aluminium profiles', '760421', array['construction']),
  ('steel_tubes', 'Tubes acier', 'Steel tubes', '730661', array['construction']),
  ('wood_panels', 'Panneaux bois', 'Wood panels', '441233', array['construction']),
  ('electrical_transformers', 'Transformateurs electriques', 'Electrical transformers', '850433', array['industry']),
  ('solar_panels', 'Panneaux solaires', 'Solar panels', '854143', array['energy']),
  ('lithium_batteries', 'Batteries lithium-ion', 'Lithium-ion batteries', '850760', array['dangerous_goods']),
  ('smartphones', 'Smartphones', 'Smartphones', '851713', array['electronics']),
  ('laptops', 'Ordinateurs portables', 'Laptops', '847130', array['electronics']),
  ('routers', 'Routeurs reseau', 'Network routers', '851762', array['electronics']),
  ('industrial_sensors', 'Capteurs industriels', 'Industrial sensors', '903180', array['industry']),
  ('auto_brake_kits', 'Kits de freinage auto', 'Automotive brake kits', '870830', array['automotive']),
  ('auto_filters', 'Filtres automobiles', 'Automotive filters', '842123', array['automotive']),
  ('engine_oil', 'Huile moteur', 'Engine oil', '271019', array['automotive']),
  ('bicycle_parts', 'Pieces de velos', 'Bicycle parts', '871499', array['mobility']),
  ('furniture_chairs', 'Chaises de bureau', 'Office chairs', '940130', array['furniture']),
  ('mattresses', 'Matelas', 'Mattresses', '940421', array['furniture']),
  ('packaging_boxes', 'Boites carton', 'Cardboard boxes', '481910', array['packaging']),
  ('plastic_bottles', 'Bouteilles plastiques', 'Plastic bottles', '392330', array['packaging']),
  ('glass_bottles', 'Bouteilles en verre', 'Glass bottles', '701090', array['packaging']),
  ('fish_frozen', 'Poisson surgele', 'Frozen fish', '030389', array['food','cold_chain']),
  ('shrimp_frozen', 'Crevettes surgelees', 'Frozen shrimp', '030617', array['food','cold_chain']),
  ('rice', 'Riz', 'Rice', '100630', array['food']),
  ('wheat_flour', 'Farine de ble', 'Wheat flour', '110100', array['food']),
  ('sugar', 'Sucre de canne', 'Cane sugar', '170114', array['food']),
  ('mineral_water', 'Eau minerale', 'Mineral water', '220110', array['beverage']),
  ('fruit_juice', 'Jus de fruits', 'Fruit juice', '200990', array['beverage']),
  ('beer', 'Biere', 'Beer', '220300', array['beverage']),
  ('cement', 'Ciment', 'Cement', '252329', array['construction']),
  ('paint', 'Peinture acrylique', 'Acrylic paint', '320910', array['construction']),
  ('fertilizer', 'Engrais NPK', 'NPK fertilizer', '310520', array['agri']),
  ('seeds', 'Semences potageres', 'Vegetable seeds', '120991', array['agri','phytosanitary']),
  ('wood_pellets', 'Granules de bois', 'Wood pellets', '440131', array['energy']),
  ('paper_reels', 'Bobines papier', 'Paper reels', '480255', array['industry'])
on conflict (code) do update
set
  label_fr = excluded.label_fr,
  label_en = excluded.label_en,
  hs6 = excluded.hs6,
  tags = excluded.tags;
