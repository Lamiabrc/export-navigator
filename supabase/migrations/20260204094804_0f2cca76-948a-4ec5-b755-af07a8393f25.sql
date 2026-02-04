-- =====================================================
-- Watch / RSS - Tables et RLS pour la veille export
-- =====================================================

-- 1) ENUM pour les catégories de veille
CREATE TYPE public.watch_category AS ENUM (
  'customs',
  'trade',
  'sanctions',
  'tax_vat',
  'standards',
  'logistics',
  'general'
);

-- 2) Table watch_sources - Sources RSS/web à scanner
CREATE TABLE public.watch_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  format TEXT NOT NULL DEFAULT 'rss' CHECK (format IN ('rss', 'web', 'api')),
  type TEXT NOT NULL DEFAULT 'regulatory' CHECK (type IN ('regulatory', 'commercial', 'sanctions', 'logistics')),
  country TEXT,
  category public.watch_category NOT NULL DEFAULT 'general',
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  last_checked_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(url)
);

-- 3) Table watch_items - Articles/items récupérés
CREATE TABLE public.watch_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES public.watch_sources(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'regulatory',
  title TEXT,
  summary TEXT,
  url TEXT,
  guid TEXT NOT NULL,
  published_at TIMESTAMPTZ,
  country TEXT,
  category public.watch_category,
  impact TEXT CHECK (impact IS NULL OR impact IN ('LOW', 'MED', 'HIGH')),
  tags TEXT[],
  raw JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(source_id, guid)
);

-- 4) Table watch_prefs - Préférences utilisateur pour la veille
CREATE TABLE public.watch_prefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  countries TEXT[] DEFAULT '{}',
  categories public.watch_category[] DEFAULT '{}',
  keywords TEXT[] DEFAULT '{}',
  enabled_digest BOOLEAN NOT NULL DEFAULT false,
  digest_frequency TEXT DEFAULT 'weekly' CHECK (digest_frequency IN ('daily', 'weekly', 'monthly')),
  last_digest_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- 5) Table watch_digest_log - Historique des digests envoyés
CREATE TABLE public.watch_digest_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  items_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'skipped')),
  error TEXT
);

-- =====================================================
-- Indexes pour performances
-- =====================================================
CREATE INDEX idx_watch_items_source_id ON public.watch_items(source_id);
CREATE INDEX idx_watch_items_published_at ON public.watch_items(published_at DESC);
CREATE INDEX idx_watch_items_country ON public.watch_items(country) WHERE country IS NOT NULL;
CREATE INDEX idx_watch_items_category ON public.watch_items(category) WHERE category IS NOT NULL;
CREATE INDEX idx_watch_items_impact ON public.watch_items(impact) WHERE impact IS NOT NULL;
CREATE INDEX idx_watch_sources_enabled ON public.watch_sources(is_enabled) WHERE is_enabled = true;
CREATE INDEX idx_watch_prefs_user_id ON public.watch_prefs(user_id);

-- =====================================================
-- Fonction pour updated_at automatique
-- =====================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Triggers updated_at
CREATE TRIGGER trg_watch_sources_updated_at
  BEFORE UPDATE ON public.watch_sources
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_watch_prefs_updated_at
  BEFORE UPDATE ON public.watch_prefs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =====================================================
-- RLS - Row Level Security
-- =====================================================

-- watch_sources : lecture publique (tout le monde peut voir les sources)
ALTER TABLE public.watch_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tout le monde peut lire les sources actives"
  ON public.watch_sources FOR SELECT
  USING (is_enabled = true);

-- watch_items : lecture publique (articles publics)
ALTER TABLE public.watch_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tout le monde peut lire les items"
  ON public.watch_items FOR SELECT
  USING (true);

-- watch_prefs : privé par utilisateur
ALTER TABLE public.watch_prefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Utilisateurs voient leurs propres prefs"
  ON public.watch_prefs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Utilisateurs peuvent créer leurs prefs"
  ON public.watch_prefs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Utilisateurs peuvent modifier leurs prefs"
  ON public.watch_prefs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Utilisateurs peuvent supprimer leurs prefs"
  ON public.watch_prefs FOR DELETE
  USING (auth.uid() = user_id);

-- watch_digest_log : privé par utilisateur
ALTER TABLE public.watch_digest_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Utilisateurs voient leur historique digest"
  ON public.watch_digest_log FOR SELECT
  USING (auth.uid() = user_id);

-- =====================================================
-- Seed initial - Sources RSS fiables
-- =====================================================
INSERT INTO public.watch_sources (name, url, format, type, country, category, is_enabled) VALUES
  -- France
  ('Economie.gouv.fr - Actualités', 'https://www.economie.gouv.fr/rss/toutesactualites', 'rss', 'regulatory', 'FR', 'customs', true),
  ('Service-Public Pro - Actualités', 'https://www.service-public.fr/professionnels-entreprises/actualites/rss', 'rss', 'regulatory', 'FR', 'customs', true),
  ('Douanes FR - Actualités', 'https://www.douane.gouv.fr/rss/actualites.xml', 'rss', 'regulatory', 'FR', 'customs', true),
  
  -- EU
  ('EUR-Lex - Nouveaux actes', 'https://eur-lex.europa.eu/rss/new-oj-daily.xml', 'rss', 'regulatory', 'EU', 'customs', true),
  ('EU Commission - Trade News', 'https://trade.ec.europa.eu/rss/press-releases.xml', 'rss', 'regulatory', 'EU', 'trade', true),
  
  -- UK
  ('UK GOV - HMRC News', 'https://www.gov.uk/government/organisations/hm-revenue-customs.atom', 'rss', 'regulatory', 'GB', 'customs', true),
  ('UK GOV - Trade Policy', 'https://www.gov.uk/government/organisations/department-for-international-trade.atom', 'rss', 'regulatory', 'GB', 'trade', true),
  
  -- International
  ('WTO - Latest News', 'https://www.wto.org/english/news_e/news_rss_e.xml', 'rss', 'regulatory', 'INT', 'trade', true),
  ('UNCTAD - News', 'https://unctad.org/rss/news.xml', 'rss', 'regulatory', 'INT', 'trade', true),
  
  -- Sanctions
  ('OFAC - Sanctions Updates', 'https://ofac.treasury.gov/news-and-sanctions/sanctions-list-updates', 'web', 'sanctions', 'US', 'sanctions', true),
  ('EU Sanctions Map', 'https://www.sanctionsmap.eu/feed', 'rss', 'sanctions', 'EU', 'sanctions', true),
  
  -- Logistics
  ('Freight Waves - News', 'https://www.freightwaves.com/feed', 'rss', 'logistics', 'INT', 'logistics', true),
  ('JOC - Maritime News', 'https://www.joc.com/rss/all', 'rss', 'logistics', 'INT', 'logistics', true)

ON CONFLICT (url) DO NOTHING;