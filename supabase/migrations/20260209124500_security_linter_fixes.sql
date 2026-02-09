-- Fix SECURITY DEFINER views flagged by Supabase linter
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'mpl_alerts') THEN
    EXECUTE 'ALTER VIEW public.mpl_alerts SET (security_invoker = true)';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'high_impact_alerts') THEN
    EXECUTE 'ALTER VIEW public.high_impact_alerts SET (security_invoker = true)';
  END IF;
END $$;

-- Enable RLS and add policies for public tables flagged by linter
DO $$
BEGIN
  -- Public reference data (read for all, write admin/service)
  IF to_regclass('public.countries') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.countries ENABLE ROW LEVEL SECURITY';
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'countries' AND policyname = 'rls_fix_countries_select_public'
    ) THEN
      EXECUTE 'CREATE POLICY "rls_fix_countries_select_public" ON public.countries FOR SELECT USING (true)';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'countries' AND policyname = 'rls_fix_countries_write_admin'
    ) THEN
      EXECUTE 'CREATE POLICY "rls_fix_countries_write_admin" ON public.countries FOR ALL USING (public.is_admin() OR auth.role() = ''service_role'') WITH CHECK (public.is_admin() OR auth.role() = ''service_role'')';
    END IF;
  END IF;

  IF to_regclass('public.destinations') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.destinations ENABLE ROW LEVEL SECURITY';
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'destinations' AND policyname = 'rls_fix_destinations_select_public'
    ) THEN
      EXECUTE 'CREATE POLICY "rls_fix_destinations_select_public" ON public.destinations FOR SELECT USING (true)';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'destinations' AND policyname = 'rls_fix_destinations_write_admin'
    ) THEN
      EXECUTE 'CREATE POLICY "rls_fix_destinations_write_admin" ON public.destinations FOR ALL USING (public.is_admin() OR auth.role() = ''service_role'') WITH CHECK (public.is_admin() OR auth.role() = ''service_role'')';
    END IF;
  END IF;

  IF to_regclass('public.hs_chapters') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.hs_chapters ENABLE ROW LEVEL SECURITY';
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'hs_chapters' AND policyname = 'rls_fix_hs_chapters_select_public'
    ) THEN
      EXECUTE 'CREATE POLICY "rls_fix_hs_chapters_select_public" ON public.hs_chapters FOR SELECT USING (true)';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'hs_chapters' AND policyname = 'rls_fix_hs_chapters_write_admin'
    ) THEN
      EXECUTE 'CREATE POLICY "rls_fix_hs_chapters_write_admin" ON public.hs_chapters FOR ALL USING (public.is_admin() OR auth.role() = ''service_role'') WITH CHECK (public.is_admin() OR auth.role() = ''service_role'')';
    END IF;
  END IF;

  IF to_regclass('public.sectors') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.sectors ENABLE ROW LEVEL SECURITY';
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'sectors' AND policyname = 'rls_fix_sectors_select_public'
    ) THEN
      EXECUTE 'CREATE POLICY "rls_fix_sectors_select_public" ON public.sectors FOR SELECT USING (true)';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'sectors' AND policyname = 'rls_fix_sectors_write_admin'
    ) THEN
      EXECUTE 'CREATE POLICY "rls_fix_sectors_write_admin" ON public.sectors FOR ALL USING (public.is_admin() OR auth.role() = ''service_role'') WITH CHECK (public.is_admin() OR auth.role() = ''service_role'')';
    END IF;
  END IF;

  -- Business data (read/write for authenticated)
  IF to_regclass('public.clients') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY';
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'clients' AND policyname = 'rls_fix_clients_select_auth'
    ) THEN
      EXECUTE 'CREATE POLICY "rls_fix_clients_select_auth" ON public.clients FOR SELECT USING (auth.role() = ''authenticated'' OR auth.role() = ''service_role'' OR public.is_admin())';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'clients' AND policyname = 'rls_fix_clients_write_auth'
    ) THEN
      EXECUTE 'CREATE POLICY "rls_fix_clients_write_auth" ON public.clients FOR ALL USING (auth.role() = ''authenticated'' OR auth.role() = ''service_role'' OR public.is_admin()) WITH CHECK (auth.role() = ''authenticated'' OR auth.role() = ''service_role'' OR public.is_admin())';
    END IF;
  END IF;

  IF to_regclass('public.products') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.products ENABLE ROW LEVEL SECURITY';
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'products' AND policyname = 'rls_fix_products_select_auth'
    ) THEN
      EXECUTE 'CREATE POLICY "rls_fix_products_select_auth" ON public.products FOR SELECT USING (auth.role() = ''authenticated'' OR auth.role() = ''service_role'' OR public.is_admin())';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'products' AND policyname = 'rls_fix_products_write_auth'
    ) THEN
      EXECUTE 'CREATE POLICY "rls_fix_products_write_auth" ON public.products FOR ALL USING (auth.role() = ''authenticated'' OR auth.role() = ''service_role'' OR public.is_admin()) WITH CHECK (auth.role() = ''authenticated'' OR auth.role() = ''service_role'' OR public.is_admin())';
    END IF;
  END IF;

  IF to_regclass('public.sales') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY';
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'sales' AND policyname = 'rls_fix_sales_select_auth'
    ) THEN
      EXECUTE 'CREATE POLICY "rls_fix_sales_select_auth" ON public.sales FOR SELECT USING (auth.role() = ''authenticated'' OR auth.role() = ''service_role'' OR public.is_admin())';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'sales' AND policyname = 'rls_fix_sales_write_auth'
    ) THEN
      EXECUTE 'CREATE POLICY "rls_fix_sales_write_auth" ON public.sales FOR ALL USING (auth.role() = ''authenticated'' OR auth.role() = ''service_role'' OR public.is_admin()) WITH CHECK (auth.role() = ''authenticated'' OR auth.role() = ''service_role'' OR public.is_admin())';
    END IF;
  END IF;

  IF to_regclass('public.sales_invoices') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.sales_invoices ENABLE ROW LEVEL SECURITY';
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'sales_invoices' AND policyname = 'rls_fix_sales_invoices_select_auth'
    ) THEN
      EXECUTE 'CREATE POLICY "rls_fix_sales_invoices_select_auth" ON public.sales_invoices FOR SELECT USING (auth.role() = ''authenticated'' OR auth.role() = ''service_role'' OR public.is_admin())';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'sales_invoices' AND policyname = 'rls_fix_sales_invoices_write_auth'
    ) THEN
      EXECUTE 'CREATE POLICY "rls_fix_sales_invoices_write_auth" ON public.sales_invoices FOR ALL USING (auth.role() = ''authenticated'' OR auth.role() = ''service_role'' OR public.is_admin()) WITH CHECK (auth.role() = ''authenticated'' OR auth.role() = ''service_role'' OR public.is_admin())';
    END IF;
  END IF;

  -- Reference rates (read for authenticated, write admin/service)
  IF to_regclass('public.vat_rates') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.vat_rates ENABLE ROW LEVEL SECURITY';
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'vat_rates' AND policyname = 'rls_fix_vat_rates_select_auth'
    ) THEN
      EXECUTE 'CREATE POLICY "rls_fix_vat_rates_select_auth" ON public.vat_rates FOR SELECT USING (auth.role() = ''authenticated'' OR auth.role() = ''service_role'' OR public.is_admin())';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'vat_rates' AND policyname = 'rls_fix_vat_rates_write_admin'
    ) THEN
      EXECUTE 'CREATE POLICY "rls_fix_vat_rates_write_admin" ON public.vat_rates FOR ALL USING (public.is_admin() OR auth.role() = ''service_role'') WITH CHECK (public.is_admin() OR auth.role() = ''service_role'')';
    END IF;
  END IF;

  IF to_regclass('public.tax_rules_extra') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.tax_rules_extra ENABLE ROW LEVEL SECURITY';
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'tax_rules_extra' AND policyname = 'rls_fix_tax_rules_extra_select_auth'
    ) THEN
      EXECUTE 'CREATE POLICY "rls_fix_tax_rules_extra_select_auth" ON public.tax_rules_extra FOR SELECT USING (auth.role() = ''authenticated'' OR auth.role() = ''service_role'' OR public.is_admin())';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'tax_rules_extra' AND policyname = 'rls_fix_tax_rules_extra_write_admin'
    ) THEN
      EXECUTE 'CREATE POLICY "rls_fix_tax_rules_extra_write_admin" ON public.tax_rules_extra FOR ALL USING (public.is_admin() OR auth.role() = ''service_role'') WITH CHECK (public.is_admin() OR auth.role() = ''service_role'')';
    END IF;
  END IF;

  IF to_regclass('public.transport_rate_lines') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.transport_rate_lines ENABLE ROW LEVEL SECURITY';
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'transport_rate_lines' AND policyname = 'rls_fix_transport_rate_lines_select_auth'
    ) THEN
      EXECUTE 'CREATE POLICY "rls_fix_transport_rate_lines_select_auth" ON public.transport_rate_lines FOR SELECT USING (auth.role() = ''authenticated'' OR auth.role() = ''service_role'' OR public.is_admin())';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'transport_rate_lines' AND policyname = 'rls_fix_transport_rate_lines_write_admin'
    ) THEN
      EXECUTE 'CREATE POLICY "rls_fix_transport_rate_lines_write_admin" ON public.transport_rate_lines FOR ALL USING (public.is_admin() OR auth.role() = ''service_role'') WITH CHECK (public.is_admin() OR auth.role() = ''service_role'')';
    END IF;
  END IF;

  IF to_regclass('public.pricing_coefficients') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.pricing_coefficients ENABLE ROW LEVEL SECURITY';
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'pricing_coefficients' AND policyname = 'rls_fix_pricing_coefficients_select_auth'
    ) THEN
      EXECUTE 'CREATE POLICY "rls_fix_pricing_coefficients_select_auth" ON public.pricing_coefficients FOR SELECT USING (auth.role() = ''authenticated'' OR auth.role() = ''service_role'' OR public.is_admin())';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'pricing_coefficients' AND policyname = 'rls_fix_pricing_coefficients_write_admin'
    ) THEN
      EXECUTE 'CREATE POLICY "rls_fix_pricing_coefficients_write_admin" ON public.pricing_coefficients FOR ALL USING (public.is_admin() OR auth.role() = ''service_role'') WITH CHECK (public.is_admin() OR auth.role() = ''service_role'')';
    END IF;
  END IF;

  IF to_regclass('public.trade_flows') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.trade_flows ENABLE ROW LEVEL SECURITY';
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'trade_flows' AND policyname = 'rls_fix_trade_flows_select_auth'
    ) THEN
      EXECUTE 'CREATE POLICY "rls_fix_trade_flows_select_auth" ON public.trade_flows FOR SELECT USING (auth.role() = ''authenticated'' OR auth.role() = ''service_role'' OR public.is_admin())';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'trade_flows' AND policyname = 'rls_fix_trade_flows_write_admin'
    ) THEN
      EXECUTE 'CREATE POLICY "rls_fix_trade_flows_write_admin" ON public.trade_flows FOR ALL USING (public.is_admin() OR auth.role() = ''service_role'') WITH CHECK (public.is_admin() OR auth.role() = ''service_role'')';
    END IF;
  END IF;

  -- Watch / regulatory data (admin/service only)
  IF to_regclass('public.watch_sources') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.watch_sources ENABLE ROW LEVEL SECURITY';
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'watch_sources' AND policyname = 'rls_fix_watch_sources_select_admin'
    ) THEN
      EXECUTE 'CREATE POLICY "rls_fix_watch_sources_select_admin" ON public.watch_sources FOR SELECT USING (public.is_admin() OR auth.role() = ''service_role'')';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'watch_sources' AND policyname = 'rls_fix_watch_sources_write_service'
    ) THEN
      EXECUTE 'CREATE POLICY "rls_fix_watch_sources_write_service" ON public.watch_sources FOR ALL USING (auth.role() = ''service_role'') WITH CHECK (auth.role() = ''service_role'')';
    END IF;
  END IF;

  IF to_regclass('public.watch_items') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.watch_items ENABLE ROW LEVEL SECURITY';
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'watch_items' AND policyname = 'rls_fix_watch_items_select_admin'
    ) THEN
      EXECUTE 'CREATE POLICY "rls_fix_watch_items_select_admin" ON public.watch_items FOR SELECT USING (public.is_admin() OR auth.role() = ''service_role'')';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'watch_items' AND policyname = 'rls_fix_watch_items_write_service'
    ) THEN
      EXECUTE 'CREATE POLICY "rls_fix_watch_items_write_service" ON public.watch_items FOR ALL USING (auth.role() = ''service_role'') WITH CHECK (auth.role() = ''service_role'')';
    END IF;
  END IF;

  IF to_regclass('public.watch_digests') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.watch_digests ENABLE ROW LEVEL SECURITY';
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'watch_digests' AND policyname = 'rls_fix_watch_digests_select_owner'
    ) THEN
      EXECUTE 'CREATE POLICY "rls_fix_watch_digests_select_owner" ON public.watch_digests FOR SELECT USING (auth.role() = ''service_role'' OR auth.uid() = user_id)';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'watch_digests' AND policyname = 'rls_fix_watch_digests_write_service'
    ) THEN
      EXECUTE 'CREATE POLICY "rls_fix_watch_digests_write_service" ON public.watch_digests FOR ALL USING (auth.role() = ''service_role'') WITH CHECK (auth.role() = ''service_role'')';
    END IF;
  END IF;

  IF to_regclass('public.regulatory_feeds') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.regulatory_feeds ENABLE ROW LEVEL SECURITY';
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'regulatory_feeds' AND policyname = 'rls_fix_regulatory_feeds_select_admin'
    ) THEN
      EXECUTE 'CREATE POLICY "rls_fix_regulatory_feeds_select_admin" ON public.regulatory_feeds FOR SELECT USING (public.is_admin() OR auth.role() = ''service_role'')';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'regulatory_feeds' AND policyname = 'rls_fix_regulatory_feeds_write_service'
    ) THEN
      EXECUTE 'CREATE POLICY "rls_fix_regulatory_feeds_write_service" ON public.regulatory_feeds FOR ALL USING (auth.role() = ''service_role'') WITH CHECK (auth.role() = ''service_role'')';
    END IF;
  END IF;

  IF to_regclass('public.regulatory_items') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.regulatory_items ENABLE ROW LEVEL SECURITY';
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'regulatory_items' AND policyname = 'rls_fix_regulatory_items_select_admin'
    ) THEN
      EXECUTE 'CREATE POLICY "rls_fix_regulatory_items_select_admin" ON public.regulatory_items FOR SELECT USING (public.is_admin() OR auth.role() = ''service_role'')';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'regulatory_items' AND policyname = 'rls_fix_regulatory_items_write_service'
    ) THEN
      EXECUTE 'CREATE POLICY "rls_fix_regulatory_items_write_service" ON public.regulatory_items FOR ALL USING (auth.role() = ''service_role'') WITH CHECK (auth.role() = ''service_role'')';
    END IF;
  END IF;

  IF to_regclass('public.link_previews') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.link_previews ENABLE ROW LEVEL SECURITY';
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'link_previews' AND policyname = 'rls_fix_link_previews_write_service'
    ) THEN
      EXECUTE 'CREATE POLICY "rls_fix_link_previews_write_service" ON public.link_previews FOR ALL USING (auth.role() = ''service_role'') WITH CHECK (auth.role() = ''service_role'')';
    END IF;
  END IF;
END $$;
