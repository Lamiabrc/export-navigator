


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."confidence_level" AS ENUM (
    'low',
    'medium',
    'high'
);


ALTER TYPE "public"."confidence_level" OWNER TO "postgres";


CREATE TYPE "public"."impact_level" AS ENUM (
    'LOW',
    'MED',
    'HIGH'
);


ALTER TYPE "public"."impact_level" OWNER TO "postgres";


CREATE TYPE "public"."mpl_alert_row" AS (
	"id" "text",
	"title" "text",
	"message" "text",
	"severity" "text",
	"country" "text",
	"hs_prefix" "text",
	"detected_at" timestamp with time zone,
	"source" "text"
);


ALTER TYPE "public"."mpl_alert_row" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_internal_calcul_exemple"("p_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
begin
  -- ... logique DB ...
  return jsonb_build_object('ok', true, 'id', p_id);
end;
$$;


ALTER FUNCTION "public"."_internal_calcul_exemple"("p_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_rss_items"("p_limit" integer DEFAULT 40, "p_offset" integer DEFAULT 0) RETURNS TABLE("id" "text", "source_name" "text", "title" "text", "summary" "text", "link" "text", "pub_date" timestamp with time zone, "impact" "text", "reasons" "text"[], "tags" "text"[])
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select id, source_name, title, summary, link, pub_date, impact, reasons, tags
  from public.rss_items
  order by pub_date desc
  limit greatest(1, least(p_limit, 200))
  offset greatest(0, p_offset);
$$;


ALTER FUNCTION "public"."get_rss_items"("p_limit" integer, "p_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user_company_profile"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_company_name text;
  v_country text;
begin
  v_company_name := nullif(trim(coalesce(new.raw_user_meta_data->>'company_name','')), '');
  v_country := nullif(trim(coalesce(new.raw_user_meta_data->>'country','')), '');

  if v_company_name is null then
    return new;
  end if;

  insert into public.company_profiles (user_id, company_name, country)
  values (new.id, v_company_name, coalesce(v_country, 'FR'))
  on conflict (user_id) do nothing;

  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user_company_profile"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."hs_codes_set_keywords"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'extensions'
    AS $$
begin
  new.keywords :=
    to_tsvector('french', unaccent(coalesce(new.description_fr,''))) ||
    to_tsvector('simple', unaccent(coalesce(new.description_en,'')));

  new.updated_at := now();
  return new;
end;
$$;


ALTER FUNCTION "public"."hs_codes_set_keywords"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  select
    (auth.jwt() ->> 'email') = 'lamia.brechet@outlook.fr'
    or coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
    or coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') = 'admin';
$$;


ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."kb_articles_refresh_search_vector"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.search_vector :=
    to_tsvector(
      'pg_catalog.simple'::regconfig,
      (
        coalesce(new.title,'') || ' ' ||
        coalesce(new.summary,'') || ' ' ||
        coalesce(new.body_md,'') || ' ' ||
        coalesce(array_to_string(new.tags,' '),'')
      )::text
    );
  return new;
end;
$$;


ALTER FUNCTION "public"."kb_articles_refresh_search_vector"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."kb_search"("q" "text", "lang" "text", "lim" integer DEFAULT 8) RETURNS TABLE("slug" "text", "language" "text", "title" "text", "summary" "text", "body_md" "text", "tags" "text"[], "actions" "text"[], "followups" "text"[], "updated_at" timestamp with time zone, "rank" real)
    LANGUAGE "sql" STABLE
    AS $$
  select
    k.slug,
    k.language,
    k.title,
    coalesce(k.summary,'') as summary,
    k.body_md,
    k.tags,
    k.actions,
    k.followups,
    k.updated_at,
    ts_rank_cd(k.search_vector, websearch_to_tsquery('pg_catalog.simple', q)) as rank
  from public.kb_articles k
  where k.enabled = true
    and k.language = lang
    and k.search_vector @@ websearch_to_tsquery('pg_catalog.simple', q)
  order by rank desc, k.updated_at desc
  limit greatest(1, least(lim, 20));
$$;


ALTER FUNCTION "public"."kb_search"("q" "text", "lang" "text", "lim" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mpl_create_share"("p_payload" "jsonb", "p_ttl_hours" integer DEFAULT 168) RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  sid text := 'share_' || extract(epoch from now())::bigint || '_' || substr(gen_random_uuid()::text,1,6);
begin
  insert into public.share_payloads(share_id, payload, expires_at)
  values (sid, p_payload, now() + make_interval(hours => p_ttl_hours));
  return sid;
end;
$$;


ALTER FUNCTION "public"."mpl_create_share"("p_payload" "jsonb", "p_ttl_hours" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mpl_get_alerts"("p_email" "text", "p_limit" integer DEFAULT 25, "p_offset" integer DEFAULT 0) RETURNS SETOF "public"."mpl_alert_row"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
declare
  has_id boolean;
  has_title boolean;
  has_message boolean;
  has_severity boolean;
  has_country boolean;
  has_hs_prefix boolean;
  has_detected_at boolean;
  has_created_at boolean;
  has_source boolean;

  id_expr text;
  title_expr text;
  message_expr text;
  severity_expr text;
  country_expr text;
  hs_expr text;
  detected_expr text;
  source_expr text;

  order_expr text;
  severity_filter text;
  country_filter text;
  hs_filter text;

  q text;
begin
  select
    bool_or(column_name='id'),
    bool_or(column_name='title'),
    bool_or(column_name='message'),
    bool_or(column_name='severity'),
    bool_or(column_name='country'),
    bool_or(column_name='hs_prefix'),
    bool_or(column_name='detected_at'),
    bool_or(column_name='created_at'),
    bool_or(column_name='source')
  into
    has_id, has_title, has_message, has_severity, has_country, has_hs_prefix,
    has_detected_at, has_created_at, has_source
  from information_schema.columns
  where table_schema='public' and table_name='mpl_alerts';

  -- Expressions sûres (si colonne absente -> null)
  id_expr       := case when has_id then 'a.id::text'
                        else 'md5(coalesce(a.title,'''')||coalesce(a.message,'''')||coalesce(a.severity,''''))' end;

  title_expr    := case when has_title then 'a.title::text' else 'null::text' end;
  message_expr  := case when has_message then 'a.message::text' else 'null::text' end;
  severity_expr := case when has_severity then 'a.severity::text' else '''MED''::text' end;

  country_expr  := case when has_country then 'a.country::text' else 'null::text' end;
  hs_expr       := case when has_hs_prefix then 'a.hs_prefix::text' else 'null::text' end;
  source_expr   := case when has_source then 'a.source::text' else 'null::text' end;

  -- detected_at peut manquer : on renvoie null, mais on trie quand même
  detected_expr := case when has_detected_at then 'a.detected_at' else 'null::timestamptz' end;

  -- Ordre : detected_at > created_at > now()
  order_expr := case
    when has_detected_at then 'a.detected_at'
    when has_created_at then 'a.created_at'
    else 'now()'
  end;

  -- Filtres adaptatifs selon colonnes disponibles
  severity_filter := case
    when has_severity then '(a.severity in (''HIGH'',''MED''))'
    else 'true'
  end;

  country_filter := case
    when has_country then '(a.country is null or a.country = any(p.countries))'
    else 'true'
  end;

  hs_filter := case
    when has_hs_prefix then
      '(a.hs_prefix is null or exists (
         select 1
         from unnest(p.hs_codes) hs
         where hs like a.hs_prefix || ''%''
       ))'
    else 'true'
  end;

  q := format($fmt$
    with prefs as (
      select *
      from public.mpl_prefs
      where email_normalized = lower(btrim($1))
      limit 1
    )
    select
      %s as id,
      %s as title,
      %s as message,
      %s as severity,
      %s as country,
      %s as hs_prefix,
      %s as detected_at,
      %s as source
    from public.mpl_alerts a
    left join prefs p on true
    where
      (
        p.id is null
        and %s
      )
      or
      (
        p.id is not null
        and %s
        and %s
      )
    order by %s desc nulls last
    limit $2 offset $3
  $fmt$,
    id_expr, title_expr, message_expr, severity_expr,
    country_expr, hs_expr, detected_expr, source_expr,
    severity_filter, country_filter, hs_filter, order_expr
  );

  return query execute q using p_email, p_limit, p_offset;
end;
$_$;


ALTER FUNCTION "public"."mpl_get_alerts"("p_email" "text", "p_limit" integer, "p_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mpl_get_rss"("lim" integer DEFAULT 40, "off" integer DEFAULT 0) RETURNS TABLE("items" "jsonb", "total" integer, "sources" "jsonb")
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'public'
    AS $$
declare
  v_total int;
  v_items jsonb;
  v_sources jsonb;
begin
  select count(*) into v_total from public.rss_items;

  select coalesce(jsonb_agg(t), '[]'::jsonb)
  into v_items
  from (
    select
      i.id,
      i.title,
      i.link,
      coalesce(i.summary,'') as summary,
      i.pub_date as "pubDate",
      i.source_name as "sourceName",
      i.impact,
      i.tags,
      i.reasons
    from public.rss_items i
    order by i.pub_date desc nulls last, i.created_at desc
    limit lim offset off
  ) t;

  select coalesce(jsonb_agg(s), '[]'::jsonb)
  into v_sources
  from (
    select id, name, url, enabled from public.rss_sources
    where enabled = true
    order by name asc
  ) s;

  items := v_items;
  total := v_total;
  sources := v_sources;
  return next;
end;
$$;


ALTER FUNCTION "public"."mpl_get_rss"("lim" integer, "off" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mpl_get_share"("p_share_id" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v jsonb;
begin
  select payload into v
  from public.share_payloads
  where share_id = p_share_id
    and (expires_at is null or expires_at > now());

  if v is null then
    return jsonb_build_object('ok', false, 'error', 'Lien expiré ou introuvable');
  end if;

  return jsonb_build_object('ok', true, 'data', v);
end;
$$;


ALTER FUNCTION "public"."mpl_get_share"("p_share_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mpl_insert_lead"("p_email" "extensions"."citext", "p_consent" boolean, "p_simulation_id" "text" DEFAULT NULL::"text", "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
declare
  v_id uuid;
begin
  insert into public.mpl_leads(email, consent, simulation_id, metadata)
  values (p_email, p_consent, p_simulation_id, coalesce(p_metadata, '{}'::jsonb))
  returning id into v_id;

  return v_id;
end;
$$;


ALTER FUNCTION "public"."mpl_insert_lead"("p_email" "extensions"."citext", "p_consent" boolean, "p_simulation_id" "text", "p_metadata" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mpl_search_hs"("q" "text", "lim" integer DEFAULT 10) RETURNS TABLE("code" "text", "label" "text")
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  select h.code, h.label
  from public.hs_codes h
  where
    h.code like (regexp_replace(q, '[^0-9]', '', 'g') || '%')
    or to_tsvector('simple', h.label) @@ plainto_tsquery('simple', q)
  order by
    case when h.code like (regexp_replace(q, '[^0-9]', '', 'g') || '%') then 0 else 1 end,
    length(h.code),
    h.code
  limit lim;
$$;


ALTER FUNCTION "public"."mpl_search_hs"("q" "text", "lim" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mpl_set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'extensions'
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."mpl_set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mpl_upsert_prefs"("p_email" "extensions"."citext", "p_countries" "text"[] DEFAULT '{}'::"text"[], "p_hs_codes" "text"[] DEFAULT '{}'::"text"[]) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
begin
  insert into public.mpl_prefs(email, countries, hs_codes, updated_at)
  values (
    p_email,
    coalesce(p_countries, '{}'::text[]),
    coalesce(p_hs_codes, '{}'::text[]),
    now()
  )
  on conflict (email)
  do update set
    countries = excluded.countries,
    hs_codes = excluded.hs_codes,
    updated_at = now();

  return jsonb_build_object('ok', true);
end;
$$;


ALTER FUNCTION "public"."mpl_upsert_prefs"("p_email" "extensions"."citext", "p_countries" "text"[], "p_hs_codes" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."normalize_email"("p" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public', 'extensions'
    AS $$
  select nullif(lower(trim(p)), '');
$$;


ALTER FUNCTION "public"."normalize_email"("p" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_calcul_exemple"("p_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'extensions'
    AS $$
begin
  -- vérifs éventuelles (auth.uid(), etc.)
  return public._internal_calcul_exemple(p_id);
end;
$$;


ALTER FUNCTION "public"."rpc_calcul_exemple"("p_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_rss_page"("p_limit" integer DEFAULT 40, "p_offset" integer DEFAULT 0) RETURNS TABLE("id" "uuid", "sourceName" "text", "title" "text", "summary" "text", "link" "text", "pubDate" timestamp with time zone, "impact" "public"."impact_level", "tags" "text"[], "reasons" "text"[])
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    i.id,
    i.source_name as "sourceName",
    i.title,
    i.summary,
    i.link,
    i.pub_date as "pubDate",
    i.impact,
    i.tags,
    i.reasons
  from public.mpl_rss_items i
  order by i.pub_date desc
  limit greatest(p_limit, 1)
  offset greatest(p_offset, 0);
$$;


ALTER FUNCTION "public"."rpc_rss_page"("p_limit" integer, "p_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_upsert_lead"("p_email" "text", "p_consent" boolean, "p_simulation_id" "text" DEFAULT NULL::"text", "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_id uuid;
begin
  if p_email is null or length(trim(p_email)) = 0 then
    raise exception 'email required';
  end if;

  insert into public.mpl_leads(email, consent, simulation_id, metadata)
  values (
    trim(p_email),
    coalesce(p_consent, false),
    p_simulation_id,
    coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (email_lc)
  do update set
    consent = excluded.consent,
    simulation_id = coalesce(excluded.simulation_id, public.mpl_leads.simulation_id),
    metadata = public.mpl_leads.metadata || excluded.metadata,
    updated_at = now()
  returning id into v_id;

  return v_id;
end;
$$;


ALTER FUNCTION "public"."rpc_upsert_lead"("p_email" "text", "p_consent" boolean, "p_simulation_id" "text", "p_metadata" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_upsert_prefs"("p_email" "text", "p_countries" "text"[] DEFAULT '{}'::"text"[], "p_hs_codes" "text"[] DEFAULT '{}'::"text"[]) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if p_email is null or length(trim(p_email)) = 0 then
    raise exception 'email required';
  end if;

  insert into public.mpl_watch_prefs(email, countries, hs_codes)
  values (trim(p_email), coalesce(p_countries, '{}'::text[]), coalesce(p_hs_codes, '{}'::text[]))
  on conflict (email_lc)
  do update set
    countries = excluded.countries,
    hs_codes = excluded.hs_codes,
    updated_at = now();

  return true;
end;
$$;


ALTER FUNCTION "public"."rpc_upsert_prefs"("p_email" "text", "p_countries" "text"[], "p_hs_codes" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."save_simulation"("p_payload" "jsonb", "p_result" "jsonb", "p_email" "text" DEFAULT NULL::"text", "p_score" integer DEFAULT NULL::integer, "p_destination_iso2" "text" DEFAULT NULL::"text", "p_hs_input" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
declare v_id uuid;
begin
  insert into public.simulations(email, payload, result, compliance_score, destination_iso2, hs_input)
  values (
    public.normalize_email(p_email),
    coalesce(p_payload, '{}'::jsonb),
    coalesce(p_result, '{}'::jsonb),
    p_score,
    nullif(trim(p_destination_iso2), ''),
    nullif(trim(p_hs_input), '')
  )
  returning id into v_id;

  return v_id;
end;
$$;


ALTER FUNCTION "public"."save_simulation"("p_payload" "jsonb", "p_result" "jsonb", "p_email" "text", "p_score" integer, "p_destination_iso2" "text", "p_hs_input" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upsert_lead"("p_email" "text", "p_consent" boolean, "p_simulation_id" "uuid" DEFAULT NULL::"uuid", "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
declare v_id uuid;
declare v_email text;
begin
  v_email := public.normalize_email(p_email);
  if v_email is null then
    raise exception 'email_required';
  end if;

  insert into public.leads(email, consent, simulation_id, metadata)
  values (v_email, coalesce(p_consent,false), p_simulation_id, coalesce(p_metadata,'{}'::jsonb))
  on conflict (email) do update
    set consent = excluded.consent,
        simulation_id = excluded.simulation_id,
        metadata = excluded.metadata
  returning id into v_id;

  return v_id;
end;
$$;


ALTER FUNCTION "public"."upsert_lead"("p_email" "text", "p_consent" boolean, "p_simulation_id" "uuid", "p_metadata" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upsert_watch_prefs"("p_email" "text", "p_countries" "text"[] DEFAULT '{}'::"text"[], "p_hs_codes" "text"[] DEFAULT '{}'::"text"[]) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
declare v_email text;
begin
  v_email := public.normalize_email(p_email);
  if v_email is null then
    raise exception 'email_required';
  end if;

  insert into public.watch_prefs(email, countries, hs_codes, updated_at)
  values (v_email, coalesce(p_countries,'{}'::text[]), coalesce(p_hs_codes,'{}'::text[]), now())
  on conflict (email) do update
    set countries = excluded.countries,
        hs_codes = excluded.hs_codes,
        updated_at = now();
end;
$$;


ALTER FUNCTION "public"."upsert_watch_prefs"("p_email" "text", "p_countries" "text"[], "p_hs_codes" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."watch_items_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."watch_items_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."watch_sources_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."watch_sources_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."alerts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "type" "text",
    "country" "text",
    "hs_prefix" "text",
    "title" "text" NOT NULL,
    "message" "text" NOT NULL,
    "severity" "text" DEFAULT 'medium'::"text" NOT NULL,
    "detected_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "country_iso2" "text",
    "source" "text"
);


ALTER TABLE "public"."alerts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."audit_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company" "text",
    "email" "text" NOT NULL,
    "destination" "text",
    "incoterm" "text",
    "value" numeric,
    "currency" "text",
    "lines_count" integer,
    "notes" "text",
    "context_json" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."audit_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."billing_customers" (
    "user_id" "uuid" NOT NULL,
    "stripe_customer_id" "text",
    "email" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."billing_customers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."billing_subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "stripe_subscription_id" "text",
    "stripe_price_id" "text",
    "status" "text",
    "plan" "text" DEFAULT 'free'::"text",
    "current_period_end" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."billing_subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."briefs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "sector" "text",
    "product" "text",
    "destination" "text",
    "summary" "text" NOT NULL,
    "model" "text",
    "sources" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL
);


ALTER TABLE "public"."briefs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."change_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "source" "text" NOT NULL,
    "entity_key" "text",
    "change_type" "text" NOT NULL,
    "summary" "text",
    "severity" "text",
    "detected_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "old_hash" "text",
    "new_hash" "text"
);


ALTER TABLE "public"."change_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."clients" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "libelle_client" "text" NOT NULL,
    "secteur_id" "uuid",
    "country_code" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."clients" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_profiles" (
    "user_id" "uuid" NOT NULL,
    "company_name" "text" NOT NULL,
    "address_line1" "text",
    "address_line2" "text",
    "city" "text",
    "postal_code" "text",
    "country" "text" DEFAULT 'FR'::"text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."company_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."contact_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "email" "text" NOT NULL,
    "offer" "text",
    "message" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL
);


ALTER TABLE "public"."contact_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cost_lines" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "date" "date",
    "cost_type" "text",
    "amount" numeric,
    "currency" "text",
    "market_zone" "text",
    "incoterm" "text",
    "client_id" "text",
    "product_id" "text",
    "destination" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."cost_lines" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."costs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "date" "date",
    "cost_type" "text",
    "amount" numeric,
    "currency" "text",
    "market_zone" "text",
    "destination" "text",
    "incoterm" "text",
    "client_id" "text",
    "product_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."costs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."countries" (
    "code_iso2" "text" NOT NULL,
    "label" "text" NOT NULL,
    "zone" "text" NOT NULL,
    CONSTRAINT "countries_zone_check" CHECK (("zone" = ANY (ARRAY['UE'::"text", 'Hors UE'::"text", 'DROM'::"text", 'Autre'::"text"])))
);


ALTER TABLE "public"."countries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."country_notes" (
    "iso2" "text" NOT NULL,
    "notes" "jsonb" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."country_notes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."destinations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "country_code" "text" NOT NULL,
    "territory_code" "text",
    "label" "text" NOT NULL
);


ALTER TABLE "public"."destinations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."diagnostic_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "destination_country" "text",
    "hs_code" "text",
    "product_label" "text",
    "origin_country" "text",
    "incoterm" "text",
    "quantity" numeric,
    "unit_price" numeric,
    "currency" "text",
    "inputs" "jsonb",
    "outputs" "jsonb",
    "consent_id" "uuid",
    "consent_version" "text"
);


ALTER TABLE "public"."diagnostic_runs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."docs_mock" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "country" "text" NOT NULL,
    "docs" "jsonb" NOT NULL
);


ALTER TABLE "public"."docs_mock" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."document_chunks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "document_id" "uuid" NOT NULL,
    "chunk_index" integer NOT NULL,
    "content" "text" NOT NULL,
    "meta" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."document_chunks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "doc_type" "text",
    "status" "text" DEFAULT 'uploaded'::"text" NOT NULL,
    "object_path" "text" NOT NULL,
    "extracted_text" "text",
    "language" "text",
    "source_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."duty_rate_mock" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "country" "text" NOT NULL,
    "hs_prefix" "text" NOT NULL,
    "rate" numeric NOT NULL
);


ALTER TABLE "public"."duty_rate_mock" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."export_destinations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "region" "text",
    "zone" "text",
    "currency" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."export_destinations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."export_hs_catalog" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "hs_code" "text" NOT NULL,
    "destination" "text" NOT NULL,
    "category" "text",
    "om_rate" numeric,
    "omr_rate" numeric,
    "notes" "text",
    "source" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."export_hs_catalog" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."export_incoterms" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "title" "text",
    "version" "text" DEFAULT '2020'::"text" NOT NULL,
    "group_name" "text",
    "description" "text",
    "insurance_required" boolean DEFAULT false NOT NULL,
    "insurance_min_percent" numeric,
    "obligations" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."export_incoterms" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sales" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "invoice_id" "uuid",
    "line_number" integer,
    "product_id" "uuid",
    "description" "text",
    "hs_code" "text",
    "qty" numeric,
    "unit_price_eur" numeric,
    "line_ht_eur" numeric,
    "date" "date",
    "client_id" "text",
    "unit_price_ht" numeric,
    "net_sales_ht" numeric,
    "currency" "text",
    "market_zone" "text",
    "destination" "text",
    "incoterm" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."sales" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."export_kpi_destinations" AS
 SELECT COALESCE("destination", 'UNKNOWN'::"text") AS "destination",
    "count"(*) AS "line_count",
    "sum"(COALESCE("net_sales_ht", (0)::numeric)) AS "total_ht",
    "sum"(COALESCE("qty", (0)::numeric)) AS "total_qty"
   FROM "public"."sales"
  GROUP BY COALESCE("destination", 'UNKNOWN'::"text");


ALTER VIEW "public"."export_kpi_destinations" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."export_kpi_zones" AS
 SELECT COALESCE("market_zone", 'UNKNOWN'::"text") AS "market_zone",
    "count"(*) AS "line_count",
    "sum"(COALESCE("net_sales_ht", (0)::numeric)) AS "total_ht",
    "sum"(COALESCE("qty", (0)::numeric)) AS "total_qty"
   FROM "public"."sales"
  GROUP BY COALESCE("market_zone", 'UNKNOWN'::"text");


ALTER VIEW "public"."export_kpi_zones" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."export_simulations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "hs_input" "text",
    "product_text" "text",
    "destination_iso2" "text" NOT NULL,
    "value_amount" numeric DEFAULT 0 NOT NULL,
    "currency" "text" DEFAULT 'EUR'::"text" NOT NULL,
    "incoterm" "text" DEFAULT 'DAP'::"text" NOT NULL,
    "transport_mode" "text" DEFAULT 'sea'::"text" NOT NULL,
    "weight_kg" numeric,
    "insurance_amount" numeric,
    "duty" numeric DEFAULT 0 NOT NULL,
    "taxes" numeric DEFAULT 0 NOT NULL,
    "total" numeric DEFAULT 0 NOT NULL,
    "documents" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "risks" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "compliance_score" integer DEFAULT 0 NOT NULL,
    "confidence" "public"."confidence_level" DEFAULT 'low'::"public"."confidence_level" NOT NULL,
    "sources" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "country_notes" "jsonb"
);


ALTER TABLE "public"."export_simulations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rss_items" (
    "id" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "pub_date" timestamp with time zone,
    "source_id" "text",
    "source_name" "text" NOT NULL,
    "title" "text" NOT NULL,
    "link" "text" NOT NULL,
    "summary" "text",
    "impact" "public"."impact_level" DEFAULT 'MED'::"public"."impact_level" NOT NULL,
    "tags" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "reasons" "text"[] DEFAULT '{}'::"text"[] NOT NULL
);


ALTER TABLE "public"."rss_items" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."high_impact_alerts" WITH ("security_invoker"='true') AS
 SELECT "id",
    "title",
    "summary" AS "message",
    "impact" AS "severity",
    NULL::"text" AS "country",
    NULL::"text" AS "hs_prefix",
    "pub_date" AS "detected_at",
    "source_name" AS "source"
   FROM "public"."rss_items"
  WHERE ("impact" = 'HIGH'::"public"."impact_level")
  ORDER BY "pub_date" DESC;


ALTER VIEW "public"."high_impact_alerts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."hs_chapters" (
    "chapter" "text" NOT NULL,
    "label" "text" NOT NULL
);


ALTER TABLE "public"."hs_chapters" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."hs_codes" (
    "hs_code" "text" NOT NULL,
    "chapter" "text",
    "label" "text" NOT NULL,
    "code" "text",
    "description_fr" "text",
    "description_en" "text",
    "version_year" integer DEFAULT 2022 NOT NULL,
    "source" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "keywords" "tsvector"
);


ALTER TABLE "public"."hs_codes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ingestion_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "source" "text" NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ended_at" timestamp with time zone,
    "status" "text" DEFAULT 'running'::"text" NOT NULL,
    "rows" integer DEFAULT 0,
    "checksum" "text"
);


ALTER TABLE "public"."ingestion_runs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invoice_uploads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "file_name" "text" NOT NULL,
    "file_path" "text" NOT NULL,
    "file_type" "text",
    "size_bytes" bigint,
    "destination" "text",
    "incoterm" "text",
    "currency" "text",
    "total_ht" numeric,
    "total_tva" numeric,
    "total_ttc" numeric,
    "parsed" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."invoice_uploads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."kb_articles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "language" "text" NOT NULL,
    "title" "text" NOT NULL,
    "summary" "text",
    "body_md" "text" NOT NULL,
    "tags" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "actions" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "followups" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "search_vector" "tsvector",
    CONSTRAINT "kb_articles_language_check" CHECK (("language" = ANY (ARRAY['fr'::"text", 'en'::"text"])))
);


ALTER TABLE "public"."kb_articles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."kb_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "language" "text" DEFAULT 'fr'::"text" NOT NULL,
    "tags" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "storage_bucket" "text" DEFAULT 'kb_docs'::"text" NOT NULL,
    "storage_path" "text" NOT NULL,
    "file_name" "text",
    "mime_type" "text",
    "size_bytes" bigint,
    "enabled" boolean DEFAULT true NOT NULL,
    "uploaded_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "kb_documents_language_check" CHECK (("language" = ANY (ARRAY['fr'::"text", 'en'::"text"])))
);


ALTER TABLE "public"."kb_documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."leads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "email" "text" NOT NULL,
    "consent" boolean DEFAULT false NOT NULL,
    "simulation_id" "uuid",
    "metadata" "jsonb",
    "offer_type" "text",
    "message" "text",
    "context_json" "jsonb",
    "source" "text",
    "consent_newsletter" boolean DEFAULT false
);


ALTER TABLE "public"."leads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."link_previews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "url" "text" NOT NULL,
    "url_hash" "text" NOT NULL,
    "title" "text",
    "description" "text",
    "image_url" "text",
    "site_name" "text",
    "fetched_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."link_previews" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mpl_alerts_raw" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "message" "text" NOT NULL,
    "severity" "text" DEFAULT 'info'::"text" NOT NULL,
    "country" "text",
    "hs_prefix" "text",
    "source" "text",
    "detected_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."mpl_alerts_raw" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."mpl_alerts" WITH ("security_invoker"='true') AS
 SELECT "id",
    "title",
    "message",
    "severity",
    "country",
    "hs_prefix",
    "detected_at",
    "source",
    "created_at"
   FROM "public"."mpl_alerts_raw"
  ORDER BY COALESCE("detected_at", "created_at") DESC, "created_at" DESC;


ALTER VIEW "public"."mpl_alerts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mpl_leads" (
    "id" "uuid" DEFAULT "extensions"."gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "email_lc" "text" GENERATED ALWAYS AS ("lower"("email")) STORED,
    "consent" boolean DEFAULT false NOT NULL,
    "simulation_id" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "email_normalized" "text" GENERATED ALWAYS AS ("lower"("email")) STORED
);


ALTER TABLE "public"."mpl_leads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mpl_prefs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "extensions"."citext" NOT NULL,
    "countries" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "hs_codes" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "email_normalized" "text" GENERATED ALWAYS AS ("lower"(("email")::"text")) STORED
);


ALTER TABLE "public"."mpl_prefs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mpl_rss_items" (
    "id" "uuid" DEFAULT "extensions"."gen_random_uuid"() NOT NULL,
    "source_id" "text",
    "source_name" "text" NOT NULL,
    "title" "text" NOT NULL,
    "summary" "text" NOT NULL,
    "link" "text" NOT NULL,
    "link_hash" "text" GENERATED ALWAYS AS ("encode"("extensions"."digest"("link", 'sha256'::"text"), 'hex'::"text")) STORED,
    "pub_date" timestamp with time zone NOT NULL,
    "impact" "public"."impact_level" DEFAULT 'LOW'::"public"."impact_level" NOT NULL,
    "tags" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "reasons" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "country" "text",
    "hs_prefix" "text",
    "raw" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."mpl_rss_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mpl_rss_sources" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "url" "text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."mpl_rss_sources" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mpl_watch_prefs" (
    "id" "uuid" DEFAULT "extensions"."gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "email_lc" "text" GENERATED ALWAYS AS ("lower"("email")) STORED,
    "countries" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "hs_codes" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."mpl_watch_prefs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."newsletter_subscribers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "email" "text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "tags" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "company_name" "text",
    "country" "text",
    "hs_code" "text",
    "frequency" "text" DEFAULT 'weekly'::"text",
    "source" "text",
    "consent" boolean DEFAULT true,
    "consented_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."newsletter_subscribers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "target" "text" NOT NULL,
    "target_id" "text" NOT NULL,
    "body" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."notes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."octroi_mer" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "territory_code" "text" NOT NULL,
    "hs_code" "text",
    "om_rate" numeric,
    "omr_rate" numeric,
    "start_date" "date",
    "end_date" "date",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."octroi_mer" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."om_rates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "territory_code" "text" NOT NULL,
    "hs_code" "text",
    "om_rate" numeric,
    "omr_rate" numeric,
    "start_date" "date",
    "end_date" "date",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."om_rates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."playbook_sections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "playbook_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "content_md" "text",
    "content_html" "text",
    "position" integer DEFAULT 0 NOT NULL,
    "meta" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."playbook_sections" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."playbooks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "version" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."playbooks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pricing_coefficients" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "territory_code" "text" NOT NULL,
    "coef" numeric NOT NULL
);


ALTER TABLE "public"."pricing_coefficients" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."product_costs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "product_id" "uuid" NOT NULL,
    "cost_type" "text" NOT NULL,
    "amount" numeric DEFAULT 0 NOT NULL,
    "currency" "text" DEFAULT 'EUR'::"text" NOT NULL,
    "unit" "text",
    "source" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."product_costs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."products" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code_article" "text",
    "libelle_article" "text",
    "category" "text",
    "hs_code" "text",
    "tarif_catalogue_2025" numeric,
    "tarif_ref_eur" numeric,
    "ref_code" "text",
    "tva_percent" numeric,
    "manufacturer_name" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "code" "text",
    "label" "text",
    "tva" numeric,
    "manufacturer" "text"
);


ALTER TABLE "public"."products" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."raw_snapshots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "source" "text" NOT NULL,
    "fetched_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "payload" "jsonb" NOT NULL,
    "checksum" "text" NOT NULL
);


ALTER TABLE "public"."raw_snapshots" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reg_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "summary" "text",
    "jurisdiction" "text",
    "impact" "text",
    "status" "text" DEFAULT 'triaged'::"text" NOT NULL,
    "export_zone" "text",
    "territory_codes" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "hs_codes" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "source_item_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."reg_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."regulatory_feeds" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "source_name" "text" DEFAULT 'manual'::"text" NOT NULL,
    "source_url" "text",
    "category" "text",
    "territory" "text",
    "active" boolean DEFAULT true,
    "name" "text",
    "zone" "text",
    "enabled" boolean DEFAULT true,
    "kind" "text" DEFAULT 'rss'::"text",
    "country_iso2" "text",
    "is_public" boolean,
    "language" "text",
    "logo_url" "text",
    "notes" "text",
    "last_fetched_at" timestamp with time zone,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "tags" "text"[]
);


ALTER TABLE "public"."regulatory_feeds" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."regulatory_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "source_id" "uuid",
    "title" "text" NOT NULL,
    "summary" "text",
    "link" "text",
    "published_at" timestamp with time zone,
    "category" "text",
    "territory" "text",
    "tags" "text"[],
    "image_url" "text",
    "fingerprint" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."regulatory_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rss_sources" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "url" "text" NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."rss_sources" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sales_invoices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "invoice_number" "text" NOT NULL,
    "invoice_date" "date" NOT NULL,
    "client_id" "uuid",
    "client_name_raw" "text",
    "destination_country" "text",
    "territory_code" "text",
    "currency" "text" DEFAULT 'EUR'::"text",
    "invoice_ht_eur" numeric,
    "transit_fee_eur" numeric,
    "transport_cost_eur" numeric,
    "products_ht_eur" numeric,
    "packages_raw" integer,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."sales_invoices" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sales_lines" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "date" "date",
    "client_id" "text",
    "product_id" "text",
    "qty" numeric,
    "unit_price_ht" numeric,
    "net_sales_ht" numeric,
    "currency" "text",
    "market_zone" "text",
    "incoterm" "text",
    "destination" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."sales_lines" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sanctions_entities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_key" "text" NOT NULL,
    "list_name" "text" NOT NULL,
    "name" "text" NOT NULL,
    "aliases" "text"[],
    "program" "text",
    "country" "text",
    "identifiers" "jsonb",
    "first_seen" timestamp with time zone,
    "last_seen" timestamp with time zone
);


ALTER TABLE "public"."sanctions_entities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sanctions_matches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "query_name" "text",
    "query_country" "text",
    "matched_entity_id" "uuid",
    "match_score" numeric,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."sanctions_matches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sectors" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "label" "text" NOT NULL
);


ALTER TABLE "public"."sectors" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."share_payloads" (
    "share_id" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "payload" "jsonb" NOT NULL,
    "expires_at" timestamp with time zone
);


ALTER TABLE "public"."share_payloads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."simulations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "email" "text",
    "hs_input" "text",
    "destination" "text" NOT NULL,
    "payload" "jsonb" NOT NULL,
    "result" "jsonb" NOT NULL
);


ALTER TABLE "public"."simulations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tax_rules_extra" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "country_code" "text",
    "hs_code" "text",
    "tax_name" "text",
    "tax_rate" numeric,
    "notes" "text"
);


ALTER TABLE "public"."tax_rules_extra" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."taxes_om" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "territory_code" "text" NOT NULL,
    "rule_name" "text",
    "rate_percent" numeric,
    "start_date" "date",
    "end_date" "date",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."taxes_om" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."trade_flows" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "flow_date" "date" NOT NULL,
    "hs_code" "text",
    "reporter_country" "text",
    "partner_country" "text",
    "flow_type" "text",
    "value_eur" numeric,
    "volume_kg" numeric,
    "source" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "trade_flows_flow_type_check" CHECK (("flow_type" = ANY (ARRAY['export'::"text", 'import'::"text"])))
);


ALTER TABLE "public"."trade_flows" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."transport_rate_lines" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "destination_country" "text",
    "mode" "text",
    "cost_per_kg" numeric,
    "min_cost" numeric,
    "currency" "text" DEFAULT 'EUR'::"text"
);


ALTER TABLE "public"."transport_rate_lines" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."transport_rates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "destination_id" "uuid",
    "transport_mode" "text" NOT NULL,
    "incoterm_code" "text",
    "currency" "text" DEFAULT 'EUR'::"text" NOT NULL,
    "min_cost" numeric,
    "cost_per_kg" numeric,
    "cost_per_m3" numeric,
    "fixed_cost" numeric,
    "notes" "text",
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."transport_rates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_consents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "scope" "text" NOT NULL,
    "consent" boolean DEFAULT true NOT NULL,
    "consent_version" "text" NOT NULL,
    "consent_text_hash" "text" NOT NULL,
    "consented_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_consents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_prefs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "countries_json" "jsonb",
    "hs_json" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_prefs" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_kpi_sales_by_destination" AS
 SELECT COALESCE("destination", 'UNKNOWN'::"text") AS "destination",
    "count"(*) AS "line_count",
    "sum"(COALESCE("net_sales_ht", (0)::numeric)) AS "total_ht",
    "sum"(COALESCE("qty", (0)::numeric)) AS "total_qty"
   FROM "public"."sales_lines"
  GROUP BY COALESCE("destination", 'UNKNOWN'::"text");


ALTER VIEW "public"."v_kpi_sales_by_destination" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_kpi_sales_by_zone" AS
 SELECT COALESCE("market_zone", 'UNKNOWN'::"text") AS "market_zone",
    "count"(*) AS "line_count",
    "sum"(COALESCE("net_sales_ht", (0)::numeric)) AS "total_ht",
    "sum"(COALESCE("qty", (0)::numeric)) AS "total_qty"
   FROM "public"."sales_lines"
  GROUP BY COALESCE("market_zone", 'UNKNOWN'::"text");


ALTER VIEW "public"."v_kpi_sales_by_zone" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vat_rate_mock" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "country" "text" NOT NULL,
    "rate" numeric NOT NULL
);


ALTER TABLE "public"."vat_rate_mock" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vat_rates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "country_code" "text",
    "territory_code" "text",
    "rate_standard" numeric NOT NULL,
    "rate_reduced" numeric,
    "autoliquidation" boolean DEFAULT false,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."vat_rates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."watch_digests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "digest_date" "date" NOT NULL,
    "sent_at" timestamp with time zone,
    "status" "text" DEFAULT 'pending'::"text",
    "summary" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."watch_digests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."watch_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "source_id" "uuid",
    "title" "text" NOT NULL,
    "link" "text" NOT NULL,
    "summary" "text",
    "published_at" timestamp with time zone,
    "country" "text",
    "category" "text",
    "raw" "jsonb",
    "hash" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."watch_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."watch_prefs" (
    "email" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "countries" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "hs_codes" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "user_id" "uuid"
);


ALTER TABLE "public"."watch_prefs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."watch_sources" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "source_name" "text" NOT NULL,
    "source_url" "text" NOT NULL,
    "country" "text",
    "category" "text",
    "kind" "text" NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL,
    "last_checked_at" timestamp with time zone,
    "last_status" integer,
    "last_error" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "watch_sources_kind_check" CHECK (("kind" = ANY (ARRAY['rss'::"text", 'web'::"text"])))
);


ALTER TABLE "public"."watch_sources" OWNER TO "postgres";


ALTER TABLE ONLY "public"."alerts"
    ADD CONSTRAINT "alerts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."audit_requests"
    ADD CONSTRAINT "audit_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."billing_customers"
    ADD CONSTRAINT "billing_customers_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."billing_customers"
    ADD CONSTRAINT "billing_customers_stripe_customer_id_key" UNIQUE ("stripe_customer_id");



ALTER TABLE ONLY "public"."billing_subscriptions"
    ADD CONSTRAINT "billing_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."billing_subscriptions"
    ADD CONSTRAINT "billing_subscriptions_stripe_subscription_id_key" UNIQUE ("stripe_subscription_id");



ALTER TABLE ONLY "public"."briefs"
    ADD CONSTRAINT "briefs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."change_log"
    ADD CONSTRAINT "change_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_profiles"
    ADD CONSTRAINT "company_profiles_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."contact_requests"
    ADD CONSTRAINT "contact_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cost_lines"
    ADD CONSTRAINT "cost_lines_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."costs"
    ADD CONSTRAINT "costs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."countries"
    ADD CONSTRAINT "countries_pkey" PRIMARY KEY ("code_iso2");



ALTER TABLE ONLY "public"."country_notes"
    ADD CONSTRAINT "country_notes_pkey" PRIMARY KEY ("iso2");



ALTER TABLE ONLY "public"."destinations"
    ADD CONSTRAINT "destinations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."diagnostic_runs"
    ADD CONSTRAINT "diagnostic_runs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."docs_mock"
    ADD CONSTRAINT "docs_mock_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."document_chunks"
    ADD CONSTRAINT "document_chunks_doc_chunk_uniq" UNIQUE ("document_id", "chunk_index");



ALTER TABLE ONLY "public"."document_chunks"
    ADD CONSTRAINT "document_chunks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_object_path_uniq" UNIQUE ("object_path");



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."duty_rate_mock"
    ADD CONSTRAINT "duty_rate_mock_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."export_destinations"
    ADD CONSTRAINT "export_destinations_code_uniq" UNIQUE ("code");



ALTER TABLE ONLY "public"."export_destinations"
    ADD CONSTRAINT "export_destinations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."export_hs_catalog"
    ADD CONSTRAINT "export_hs_catalog_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."export_hs_catalog"
    ADD CONSTRAINT "export_hs_catalog_uniq" UNIQUE ("hs_code", "destination");



ALTER TABLE ONLY "public"."export_incoterms"
    ADD CONSTRAINT "export_incoterms_code_version_uniq" UNIQUE ("code", "version");



ALTER TABLE ONLY "public"."export_incoterms"
    ADD CONSTRAINT "export_incoterms_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."export_simulations"
    ADD CONSTRAINT "export_simulations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hs_chapters"
    ADD CONSTRAINT "hs_chapters_pkey" PRIMARY KEY ("chapter");



ALTER TABLE ONLY "public"."hs_codes"
    ADD CONSTRAINT "hs_codes_pkey" PRIMARY KEY ("hs_code");



ALTER TABLE ONLY "public"."ingestion_runs"
    ADD CONSTRAINT "ingestion_runs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invoice_uploads"
    ADD CONSTRAINT "invoice_uploads_file_path_uniq" UNIQUE ("file_path");



ALTER TABLE ONLY "public"."invoice_uploads"
    ADD CONSTRAINT "invoice_uploads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kb_articles"
    ADD CONSTRAINT "kb_articles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kb_articles"
    ADD CONSTRAINT "kb_articles_slug_lang_uniq" UNIQUE ("slug", "language");



ALTER TABLE ONLY "public"."kb_documents"
    ADD CONSTRAINT "kb_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kb_documents"
    ADD CONSTRAINT "kb_documents_storage_path_uniq" UNIQUE ("storage_path");



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."link_previews"
    ADD CONSTRAINT "link_previews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mpl_alerts_raw"
    ADD CONSTRAINT "mpl_alerts_raw_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mpl_leads"
    ADD CONSTRAINT "mpl_leads_email_lc_key" UNIQUE ("email_lc");



ALTER TABLE ONLY "public"."mpl_leads"
    ADD CONSTRAINT "mpl_leads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mpl_prefs"
    ADD CONSTRAINT "mpl_prefs_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."mpl_prefs"
    ADD CONSTRAINT "mpl_prefs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mpl_rss_items"
    ADD CONSTRAINT "mpl_rss_items_link_hash_key" UNIQUE ("link_hash");



ALTER TABLE ONLY "public"."mpl_rss_items"
    ADD CONSTRAINT "mpl_rss_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mpl_rss_sources"
    ADD CONSTRAINT "mpl_rss_sources_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mpl_watch_prefs"
    ADD CONSTRAINT "mpl_watch_prefs_email_lc_key" UNIQUE ("email_lc");



ALTER TABLE ONLY "public"."mpl_watch_prefs"
    ADD CONSTRAINT "mpl_watch_prefs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."newsletter_subscribers"
    ADD CONSTRAINT "newsletter_subscribers_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."newsletter_subscribers"
    ADD CONSTRAINT "newsletter_subscribers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notes"
    ADD CONSTRAINT "notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."octroi_mer"
    ADD CONSTRAINT "octroi_mer_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."om_rates"
    ADD CONSTRAINT "om_rates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."playbook_sections"
    ADD CONSTRAINT "playbook_sections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."playbooks"
    ADD CONSTRAINT "playbooks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."playbooks"
    ADD CONSTRAINT "playbooks_slug_uniq" UNIQUE ("slug");



ALTER TABLE ONLY "public"."pricing_coefficients"
    ADD CONSTRAINT "pricing_coefficients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_costs"
    ADD CONSTRAINT "product_costs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."raw_snapshots"
    ADD CONSTRAINT "raw_snapshots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reg_events"
    ADD CONSTRAINT "reg_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reg_events"
    ADD CONSTRAINT "reg_events_source_item_uniq" UNIQUE ("source_item_id");



ALTER TABLE ONLY "public"."regulatory_feeds"
    ADD CONSTRAINT "regulatory_feeds_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."regulatory_feeds"
    ADD CONSTRAINT "regulatory_feeds_source_url_key" UNIQUE ("source_url");



ALTER TABLE ONLY "public"."regulatory_items"
    ADD CONSTRAINT "regulatory_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."regulatory_items"
    ADD CONSTRAINT "regulatory_items_source_fingerprint_key" UNIQUE ("source_id", "fingerprint");



ALTER TABLE ONLY "public"."rss_items"
    ADD CONSTRAINT "rss_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rss_sources"
    ADD CONSTRAINT "rss_sources_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sales_invoices"
    ADD CONSTRAINT "sales_invoices_invoice_number_key" UNIQUE ("invoice_number");



ALTER TABLE ONLY "public"."sales_invoices"
    ADD CONSTRAINT "sales_invoices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sales_lines"
    ADD CONSTRAINT "sales_lines_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sales"
    ADD CONSTRAINT "sales_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sanctions_entities"
    ADD CONSTRAINT "sanctions_entities_entity_key_key" UNIQUE ("entity_key");



ALTER TABLE ONLY "public"."sanctions_entities"
    ADD CONSTRAINT "sanctions_entities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sanctions_matches"
    ADD CONSTRAINT "sanctions_matches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sectors"
    ADD CONSTRAINT "sectors_label_key" UNIQUE ("label");



ALTER TABLE ONLY "public"."sectors"
    ADD CONSTRAINT "sectors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."share_payloads"
    ADD CONSTRAINT "share_payloads_pkey" PRIMARY KEY ("share_id");



ALTER TABLE ONLY "public"."simulations"
    ADD CONSTRAINT "simulations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tax_rules_extra"
    ADD CONSTRAINT "tax_rules_extra_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."taxes_om"
    ADD CONSTRAINT "taxes_om_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trade_flows"
    ADD CONSTRAINT "trade_flows_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."transport_rate_lines"
    ADD CONSTRAINT "transport_rate_lines_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."transport_rates"
    ADD CONSTRAINT "transport_rates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_consents"
    ADD CONSTRAINT "user_consents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_prefs"
    ADD CONSTRAINT "user_prefs_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."user_prefs"
    ADD CONSTRAINT "user_prefs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vat_rate_mock"
    ADD CONSTRAINT "vat_rate_mock_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vat_rates"
    ADD CONSTRAINT "vat_rates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."watch_digests"
    ADD CONSTRAINT "watch_digests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."watch_items"
    ADD CONSTRAINT "watch_items_hash_key" UNIQUE ("hash");



ALTER TABLE ONLY "public"."watch_items"
    ADD CONSTRAINT "watch_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."watch_prefs"
    ADD CONSTRAINT "watch_prefs_pkey" PRIMARY KEY ("email");



ALTER TABLE ONLY "public"."watch_sources"
    ADD CONSTRAINT "watch_sources_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."watch_sources"
    ADD CONSTRAINT "watch_sources_source_url_key" UNIQUE ("source_url");



CREATE INDEX "billing_customers_user_id_idx" ON "public"."billing_customers" USING "btree" ("user_id");



CREATE INDEX "billing_subscriptions_user_id_idx" ON "public"."billing_subscriptions" USING "btree" ("user_id");



CREATE INDEX "cost_lines_date_idx" ON "public"."cost_lines" USING "btree" ("date");



CREATE INDEX "cost_lines_zone_idx" ON "public"."cost_lines" USING "btree" ("market_zone");



CREATE INDEX "costs_date_idx" ON "public"."costs" USING "btree" ("date");



CREATE INDEX "costs_zone_idx" ON "public"."costs" USING "btree" ("market_zone");



CREATE INDEX "diagnostic_runs_created_at_idx" ON "public"."diagnostic_runs" USING "btree" ("created_at");



CREATE INDEX "diagnostic_runs_user_id_idx" ON "public"."diagnostic_runs" USING "btree" ("user_id");



CREATE INDEX "document_chunks_document_idx" ON "public"."document_chunks" USING "btree" ("document_id");



CREATE INDEX "documents_status_idx" ON "public"."documents" USING "btree" ("status");



CREATE INDEX "export_destinations_name_idx" ON "public"."export_destinations" USING "btree" ("name");



CREATE INDEX "export_destinations_region_idx" ON "public"."export_destinations" USING "btree" ("region");



CREATE INDEX "export_hs_catalog_dest_idx" ON "public"."export_hs_catalog" USING "btree" ("destination");



CREATE INDEX "export_hs_catalog_hs_idx" ON "public"."export_hs_catalog" USING "btree" ("hs_code");



CREATE INDEX "export_incoterms_code_idx" ON "public"."export_incoterms" USING "btree" ("code");



CREATE INDEX "export_simulations_created_idx" ON "public"."export_simulations" USING "btree" ("created_at" DESC);



CREATE INDEX "export_simulations_destination_idx" ON "public"."export_simulations" USING "btree" ("destination_iso2");



CREATE INDEX "hs_codes_code_prefix_idx" ON "public"."hs_codes" USING "btree" ("code" "text_pattern_ops");



CREATE UNIQUE INDEX "hs_codes_code_uniq" ON "public"."hs_codes" USING "btree" ("code");



CREATE INDEX "hs_codes_desc_trgm" ON "public"."hs_codes" USING "gin" ("description_fr" "extensions"."gin_trgm_ops");



CREATE INDEX "hs_codes_keywords_gin" ON "public"."hs_codes" USING "gin" ("keywords");



CREATE INDEX "hs_codes_label_idx" ON "public"."hs_codes" USING "gin" ("to_tsvector"('"simple"'::"regconfig", "label"));



CREATE INDEX "idx_alerts_raw_country" ON "public"."mpl_alerts_raw" USING "btree" ("country");



CREATE INDEX "idx_alerts_raw_detected_at" ON "public"."mpl_alerts_raw" USING "btree" ("detected_at" DESC);



CREATE INDEX "idx_alerts_raw_hs_prefix" ON "public"."mpl_alerts_raw" USING "btree" ("hs_prefix");



CREATE INDEX "idx_billing_customers_user_id" ON "public"."billing_customers" USING "btree" ("user_id");



CREATE INDEX "idx_billing_subscriptions_user_id" ON "public"."billing_subscriptions" USING "btree" ("user_id");



CREATE INDEX "idx_mpl_leads_created_at" ON "public"."mpl_leads" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_mpl_leads_email_normalized" ON "public"."mpl_leads" USING "btree" ("email_normalized");



CREATE INDEX "idx_mpl_prefs_email_normalized" ON "public"."mpl_prefs" USING "btree" ("email_normalized");



CREATE INDEX "idx_watch_digests_user_id" ON "public"."watch_digests" USING "btree" ("user_id");



CREATE INDEX "idx_watch_items_category" ON "public"."watch_items" USING "btree" ("category");



CREATE INDEX "idx_watch_items_country" ON "public"."watch_items" USING "btree" ("country");



CREATE INDEX "idx_watch_items_published" ON "public"."watch_items" USING "btree" ("published_at");



CREATE INDEX "idx_watch_items_source" ON "public"."watch_items" USING "btree" ("source_id");



CREATE INDEX "idx_watch_sources_category" ON "public"."watch_sources" USING "btree" ("category");



CREATE INDEX "idx_watch_sources_country" ON "public"."watch_sources" USING "btree" ("country");



CREATE INDEX "idx_watch_sources_kind" ON "public"."watch_sources" USING "btree" ("kind");



CREATE INDEX "invoice_uploads_created_at_idx" ON "public"."invoice_uploads" USING "btree" ("created_at");



CREATE INDEX "invoice_uploads_user_id_idx" ON "public"."invoice_uploads" USING "btree" ("user_id");



CREATE INDEX "kb_articles_lang_idx" ON "public"."kb_articles" USING "btree" ("language");



CREATE INDEX "kb_articles_search_idx" ON "public"."kb_articles" USING "gin" ("search_vector");



CREATE INDEX "kb_articles_tags_idx" ON "public"."kb_articles" USING "gin" ("tags");



CREATE INDEX "kb_documents_lang_idx" ON "public"."kb_documents" USING "btree" ("language");



CREATE INDEX "kb_documents_tags_idx" ON "public"."kb_documents" USING "gin" ("tags");



CREATE INDEX "leads_created_at_idx" ON "public"."leads" USING "btree" ("created_at" DESC);



CREATE INDEX "leads_created_idx" ON "public"."leads" USING "btree" ("created_at" DESC);



CREATE INDEX "leads_email_idx" ON "public"."leads" USING "btree" ("email");



CREATE UNIQUE INDEX "leads_email_uniq" ON "public"."leads" USING "btree" ("email");



CREATE INDEX "link_previews_updated_at_idx" ON "public"."link_previews" USING "btree" ("updated_at" DESC);



CREATE UNIQUE INDEX "link_previews_url_hash_key" ON "public"."link_previews" USING "btree" ("url_hash");



CREATE INDEX "mpl_rss_items_impact_idx" ON "public"."mpl_rss_items" USING "btree" ("impact");



CREATE INDEX "mpl_rss_items_pub_date_idx" ON "public"."mpl_rss_items" USING "btree" ("pub_date" DESC);



CREATE UNIQUE INDEX "newsletter_subscribers_email_idx" ON "public"."newsletter_subscribers" USING "btree" ("email");



CREATE INDEX "notes_target_idx" ON "public"."notes" USING "btree" ("target", "target_id", "created_at" DESC);



CREATE INDEX "playbook_sections_playbook_idx" ON "public"."playbook_sections" USING "btree" ("playbook_id");



CREATE INDEX "playbook_sections_position_idx" ON "public"."playbook_sections" USING "btree" ("position");



CREATE INDEX "playbooks_status_idx" ON "public"."playbooks" USING "btree" ("status");



CREATE INDEX "product_costs_product_idx" ON "public"."product_costs" USING "btree" ("product_id");



CREATE INDEX "product_costs_type_idx" ON "public"."product_costs" USING "btree" ("cost_type");



CREATE INDEX "reg_events_jurisdiction_idx" ON "public"."reg_events" USING "btree" ("jurisdiction");



CREATE INDEX "reg_events_status_idx" ON "public"."reg_events" USING "btree" ("status");



CREATE INDEX "regulatory_feeds_enabled_idx" ON "public"."regulatory_feeds" USING "btree" ("enabled", "territory", "category");



CREATE INDEX "regulatory_feeds_public_idx" ON "public"."regulatory_feeds" USING "btree" ("is_public");



CREATE UNIQUE INDEX "regulatory_feeds_source_url_uq" ON "public"."regulatory_feeds" USING "btree" ("source_url");



CREATE INDEX "regulatory_items_category_idx" ON "public"."regulatory_items" USING "btree" ("category");



CREATE INDEX "regulatory_items_created_at_idx" ON "public"."regulatory_items" USING "btree" ("created_at" DESC);



CREATE INDEX "regulatory_items_created_idx" ON "public"."regulatory_items" USING "btree" ("created_at" DESC);



CREATE INDEX "regulatory_items_published_at_idx" ON "public"."regulatory_items" USING "btree" ("published_at" DESC NULLS LAST);



CREATE INDEX "regulatory_items_published_idx" ON "public"."regulatory_items" USING "btree" ("published_at" DESC);



CREATE INDEX "regulatory_items_source_id_idx" ON "public"."regulatory_items" USING "btree" ("source_id");



CREATE INDEX "regulatory_items_source_idx" ON "public"."regulatory_items" USING "btree" ("source_id");



CREATE INDEX "regulatory_items_territory_idx" ON "public"."regulatory_items" USING "btree" ("territory");



CREATE INDEX "rss_items_impact_idx" ON "public"."rss_items" USING "btree" ("impact");



CREATE INDEX "rss_items_pub_date_idx" ON "public"."rss_items" USING "btree" ("pub_date" DESC NULLS LAST);



CREATE INDEX "rss_items_source_idx" ON "public"."rss_items" USING "btree" ("source_name");



CREATE INDEX "rss_items_tags_gin" ON "public"."rss_items" USING "gin" ("tags");



CREATE INDEX "sales_date_idx" ON "public"."sales" USING "btree" ("date");



CREATE INDEX "sales_lines_date_idx" ON "public"."sales_lines" USING "btree" ("date");



CREATE INDEX "sales_lines_zone_idx" ON "public"."sales_lines" USING "btree" ("market_zone");



CREATE INDEX "sales_zone_idx" ON "public"."sales" USING "btree" ("market_zone");



CREATE INDEX "simulations_created_at_idx" ON "public"."simulations" USING "btree" ("created_at" DESC);



CREATE INDEX "simulations_destination_idx" ON "public"."simulations" USING "btree" ("destination");



CREATE INDEX "simulations_email_idx" ON "public"."simulations" USING "btree" ("email");



CREATE INDEX "trade_flows_date_idx" ON "public"."trade_flows" USING "btree" ("flow_date");



CREATE INDEX "trade_flows_hs_idx" ON "public"."trade_flows" USING "btree" ("hs_code");



CREATE INDEX "trade_flows_partner_idx" ON "public"."trade_flows" USING "btree" ("partner_country");



CREATE INDEX "trade_flows_reporter_idx" ON "public"."trade_flows" USING "btree" ("reporter_country");



CREATE INDEX "trade_flows_type_idx" ON "public"."trade_flows" USING "btree" ("flow_type");



CREATE INDEX "transport_rates_destination_idx" ON "public"."transport_rates" USING "btree" ("destination_id");



CREATE INDEX "transport_rates_mode_idx" ON "public"."transport_rates" USING "btree" ("transport_mode");



CREATE UNIQUE INDEX "uq_products_code" ON "public"."products" USING "btree" ("code") WHERE ("code" IS NOT NULL);



CREATE UNIQUE INDEX "uq_watch_items_hash" ON "public"."watch_items" USING "btree" ("hash");



CREATE INDEX "user_consents_user_id_idx" ON "public"."user_consents" USING "btree" ("user_id");



CREATE UNIQUE INDEX "user_consents_user_scope_version_idx" ON "public"."user_consents" USING "btree" ("user_id", "scope", "consent_version");



CREATE INDEX "watch_prefs_email_idx" ON "public"."watch_prefs" USING "btree" ("email");



CREATE OR REPLACE TRIGGER "billing_customers_updated_at" BEFORE UPDATE ON "public"."billing_customers" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "billing_subscriptions_updated_at" BEFORE UPDATE ON "public"."billing_subscriptions" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "export_simulations_updated_at" BEFORE UPDATE ON "public"."export_simulations" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "link_previews_updated_at" BEFORE UPDATE ON "public"."link_previews" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "newsletter_subscribers_updated_at" BEFORE UPDATE ON "public"."newsletter_subscribers" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_billing_customers_updated_at" BEFORE UPDATE ON "public"."billing_customers" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_billing_subscriptions_updated_at" BEFORE UPDATE ON "public"."billing_subscriptions" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_documents_updated_at" BEFORE UPDATE ON "public"."documents" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_export_destinations_updated_at" BEFORE UPDATE ON "public"."export_destinations" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_export_hs_catalog_updated_at" BEFORE UPDATE ON "public"."export_hs_catalog" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_export_incoterms_updated_at" BEFORE UPDATE ON "public"."export_incoterms" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_hs_codes_set_keywords" BEFORE INSERT OR UPDATE OF "description_fr", "description_en" ON "public"."hs_codes" FOR EACH ROW EXECUTE FUNCTION "public"."hs_codes_set_keywords"();



CREATE OR REPLACE TRIGGER "trg_kb_articles_search_vector" BEFORE INSERT OR UPDATE OF "title", "summary", "body_md", "tags" ON "public"."kb_articles" FOR EACH ROW EXECUTE FUNCTION "public"."kb_articles_refresh_search_vector"();



CREATE OR REPLACE TRIGGER "trg_kb_articles_updated_at" BEFORE UPDATE ON "public"."kb_articles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_kb_documents_updated_at" BEFORE UPDATE ON "public"."kb_documents" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_mpl_leads_updated_at" BEFORE UPDATE ON "public"."mpl_leads" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_mpl_prefs_updated_at" BEFORE UPDATE ON "public"."mpl_prefs" FOR EACH ROW EXECUTE FUNCTION "public"."mpl_set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_mpl_rss_sources_updated_at" BEFORE UPDATE ON "public"."mpl_rss_sources" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_mpl_watch_prefs_updated_at" BEFORE UPDATE ON "public"."mpl_watch_prefs" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_playbook_sections_updated_at" BEFORE UPDATE ON "public"."playbook_sections" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_playbooks_updated_at" BEFORE UPDATE ON "public"."playbooks" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_product_costs_updated_at" BEFORE UPDATE ON "public"."product_costs" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_reg_events_updated_at" BEFORE UPDATE ON "public"."reg_events" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_transport_rates_updated_at" BEFORE UPDATE ON "public"."transport_rates" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_watch_items_updated_at" BEFORE UPDATE ON "public"."watch_items" FOR EACH ROW EXECUTE FUNCTION "public"."watch_items_updated_at"();



CREATE OR REPLACE TRIGGER "trg_watch_sources_updated_at" BEFORE UPDATE ON "public"."watch_sources" FOR EACH ROW EXECUTE FUNCTION "public"."watch_sources_updated_at"();



CREATE OR REPLACE TRIGGER "watch_prefs_updated_at" BEFORE UPDATE ON "public"."watch_prefs" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



ALTER TABLE ONLY "public"."billing_customers"
    ADD CONSTRAINT "billing_customers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."billing_subscriptions"
    ADD CONSTRAINT "billing_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_country_code_fkey" FOREIGN KEY ("country_code") REFERENCES "public"."countries"("code_iso2");



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_secteur_id_fkey" FOREIGN KEY ("secteur_id") REFERENCES "public"."sectors"("id");



ALTER TABLE ONLY "public"."company_profiles"
    ADD CONSTRAINT "company_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."destinations"
    ADD CONSTRAINT "destinations_country_code_fkey" FOREIGN KEY ("country_code") REFERENCES "public"."countries"("code_iso2");



ALTER TABLE ONLY "public"."diagnostic_runs"
    ADD CONSTRAINT "diagnostic_runs_consent_id_fkey" FOREIGN KEY ("consent_id") REFERENCES "public"."user_consents"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."diagnostic_runs"
    ADD CONSTRAINT "diagnostic_runs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."document_chunks"
    ADD CONSTRAINT "document_chunks_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."hs_codes"
    ADD CONSTRAINT "hs_codes_chapter_fkey" FOREIGN KEY ("chapter") REFERENCES "public"."hs_chapters"("chapter");



ALTER TABLE ONLY "public"."invoice_uploads"
    ADD CONSTRAINT "invoice_uploads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."kb_documents"
    ADD CONSTRAINT "kb_documents_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_simulation_id_fkey" FOREIGN KEY ("simulation_id") REFERENCES "public"."simulations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."mpl_rss_items"
    ADD CONSTRAINT "mpl_rss_items_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "public"."mpl_rss_sources"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."playbook_sections"
    ADD CONSTRAINT "playbook_sections_playbook_id_fkey" FOREIGN KEY ("playbook_id") REFERENCES "public"."playbooks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_costs"
    ADD CONSTRAINT "product_costs_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_hs_code_fkey" FOREIGN KEY ("hs_code") REFERENCES "public"."hs_codes"("hs_code");



ALTER TABLE ONLY "public"."reg_events"
    ADD CONSTRAINT "reg_events_source_item_id_fkey" FOREIGN KEY ("source_item_id") REFERENCES "public"."watch_items"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."regulatory_items"
    ADD CONSTRAINT "regulatory_items_feed_id_fkey" FOREIGN KEY ("source_id") REFERENCES "public"."regulatory_feeds"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."regulatory_items"
    ADD CONSTRAINT "regulatory_items_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "public"."regulatory_feeds"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rss_items"
    ADD CONSTRAINT "rss_items_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "public"."rss_sources"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."sales"
    ADD CONSTRAINT "sales_hs_code_fkey" FOREIGN KEY ("hs_code") REFERENCES "public"."hs_codes"("hs_code");



ALTER TABLE ONLY "public"."sales"
    ADD CONSTRAINT "sales_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."sales_invoices"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sales_invoices"
    ADD CONSTRAINT "sales_invoices_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id");



ALTER TABLE ONLY "public"."sales_invoices"
    ADD CONSTRAINT "sales_invoices_destination_country_fkey" FOREIGN KEY ("destination_country") REFERENCES "public"."countries"("code_iso2");



ALTER TABLE ONLY "public"."sales"
    ADD CONSTRAINT "sales_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id");



ALTER TABLE ONLY "public"."sanctions_matches"
    ADD CONSTRAINT "sanctions_matches_matched_entity_id_fkey" FOREIGN KEY ("matched_entity_id") REFERENCES "public"."sanctions_entities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tax_rules_extra"
    ADD CONSTRAINT "tax_rules_extra_country_code_fkey" FOREIGN KEY ("country_code") REFERENCES "public"."countries"("code_iso2");



ALTER TABLE ONLY "public"."tax_rules_extra"
    ADD CONSTRAINT "tax_rules_extra_hs_code_fkey" FOREIGN KEY ("hs_code") REFERENCES "public"."hs_codes"("hs_code");



ALTER TABLE ONLY "public"."trade_flows"
    ADD CONSTRAINT "trade_flows_partner_country_fkey" FOREIGN KEY ("partner_country") REFERENCES "public"."countries"("code_iso2") ON UPDATE CASCADE;



ALTER TABLE ONLY "public"."trade_flows"
    ADD CONSTRAINT "trade_flows_reporter_country_fkey" FOREIGN KEY ("reporter_country") REFERENCES "public"."countries"("code_iso2") ON UPDATE CASCADE;



ALTER TABLE ONLY "public"."transport_rate_lines"
    ADD CONSTRAINT "transport_rate_lines_destination_country_fkey" FOREIGN KEY ("destination_country") REFERENCES "public"."countries"("code_iso2");



ALTER TABLE ONLY "public"."transport_rates"
    ADD CONSTRAINT "transport_rates_destination_id_fkey" FOREIGN KEY ("destination_id") REFERENCES "public"."export_destinations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_consents"
    ADD CONSTRAINT "user_consents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vat_rates"
    ADD CONSTRAINT "vat_rates_country_code_fkey" FOREIGN KEY ("country_code") REFERENCES "public"."countries"("code_iso2");



ALTER TABLE ONLY "public"."watch_digests"
    ADD CONSTRAINT "watch_digests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."watch_items"
    ADD CONSTRAINT "watch_items_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "public"."watch_sources"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."watch_prefs"
    ADD CONSTRAINT "watch_prefs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE "public"."alerts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."billing_customers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "billing_customers_insert_own" ON "public"."billing_customers" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "billing_customers_owner_read" ON "public"."billing_customers" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "billing_customers_owner_update" ON "public"."billing_customers" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "billing_customers_select_own" ON "public"."billing_customers" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "billing_customers_update_own" ON "public"."billing_customers" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."billing_subscriptions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "billing_subscriptions_owner_read" ON "public"."billing_subscriptions" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "billing_subscriptions_select_own" ON "public"."billing_subscriptions" FOR SELECT USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."briefs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "briefs_no_public_insert" ON "public"."briefs" FOR INSERT TO "authenticated", "anon" WITH CHECK (false);



CREATE POLICY "briefs_public_select" ON "public"."briefs" FOR SELECT TO "authenticated", "anon" USING (true);



ALTER TABLE "public"."clients" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."company_profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_profiles_owner" ON "public"."company_profiles" USING ((("auth"."role"() = 'service_role'::"text") OR ("auth"."uid"() = "user_id"))) WITH CHECK ((("auth"."role"() = 'service_role'::"text") OR ("auth"."uid"() = "user_id")));



CREATE POLICY "contact_insert_public" ON "public"."contact_requests" FOR INSERT TO "authenticated", "anon" WITH CHECK (("email" ~~ '%@%'::"text"));



CREATE POLICY "contact_no_public_select" ON "public"."contact_requests" FOR SELECT TO "authenticated", "anon" USING (false);



ALTER TABLE "public"."contact_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."countries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."country_notes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."destinations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."diagnostic_runs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "diagnostic_runs_owner" ON "public"."diagnostic_runs" USING ((("auth"."role"() = 'service_role'::"text") OR ("auth"."uid"() = "user_id"))) WITH CHECK ((("auth"."role"() = 'service_role'::"text") OR ("auth"."uid"() = "user_id")));



ALTER TABLE "public"."document_chunks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "document_chunks_admin_delete" ON "public"."document_chunks" FOR DELETE USING (("public"."is_admin"() OR ("auth"."role"() = 'service_role'::"text")));



CREATE POLICY "document_chunks_admin_insert" ON "public"."document_chunks" FOR INSERT WITH CHECK (("public"."is_admin"() OR ("auth"."role"() = 'service_role'::"text")));



CREATE POLICY "document_chunks_admin_update" ON "public"."document_chunks" FOR UPDATE USING (("public"."is_admin"() OR ("auth"."role"() = 'service_role'::"text"))) WITH CHECK (("public"."is_admin"() OR ("auth"."role"() = 'service_role'::"text")));



CREATE POLICY "document_chunks_select_admin" ON "public"."document_chunks" FOR SELECT USING (("public"."is_admin"() OR ("auth"."role"() = 'service_role'::"text")));



ALTER TABLE "public"."documents" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "documents_admin_delete" ON "public"."documents" FOR DELETE USING (("public"."is_admin"() OR ("auth"."role"() = 'service_role'::"text")));



CREATE POLICY "documents_admin_insert" ON "public"."documents" FOR INSERT WITH CHECK (("public"."is_admin"() OR ("auth"."role"() = 'service_role'::"text")));



CREATE POLICY "documents_admin_update" ON "public"."documents" FOR UPDATE USING (("public"."is_admin"() OR ("auth"."role"() = 'service_role'::"text"))) WITH CHECK (("public"."is_admin"() OR ("auth"."role"() = 'service_role'::"text")));



CREATE POLICY "documents_select_admin" ON "public"."documents" FOR SELECT USING (("public"."is_admin"() OR ("auth"."role"() = 'service_role'::"text")));



ALTER TABLE "public"."export_destinations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "export_destinations_admin_delete" ON "public"."export_destinations" FOR DELETE USING (("public"."is_admin"() OR ("auth"."role"() = 'service_role'::"text")));



CREATE POLICY "export_destinations_admin_insert" ON "public"."export_destinations" FOR INSERT WITH CHECK (("public"."is_admin"() OR ("auth"."role"() = 'service_role'::"text")));



CREATE POLICY "export_destinations_admin_update" ON "public"."export_destinations" FOR UPDATE USING (("public"."is_admin"() OR ("auth"."role"() = 'service_role'::"text"))) WITH CHECK (("public"."is_admin"() OR ("auth"."role"() = 'service_role'::"text")));



CREATE POLICY "export_destinations_select" ON "public"."export_destinations" FOR SELECT USING (true);



ALTER TABLE "public"."export_hs_catalog" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "export_hs_catalog_admin_delete" ON "public"."export_hs_catalog" FOR DELETE USING (("public"."is_admin"() OR ("auth"."role"() = 'service_role'::"text")));



CREATE POLICY "export_hs_catalog_admin_insert" ON "public"."export_hs_catalog" FOR INSERT WITH CHECK (("public"."is_admin"() OR ("auth"."role"() = 'service_role'::"text")));



CREATE POLICY "export_hs_catalog_admin_update" ON "public"."export_hs_catalog" FOR UPDATE USING (("public"."is_admin"() OR ("auth"."role"() = 'service_role'::"text"))) WITH CHECK (("public"."is_admin"() OR ("auth"."role"() = 'service_role'::"text")));



CREATE POLICY "export_hs_catalog_select" ON "public"."export_hs_catalog" FOR SELECT USING (true);



ALTER TABLE "public"."export_incoterms" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "export_incoterms_admin_delete" ON "public"."export_incoterms" FOR DELETE USING (("public"."is_admin"() OR ("auth"."role"() = 'service_role'::"text")));



CREATE POLICY "export_incoterms_admin_insert" ON "public"."export_incoterms" FOR INSERT WITH CHECK (("public"."is_admin"() OR ("auth"."role"() = 'service_role'::"text")));



CREATE POLICY "export_incoterms_admin_update" ON "public"."export_incoterms" FOR UPDATE USING (("public"."is_admin"() OR ("auth"."role"() = 'service_role'::"text"))) WITH CHECK (("public"."is_admin"() OR ("auth"."role"() = 'service_role'::"text")));



CREATE POLICY "export_incoterms_select" ON "public"."export_incoterms" FOR SELECT USING (true);



ALTER TABLE "public"."export_simulations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "export_simulations_no_public_select" ON "public"."export_simulations" FOR SELECT TO "authenticated", "anon" USING (false);



ALTER TABLE "public"."hs_chapters" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."hs_codes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."invoice_uploads" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "invoice_uploads_delete_owner" ON "public"."invoice_uploads" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "invoice_uploads_insert_owner" ON "public"."invoice_uploads" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "invoice_uploads_select_owner" ON "public"."invoice_uploads" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "invoice_uploads_update_owner" ON "public"."invoice_uploads" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."kb_articles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "kb_articles_select_enabled" ON "public"."kb_articles" FOR SELECT USING (("enabled" = true));



ALTER TABLE "public"."kb_documents" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "kb_documents_admin_delete" ON "public"."kb_documents" FOR DELETE USING ("public"."is_admin"());



CREATE POLICY "kb_documents_admin_insert" ON "public"."kb_documents" FOR INSERT WITH CHECK ("public"."is_admin"());



CREATE POLICY "kb_documents_admin_update" ON "public"."kb_documents" FOR UPDATE USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "kb_documents_select_enabled_or_admin" ON "public"."kb_documents" FOR SELECT USING ((("enabled" = true) OR "public"."is_admin"()));



ALTER TABLE "public"."leads" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "leads_insert_public" ON "public"."leads" FOR INSERT TO "authenticated", "anon" WITH CHECK ((("consent" = true) AND ("email" ~~ '%@%'::"text")));



CREATE POLICY "leads_no_public_select" ON "public"."leads" FOR SELECT TO "authenticated", "anon" USING (false);



ALTER TABLE "public"."link_previews" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mpl_alerts_raw" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "mpl_alerts_raw_select_anon" ON "public"."mpl_alerts_raw" FOR SELECT TO "anon" USING (true);



ALTER TABLE "public"."mpl_leads" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "mpl_leads_insert_anon" ON "public"."mpl_leads" FOR INSERT TO "anon" WITH CHECK (true);



CREATE POLICY "mpl_leads_select_anon_deny" ON "public"."mpl_leads" FOR SELECT TO "anon" USING (false);



ALTER TABLE "public"."mpl_prefs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "mpl_prefs_anon_deny" ON "public"."mpl_prefs" TO "anon" USING (false) WITH CHECK (false);



ALTER TABLE "public"."mpl_rss_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mpl_rss_sources" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mpl_watch_prefs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "newsletter_insert_public" ON "public"."newsletter_subscribers" FOR INSERT TO "authenticated", "anon" WITH CHECK (("email" ~~ '%@%'::"text"));



CREATE POLICY "newsletter_no_public_select" ON "public"."newsletter_subscribers" FOR SELECT TO "authenticated", "anon" USING (false);



ALTER TABLE "public"."newsletter_subscribers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "newsletter_subscribers_insert" ON "public"."newsletter_subscribers" FOR INSERT WITH CHECK (true);



CREATE POLICY "newsletter_subscribers_select_service_role" ON "public"."newsletter_subscribers" FOR SELECT USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "newsletter_subscribers_update_service_role" ON "public"."newsletter_subscribers" FOR UPDATE USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



ALTER TABLE "public"."notes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notes_insert_all" ON "public"."notes" FOR INSERT WITH CHECK (true);



CREATE POLICY "notes_read_all" ON "public"."notes" FOR SELECT USING (true);



ALTER TABLE "public"."playbook_sections" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "playbook_sections_admin_delete" ON "public"."playbook_sections" FOR DELETE USING (("public"."is_admin"() OR ("auth"."role"() = 'service_role'::"text")));



CREATE POLICY "playbook_sections_admin_insert" ON "public"."playbook_sections" FOR INSERT WITH CHECK (("public"."is_admin"() OR ("auth"."role"() = 'service_role'::"text")));



CREATE POLICY "playbook_sections_admin_update" ON "public"."playbook_sections" FOR UPDATE USING (("public"."is_admin"() OR ("auth"."role"() = 'service_role'::"text"))) WITH CHECK (("public"."is_admin"() OR ("auth"."role"() = 'service_role'::"text")));



CREATE POLICY "playbook_sections_select_admin" ON "public"."playbook_sections" FOR SELECT USING (("public"."is_admin"() OR ("auth"."role"() = 'service_role'::"text")));



ALTER TABLE "public"."playbooks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "playbooks_admin_delete" ON "public"."playbooks" FOR DELETE USING (("public"."is_admin"() OR ("auth"."role"() = 'service_role'::"text")));



CREATE POLICY "playbooks_admin_insert" ON "public"."playbooks" FOR INSERT WITH CHECK (("public"."is_admin"() OR ("auth"."role"() = 'service_role'::"text")));



CREATE POLICY "playbooks_admin_update" ON "public"."playbooks" FOR UPDATE USING (("public"."is_admin"() OR ("auth"."role"() = 'service_role'::"text"))) WITH CHECK (("public"."is_admin"() OR ("auth"."role"() = 'service_role'::"text")));



CREATE POLICY "playbooks_select_admin" ON "public"."playbooks" FOR SELECT USING (("public"."is_admin"() OR ("auth"."role"() = 'service_role'::"text")));



ALTER TABLE "public"."pricing_coefficients" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."product_costs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "product_costs_admin_delete" ON "public"."product_costs" FOR DELETE USING (("public"."is_admin"() OR ("auth"."role"() = 'service_role'::"text")));



CREATE POLICY "product_costs_admin_insert" ON "public"."product_costs" FOR INSERT WITH CHECK (("public"."is_admin"() OR ("auth"."role"() = 'service_role'::"text")));



CREATE POLICY "product_costs_admin_update" ON "public"."product_costs" FOR UPDATE USING (("public"."is_admin"() OR ("auth"."role"() = 'service_role'::"text"))) WITH CHECK (("public"."is_admin"() OR ("auth"."role"() = 'service_role'::"text")));



CREATE POLICY "product_costs_select" ON "public"."product_costs" FOR SELECT USING (true);



ALTER TABLE "public"."products" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "public_read_rss_items" ON "public"."mpl_rss_items" FOR SELECT USING (true);



CREATE POLICY "public_read_rss_sources" ON "public"."mpl_rss_sources" FOR SELECT USING (true);



ALTER TABLE "public"."reg_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "reg_events_admin_delete" ON "public"."reg_events" FOR DELETE USING (("public"."is_admin"() OR ("auth"."role"() = 'service_role'::"text")));



CREATE POLICY "reg_events_admin_insert" ON "public"."reg_events" FOR INSERT WITH CHECK (("public"."is_admin"() OR ("auth"."role"() = 'service_role'::"text")));



CREATE POLICY "reg_events_admin_update" ON "public"."reg_events" FOR UPDATE USING (("public"."is_admin"() OR ("auth"."role"() = 'service_role'::"text"))) WITH CHECK (("public"."is_admin"() OR ("auth"."role"() = 'service_role'::"text")));



CREATE POLICY "reg_events_select_admin" ON "public"."reg_events" FOR SELECT USING (("public"."is_admin"() OR ("auth"."role"() = 'service_role'::"text")));



ALTER TABLE "public"."regulatory_feeds" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."regulatory_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "rls_fix_clients_select_auth" ON "public"."clients" FOR SELECT USING ((("auth"."role"() = 'authenticated'::"text") OR ("auth"."role"() = 'service_role'::"text") OR "public"."is_admin"()));



CREATE POLICY "rls_fix_clients_write_auth" ON "public"."clients" USING ((("auth"."role"() = 'authenticated'::"text") OR ("auth"."role"() = 'service_role'::"text") OR "public"."is_admin"())) WITH CHECK ((("auth"."role"() = 'authenticated'::"text") OR ("auth"."role"() = 'service_role'::"text") OR "public"."is_admin"()));



CREATE POLICY "rls_fix_countries_select_public" ON "public"."countries" FOR SELECT USING (true);



CREATE POLICY "rls_fix_countries_write_admin" ON "public"."countries" USING (("public"."is_admin"() OR ("auth"."role"() = 'service_role'::"text"))) WITH CHECK (("public"."is_admin"() OR ("auth"."role"() = 'service_role'::"text")));



CREATE POLICY "rls_fix_destinations_select_public" ON "public"."destinations" FOR SELECT USING (true);



CREATE POLICY "rls_fix_destinations_write_admin" ON "public"."destinations" USING (("public"."is_admin"() OR ("auth"."role"() = 'service_role'::"text"))) WITH CHECK (("public"."is_admin"() OR ("auth"."role"() = 'service_role'::"text")));



CREATE POLICY "rls_fix_hs_chapters_select_public" ON "public"."hs_chapters" FOR SELECT USING (true);



CREATE POLICY "rls_fix_hs_chapters_write_admin" ON "public"."hs_chapters" USING (("public"."is_admin"() OR ("auth"."role"() = 'service_role'::"text"))) WITH CHECK (("public"."is_admin"() OR ("auth"."role"() = 'service_role'::"text")));



CREATE POLICY "rls_fix_link_previews_write_service" ON "public"."link_previews" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "rls_fix_pricing_coefficients_select_auth" ON "public"."pricing_coefficients" FOR SELECT USING ((("auth"."role"() = 'authenticated'::"text") OR ("auth"."role"() = 'service_role'::"text") OR "public"."is_admin"()));



CREATE POLICY "rls_fix_pricing_coefficients_write_admin" ON "public"."pricing_coefficients" USING (("public"."is_admin"() OR ("auth"."role"() = 'service_role'::"text"))) WITH CHECK (("public"."is_admin"() OR ("auth"."role"() = 'service_role'::"text")));



CREATE POLICY "rls_fix_products_select_auth" ON "public"."products" FOR SELECT USING ((("auth"."role"() = 'authenticated'::"text") OR ("auth"."role"() = 'service_role'::"text") OR "public"."is_admin"()));



CREATE POLICY "rls_fix_products_write_auth" ON "public"."products" USING ((("auth"."role"() = 'authenticated'::"text") OR ("auth"."role"() = 'service_role'::"text") OR "public"."is_admin"())) WITH CHECK ((("auth"."role"() = 'authenticated'::"text") OR ("auth"."role"() = 'service_role'::"text") OR "public"."is_admin"()));



CREATE POLICY "rls_fix_regulatory_feeds_select_admin" ON "public"."regulatory_feeds" FOR SELECT USING (("public"."is_admin"() OR ("auth"."role"() = 'service_role'::"text")));



CREATE POLICY "rls_fix_regulatory_feeds_write_service" ON "public"."regulatory_feeds" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "rls_fix_regulatory_items_select_admin" ON "public"."regulatory_items" FOR SELECT USING (("public"."is_admin"() OR ("auth"."role"() = 'service_role'::"text")));



CREATE POLICY "rls_fix_regulatory_items_write_service" ON "public"."regulatory_items" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "rls_fix_sales_invoices_select_auth" ON "public"."sales_invoices" FOR SELECT USING ((("auth"."role"() = 'authenticated'::"text") OR ("auth"."role"() = 'service_role'::"text") OR "public"."is_admin"()));



CREATE POLICY "rls_fix_sales_invoices_write_auth" ON "public"."sales_invoices" USING ((("auth"."role"() = 'authenticated'::"text") OR ("auth"."role"() = 'service_role'::"text") OR "public"."is_admin"())) WITH CHECK ((("auth"."role"() = 'authenticated'::"text") OR ("auth"."role"() = 'service_role'::"text") OR "public"."is_admin"()));



CREATE POLICY "rls_fix_sales_select_auth" ON "public"."sales" FOR SELECT USING ((("auth"."role"() = 'authenticated'::"text") OR ("auth"."role"() = 'service_role'::"text") OR "public"."is_admin"()));



CREATE POLICY "rls_fix_sales_write_auth" ON "public"."sales" USING ((("auth"."role"() = 'authenticated'::"text") OR ("auth"."role"() = 'service_role'::"text") OR "public"."is_admin"())) WITH CHECK ((("auth"."role"() = 'authenticated'::"text") OR ("auth"."role"() = 'service_role'::"text") OR "public"."is_admin"()));



CREATE POLICY "rls_fix_sectors_select_public" ON "public"."sectors" FOR SELECT USING (true);



CREATE POLICY "rls_fix_sectors_write_admin" ON "public"."sectors" USING (("public"."is_admin"() OR ("auth"."role"() = 'service_role'::"text"))) WITH CHECK (("public"."is_admin"() OR ("auth"."role"() = 'service_role'::"text")));



CREATE POLICY "rls_fix_tax_rules_extra_select_auth" ON "public"."tax_rules_extra" FOR SELECT USING ((("auth"."role"() = 'authenticated'::"text") OR ("auth"."role"() = 'service_role'::"text") OR "public"."is_admin"()));



CREATE POLICY "rls_fix_tax_rules_extra_write_admin" ON "public"."tax_rules_extra" USING (("public"."is_admin"() OR ("auth"."role"() = 'service_role'::"text"))) WITH CHECK (("public"."is_admin"() OR ("auth"."role"() = 'service_role'::"text")));



CREATE POLICY "rls_fix_trade_flows_select_auth" ON "public"."trade_flows" FOR SELECT USING ((("auth"."role"() = 'authenticated'::"text") OR ("auth"."role"() = 'service_role'::"text") OR "public"."is_admin"()));



CREATE POLICY "rls_fix_trade_flows_write_admin" ON "public"."trade_flows" USING (("public"."is_admin"() OR ("auth"."role"() = 'service_role'::"text"))) WITH CHECK (("public"."is_admin"() OR ("auth"."role"() = 'service_role'::"text")));



CREATE POLICY "rls_fix_transport_rate_lines_select_auth" ON "public"."transport_rate_lines" FOR SELECT USING ((("auth"."role"() = 'authenticated'::"text") OR ("auth"."role"() = 'service_role'::"text") OR "public"."is_admin"()));



CREATE POLICY "rls_fix_transport_rate_lines_write_admin" ON "public"."transport_rate_lines" USING (("public"."is_admin"() OR ("auth"."role"() = 'service_role'::"text"))) WITH CHECK (("public"."is_admin"() OR ("auth"."role"() = 'service_role'::"text")));



CREATE POLICY "rls_fix_vat_rates_select_auth" ON "public"."vat_rates" FOR SELECT USING ((("auth"."role"() = 'authenticated'::"text") OR ("auth"."role"() = 'service_role'::"text") OR "public"."is_admin"()));



CREATE POLICY "rls_fix_vat_rates_write_admin" ON "public"."vat_rates" USING (("public"."is_admin"() OR ("auth"."role"() = 'service_role'::"text"))) WITH CHECK (("public"."is_admin"() OR ("auth"."role"() = 'service_role'::"text")));



CREATE POLICY "rls_fix_watch_digests_select_owner" ON "public"."watch_digests" FOR SELECT USING ((("auth"."role"() = 'service_role'::"text") OR ("auth"."uid"() = "user_id")));



CREATE POLICY "rls_fix_watch_digests_write_service" ON "public"."watch_digests" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "rls_fix_watch_items_select_admin" ON "public"."watch_items" FOR SELECT USING (("public"."is_admin"() OR ("auth"."role"() = 'service_role'::"text")));



CREATE POLICY "rls_fix_watch_items_write_service" ON "public"."watch_items" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "rls_fix_watch_sources_select_admin" ON "public"."watch_sources" FOR SELECT USING (("public"."is_admin"() OR ("auth"."role"() = 'service_role'::"text")));



CREATE POLICY "rls_fix_watch_sources_write_service" ON "public"."watch_sources" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



ALTER TABLE "public"."rss_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "rss_items_public_select" ON "public"."rss_items" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "rss_no_public_write_items" ON "public"."rss_items" FOR INSERT TO "authenticated", "anon" WITH CHECK (false);



CREATE POLICY "rss_no_public_write_sources" ON "public"."rss_sources" FOR INSERT TO "authenticated", "anon" WITH CHECK (false);



ALTER TABLE "public"."rss_sources" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "rss_sources_public_select" ON "public"."rss_sources" FOR SELECT TO "authenticated", "anon" USING (("enabled" = true));



ALTER TABLE "public"."sales" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sales_invoices" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sectors" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "share_no_public_insert" ON "public"."share_payloads" FOR INSERT TO "authenticated", "anon" WITH CHECK (false);



CREATE POLICY "share_no_public_select" ON "public"."share_payloads" FOR SELECT TO "authenticated", "anon" USING (false);



ALTER TABLE "public"."share_payloads" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."simulations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tax_rules_extra" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."trade_flows" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."transport_rate_lines" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."transport_rates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "transport_rates_admin_delete" ON "public"."transport_rates" FOR DELETE USING (("public"."is_admin"() OR ("auth"."role"() = 'service_role'::"text")));



CREATE POLICY "transport_rates_admin_insert" ON "public"."transport_rates" FOR INSERT WITH CHECK (("public"."is_admin"() OR ("auth"."role"() = 'service_role'::"text")));



CREATE POLICY "transport_rates_admin_update" ON "public"."transport_rates" FOR UPDATE USING (("public"."is_admin"() OR ("auth"."role"() = 'service_role'::"text"))) WITH CHECK (("public"."is_admin"() OR ("auth"."role"() = 'service_role'::"text")));



CREATE POLICY "transport_rates_select" ON "public"."transport_rates" FOR SELECT USING (true);



ALTER TABLE "public"."user_consents" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_consents_owner" ON "public"."user_consents" USING ((("auth"."role"() = 'service_role'::"text") OR ("auth"."uid"() = "user_id"))) WITH CHECK ((("auth"."role"() = 'service_role'::"text") OR ("auth"."uid"() = "user_id")));



ALTER TABLE "public"."vat_rates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."watch_digests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "watch_digests_owner" ON "public"."watch_digests" FOR SELECT USING ((("auth"."role"() = 'service_role'::"text") OR ("auth"."uid"() = "user_id")));



CREATE POLICY "watch_digests_service_role" ON "public"."watch_digests" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



ALTER TABLE "public"."watch_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "watch_items_service_role" ON "public"."watch_items" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



ALTER TABLE "public"."watch_prefs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "watch_prefs_no_public_insert" ON "public"."watch_prefs" FOR INSERT TO "authenticated", "anon" WITH CHECK (false);



CREATE POLICY "watch_prefs_no_public_select" ON "public"."watch_prefs" FOR SELECT TO "authenticated", "anon" USING (false);



CREATE POLICY "watch_prefs_owner" ON "public"."watch_prefs" USING ((("auth"."role"() = 'service_role'::"text") OR ("auth"."uid"() = "user_id"))) WITH CHECK ((("auth"."role"() = 'service_role'::"text") OR ("auth"."uid"() = "user_id")));



ALTER TABLE "public"."watch_sources" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "watch_sources_service_role" ON "public"."watch_sources" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



REVOKE ALL ON FUNCTION "public"."_internal_calcul_exemple"("p_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."_internal_calcul_exemple"("p_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_rss_items"("p_limit" integer, "p_offset" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_rss_items"("p_limit" integer, "p_offset" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_rss_items"("p_limit" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_rss_items"("p_limit" integer, "p_offset" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user_company_profile"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user_company_profile"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user_company_profile"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."hs_codes_set_keywords"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."hs_codes_set_keywords"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."hs_codes_set_keywords"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."kb_articles_refresh_search_vector"() TO "anon";
GRANT ALL ON FUNCTION "public"."kb_articles_refresh_search_vector"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."kb_articles_refresh_search_vector"() TO "service_role";



GRANT ALL ON FUNCTION "public"."kb_search"("q" "text", "lang" "text", "lim" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."kb_search"("q" "text", "lang" "text", "lim" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."kb_search"("q" "text", "lang" "text", "lim" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."mpl_create_share"("p_payload" "jsonb", "p_ttl_hours" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."mpl_create_share"("p_payload" "jsonb", "p_ttl_hours" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."mpl_create_share"("p_payload" "jsonb", "p_ttl_hours" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."mpl_get_alerts"("p_email" "text", "p_limit" integer, "p_offset" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."mpl_get_alerts"("p_email" "text", "p_limit" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."mpl_get_alerts"("p_email" "text", "p_limit" integer, "p_offset" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."mpl_get_rss"("lim" integer, "off" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."mpl_get_rss"("lim" integer, "off" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."mpl_get_rss"("lim" integer, "off" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."mpl_get_share"("p_share_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."mpl_get_share"("p_share_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mpl_get_share"("p_share_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."mpl_insert_lead"("p_email" "extensions"."citext", "p_consent" boolean, "p_simulation_id" "text", "p_metadata" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."mpl_insert_lead"("p_email" "extensions"."citext", "p_consent" boolean, "p_simulation_id" "text", "p_metadata" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mpl_insert_lead"("p_email" "extensions"."citext", "p_consent" boolean, "p_simulation_id" "text", "p_metadata" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."mpl_search_hs"("q" "text", "lim" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."mpl_search_hs"("q" "text", "lim" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."mpl_search_hs"("q" "text", "lim" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."mpl_set_updated_at"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mpl_set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."mpl_set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."mpl_upsert_prefs"("p_email" "extensions"."citext", "p_countries" "text"[], "p_hs_codes" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."mpl_upsert_prefs"("p_email" "extensions"."citext", "p_countries" "text"[], "p_hs_codes" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."mpl_upsert_prefs"("p_email" "extensions"."citext", "p_countries" "text"[], "p_hs_codes" "text"[]) TO "service_role";



REVOKE ALL ON FUNCTION "public"."normalize_email"("p" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."normalize_email"("p" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."normalize_email"("p" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."rpc_calcul_exemple"("p_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rpc_calcul_exemple"("p_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_calcul_exemple"("p_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."rpc_rss_page"("p_limit" integer, "p_offset" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_rss_page"("p_limit" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_rss_page"("p_limit" integer, "p_offset" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."rpc_upsert_lead"("p_email" "text", "p_consent" boolean, "p_simulation_id" "text", "p_metadata" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_upsert_lead"("p_email" "text", "p_consent" boolean, "p_simulation_id" "text", "p_metadata" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_upsert_lead"("p_email" "text", "p_consent" boolean, "p_simulation_id" "text", "p_metadata" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."rpc_upsert_prefs"("p_email" "text", "p_countries" "text"[], "p_hs_codes" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_upsert_prefs"("p_email" "text", "p_countries" "text"[], "p_hs_codes" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_upsert_prefs"("p_email" "text", "p_countries" "text"[], "p_hs_codes" "text"[]) TO "service_role";



REVOKE ALL ON FUNCTION "public"."save_simulation"("p_payload" "jsonb", "p_result" "jsonb", "p_email" "text", "p_score" integer, "p_destination_iso2" "text", "p_hs_input" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."save_simulation"("p_payload" "jsonb", "p_result" "jsonb", "p_email" "text", "p_score" integer, "p_destination_iso2" "text", "p_hs_input" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."save_simulation"("p_payload" "jsonb", "p_result" "jsonb", "p_email" "text", "p_score" integer, "p_destination_iso2" "text", "p_hs_input" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."save_simulation"("p_payload" "jsonb", "p_result" "jsonb", "p_email" "text", "p_score" integer, "p_destination_iso2" "text", "p_hs_input" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_updated_at"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."upsert_lead"("p_email" "text", "p_consent" boolean, "p_simulation_id" "uuid", "p_metadata" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."upsert_lead"("p_email" "text", "p_consent" boolean, "p_simulation_id" "uuid", "p_metadata" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."upsert_lead"("p_email" "text", "p_consent" boolean, "p_simulation_id" "uuid", "p_metadata" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."upsert_lead"("p_email" "text", "p_consent" boolean, "p_simulation_id" "uuid", "p_metadata" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."upsert_watch_prefs"("p_email" "text", "p_countries" "text"[], "p_hs_codes" "text"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."upsert_watch_prefs"("p_email" "text", "p_countries" "text"[], "p_hs_codes" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."upsert_watch_prefs"("p_email" "text", "p_countries" "text"[], "p_hs_codes" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."upsert_watch_prefs"("p_email" "text", "p_countries" "text"[], "p_hs_codes" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."watch_items_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."watch_items_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."watch_items_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."watch_sources_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."watch_sources_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."watch_sources_updated_at"() TO "service_role";



GRANT ALL ON TABLE "public"."alerts" TO "anon";
GRANT ALL ON TABLE "public"."alerts" TO "authenticated";
GRANT ALL ON TABLE "public"."alerts" TO "service_role";



GRANT ALL ON TABLE "public"."audit_requests" TO "anon";
GRANT ALL ON TABLE "public"."audit_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_requests" TO "service_role";



GRANT ALL ON TABLE "public"."billing_customers" TO "anon";
GRANT ALL ON TABLE "public"."billing_customers" TO "authenticated";
GRANT ALL ON TABLE "public"."billing_customers" TO "service_role";



GRANT ALL ON TABLE "public"."billing_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."billing_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."billing_subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."briefs" TO "anon";
GRANT ALL ON TABLE "public"."briefs" TO "authenticated";
GRANT ALL ON TABLE "public"."briefs" TO "service_role";



GRANT ALL ON TABLE "public"."change_log" TO "anon";
GRANT ALL ON TABLE "public"."change_log" TO "authenticated";
GRANT ALL ON TABLE "public"."change_log" TO "service_role";



GRANT ALL ON TABLE "public"."clients" TO "anon";
GRANT ALL ON TABLE "public"."clients" TO "authenticated";
GRANT ALL ON TABLE "public"."clients" TO "service_role";



GRANT ALL ON TABLE "public"."company_profiles" TO "anon";
GRANT ALL ON TABLE "public"."company_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."company_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."contact_requests" TO "anon";
GRANT ALL ON TABLE "public"."contact_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."contact_requests" TO "service_role";



GRANT ALL ON TABLE "public"."cost_lines" TO "anon";
GRANT ALL ON TABLE "public"."cost_lines" TO "authenticated";
GRANT ALL ON TABLE "public"."cost_lines" TO "service_role";



GRANT ALL ON TABLE "public"."costs" TO "anon";
GRANT ALL ON TABLE "public"."costs" TO "authenticated";
GRANT ALL ON TABLE "public"."costs" TO "service_role";



GRANT ALL ON TABLE "public"."countries" TO "anon";
GRANT ALL ON TABLE "public"."countries" TO "authenticated";
GRANT ALL ON TABLE "public"."countries" TO "service_role";



GRANT ALL ON TABLE "public"."country_notes" TO "anon";
GRANT ALL ON TABLE "public"."country_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."country_notes" TO "service_role";



GRANT ALL ON TABLE "public"."destinations" TO "anon";
GRANT ALL ON TABLE "public"."destinations" TO "authenticated";
GRANT ALL ON TABLE "public"."destinations" TO "service_role";



GRANT ALL ON TABLE "public"."diagnostic_runs" TO "anon";
GRANT ALL ON TABLE "public"."diagnostic_runs" TO "authenticated";
GRANT ALL ON TABLE "public"."diagnostic_runs" TO "service_role";



GRANT ALL ON TABLE "public"."docs_mock" TO "anon";
GRANT ALL ON TABLE "public"."docs_mock" TO "authenticated";
GRANT ALL ON TABLE "public"."docs_mock" TO "service_role";



GRANT ALL ON TABLE "public"."document_chunks" TO "anon";
GRANT ALL ON TABLE "public"."document_chunks" TO "authenticated";
GRANT ALL ON TABLE "public"."document_chunks" TO "service_role";



GRANT ALL ON TABLE "public"."documents" TO "anon";
GRANT ALL ON TABLE "public"."documents" TO "authenticated";
GRANT ALL ON TABLE "public"."documents" TO "service_role";



GRANT ALL ON TABLE "public"."duty_rate_mock" TO "anon";
GRANT ALL ON TABLE "public"."duty_rate_mock" TO "authenticated";
GRANT ALL ON TABLE "public"."duty_rate_mock" TO "service_role";



GRANT ALL ON TABLE "public"."export_destinations" TO "anon";
GRANT ALL ON TABLE "public"."export_destinations" TO "authenticated";
GRANT ALL ON TABLE "public"."export_destinations" TO "service_role";



GRANT ALL ON TABLE "public"."export_hs_catalog" TO "anon";
GRANT ALL ON TABLE "public"."export_hs_catalog" TO "authenticated";
GRANT ALL ON TABLE "public"."export_hs_catalog" TO "service_role";



GRANT ALL ON TABLE "public"."export_incoterms" TO "anon";
GRANT ALL ON TABLE "public"."export_incoterms" TO "authenticated";
GRANT ALL ON TABLE "public"."export_incoterms" TO "service_role";



GRANT ALL ON TABLE "public"."sales" TO "anon";
GRANT ALL ON TABLE "public"."sales" TO "authenticated";
GRANT ALL ON TABLE "public"."sales" TO "service_role";



GRANT ALL ON TABLE "public"."export_kpi_destinations" TO "anon";
GRANT ALL ON TABLE "public"."export_kpi_destinations" TO "authenticated";
GRANT ALL ON TABLE "public"."export_kpi_destinations" TO "service_role";



GRANT ALL ON TABLE "public"."export_kpi_zones" TO "anon";
GRANT ALL ON TABLE "public"."export_kpi_zones" TO "authenticated";
GRANT ALL ON TABLE "public"."export_kpi_zones" TO "service_role";



GRANT ALL ON TABLE "public"."export_simulations" TO "anon";
GRANT ALL ON TABLE "public"."export_simulations" TO "authenticated";
GRANT ALL ON TABLE "public"."export_simulations" TO "service_role";



GRANT ALL ON TABLE "public"."rss_items" TO "anon";
GRANT ALL ON TABLE "public"."rss_items" TO "authenticated";
GRANT ALL ON TABLE "public"."rss_items" TO "service_role";



GRANT ALL ON TABLE "public"."high_impact_alerts" TO "anon";
GRANT ALL ON TABLE "public"."high_impact_alerts" TO "authenticated";
GRANT ALL ON TABLE "public"."high_impact_alerts" TO "service_role";



GRANT ALL ON TABLE "public"."hs_chapters" TO "anon";
GRANT ALL ON TABLE "public"."hs_chapters" TO "authenticated";
GRANT ALL ON TABLE "public"."hs_chapters" TO "service_role";



GRANT ALL ON TABLE "public"."hs_codes" TO "anon";
GRANT ALL ON TABLE "public"."hs_codes" TO "authenticated";
GRANT ALL ON TABLE "public"."hs_codes" TO "service_role";



GRANT ALL ON TABLE "public"."ingestion_runs" TO "anon";
GRANT ALL ON TABLE "public"."ingestion_runs" TO "authenticated";
GRANT ALL ON TABLE "public"."ingestion_runs" TO "service_role";



GRANT ALL ON TABLE "public"."invoice_uploads" TO "anon";
GRANT ALL ON TABLE "public"."invoice_uploads" TO "authenticated";
GRANT ALL ON TABLE "public"."invoice_uploads" TO "service_role";



GRANT ALL ON TABLE "public"."kb_articles" TO "anon";
GRANT ALL ON TABLE "public"."kb_articles" TO "authenticated";
GRANT ALL ON TABLE "public"."kb_articles" TO "service_role";



GRANT ALL ON TABLE "public"."kb_documents" TO "anon";
GRANT ALL ON TABLE "public"."kb_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."kb_documents" TO "service_role";



GRANT ALL ON TABLE "public"."leads" TO "anon";
GRANT ALL ON TABLE "public"."leads" TO "authenticated";
GRANT ALL ON TABLE "public"."leads" TO "service_role";



GRANT ALL ON TABLE "public"."link_previews" TO "anon";
GRANT ALL ON TABLE "public"."link_previews" TO "authenticated";
GRANT ALL ON TABLE "public"."link_previews" TO "service_role";



GRANT ALL ON TABLE "public"."mpl_alerts_raw" TO "anon";
GRANT ALL ON TABLE "public"."mpl_alerts_raw" TO "authenticated";
GRANT ALL ON TABLE "public"."mpl_alerts_raw" TO "service_role";



GRANT ALL ON TABLE "public"."mpl_alerts" TO "anon";
GRANT ALL ON TABLE "public"."mpl_alerts" TO "authenticated";
GRANT ALL ON TABLE "public"."mpl_alerts" TO "service_role";



GRANT ALL ON TABLE "public"."mpl_leads" TO "anon";
GRANT ALL ON TABLE "public"."mpl_leads" TO "authenticated";
GRANT ALL ON TABLE "public"."mpl_leads" TO "service_role";



GRANT ALL ON TABLE "public"."mpl_prefs" TO "anon";
GRANT ALL ON TABLE "public"."mpl_prefs" TO "authenticated";
GRANT ALL ON TABLE "public"."mpl_prefs" TO "service_role";



GRANT ALL ON TABLE "public"."mpl_rss_items" TO "anon";
GRANT ALL ON TABLE "public"."mpl_rss_items" TO "authenticated";
GRANT ALL ON TABLE "public"."mpl_rss_items" TO "service_role";



GRANT ALL ON TABLE "public"."mpl_rss_sources" TO "anon";
GRANT ALL ON TABLE "public"."mpl_rss_sources" TO "authenticated";
GRANT ALL ON TABLE "public"."mpl_rss_sources" TO "service_role";



GRANT ALL ON TABLE "public"."mpl_watch_prefs" TO "anon";
GRANT ALL ON TABLE "public"."mpl_watch_prefs" TO "authenticated";
GRANT ALL ON TABLE "public"."mpl_watch_prefs" TO "service_role";



GRANT ALL ON TABLE "public"."newsletter_subscribers" TO "anon";
GRANT ALL ON TABLE "public"."newsletter_subscribers" TO "authenticated";
GRANT ALL ON TABLE "public"."newsletter_subscribers" TO "service_role";



GRANT ALL ON TABLE "public"."notes" TO "anon";
GRANT ALL ON TABLE "public"."notes" TO "authenticated";
GRANT ALL ON TABLE "public"."notes" TO "service_role";



GRANT ALL ON TABLE "public"."octroi_mer" TO "anon";
GRANT ALL ON TABLE "public"."octroi_mer" TO "authenticated";
GRANT ALL ON TABLE "public"."octroi_mer" TO "service_role";



GRANT ALL ON TABLE "public"."om_rates" TO "anon";
GRANT ALL ON TABLE "public"."om_rates" TO "authenticated";
GRANT ALL ON TABLE "public"."om_rates" TO "service_role";



GRANT ALL ON TABLE "public"."playbook_sections" TO "anon";
GRANT ALL ON TABLE "public"."playbook_sections" TO "authenticated";
GRANT ALL ON TABLE "public"."playbook_sections" TO "service_role";



GRANT ALL ON TABLE "public"."playbooks" TO "anon";
GRANT ALL ON TABLE "public"."playbooks" TO "authenticated";
GRANT ALL ON TABLE "public"."playbooks" TO "service_role";



GRANT ALL ON TABLE "public"."pricing_coefficients" TO "anon";
GRANT ALL ON TABLE "public"."pricing_coefficients" TO "authenticated";
GRANT ALL ON TABLE "public"."pricing_coefficients" TO "service_role";



GRANT ALL ON TABLE "public"."product_costs" TO "anon";
GRANT ALL ON TABLE "public"."product_costs" TO "authenticated";
GRANT ALL ON TABLE "public"."product_costs" TO "service_role";



GRANT ALL ON TABLE "public"."products" TO "anon";
GRANT ALL ON TABLE "public"."products" TO "authenticated";
GRANT ALL ON TABLE "public"."products" TO "service_role";



GRANT ALL ON TABLE "public"."raw_snapshots" TO "anon";
GRANT ALL ON TABLE "public"."raw_snapshots" TO "authenticated";
GRANT ALL ON TABLE "public"."raw_snapshots" TO "service_role";



GRANT ALL ON TABLE "public"."reg_events" TO "anon";
GRANT ALL ON TABLE "public"."reg_events" TO "authenticated";
GRANT ALL ON TABLE "public"."reg_events" TO "service_role";



GRANT ALL ON TABLE "public"."regulatory_feeds" TO "anon";
GRANT ALL ON TABLE "public"."regulatory_feeds" TO "authenticated";
GRANT ALL ON TABLE "public"."regulatory_feeds" TO "service_role";



GRANT ALL ON TABLE "public"."regulatory_items" TO "anon";
GRANT ALL ON TABLE "public"."regulatory_items" TO "authenticated";
GRANT ALL ON TABLE "public"."regulatory_items" TO "service_role";



GRANT ALL ON TABLE "public"."rss_sources" TO "anon";
GRANT ALL ON TABLE "public"."rss_sources" TO "authenticated";
GRANT ALL ON TABLE "public"."rss_sources" TO "service_role";



GRANT ALL ON TABLE "public"."sales_invoices" TO "anon";
GRANT ALL ON TABLE "public"."sales_invoices" TO "authenticated";
GRANT ALL ON TABLE "public"."sales_invoices" TO "service_role";



GRANT ALL ON TABLE "public"."sales_lines" TO "anon";
GRANT ALL ON TABLE "public"."sales_lines" TO "authenticated";
GRANT ALL ON TABLE "public"."sales_lines" TO "service_role";



GRANT ALL ON TABLE "public"."sanctions_entities" TO "anon";
GRANT ALL ON TABLE "public"."sanctions_entities" TO "authenticated";
GRANT ALL ON TABLE "public"."sanctions_entities" TO "service_role";



GRANT ALL ON TABLE "public"."sanctions_matches" TO "anon";
GRANT ALL ON TABLE "public"."sanctions_matches" TO "authenticated";
GRANT ALL ON TABLE "public"."sanctions_matches" TO "service_role";



GRANT ALL ON TABLE "public"."sectors" TO "anon";
GRANT ALL ON TABLE "public"."sectors" TO "authenticated";
GRANT ALL ON TABLE "public"."sectors" TO "service_role";



GRANT ALL ON TABLE "public"."share_payloads" TO "anon";
GRANT ALL ON TABLE "public"."share_payloads" TO "authenticated";
GRANT ALL ON TABLE "public"."share_payloads" TO "service_role";



GRANT ALL ON TABLE "public"."simulations" TO "anon";
GRANT ALL ON TABLE "public"."simulations" TO "authenticated";
GRANT ALL ON TABLE "public"."simulations" TO "service_role";



GRANT ALL ON TABLE "public"."tax_rules_extra" TO "anon";
GRANT ALL ON TABLE "public"."tax_rules_extra" TO "authenticated";
GRANT ALL ON TABLE "public"."tax_rules_extra" TO "service_role";



GRANT ALL ON TABLE "public"."taxes_om" TO "anon";
GRANT ALL ON TABLE "public"."taxes_om" TO "authenticated";
GRANT ALL ON TABLE "public"."taxes_om" TO "service_role";



GRANT ALL ON TABLE "public"."trade_flows" TO "anon";
GRANT ALL ON TABLE "public"."trade_flows" TO "authenticated";
GRANT ALL ON TABLE "public"."trade_flows" TO "service_role";



GRANT ALL ON TABLE "public"."transport_rate_lines" TO "anon";
GRANT ALL ON TABLE "public"."transport_rate_lines" TO "authenticated";
GRANT ALL ON TABLE "public"."transport_rate_lines" TO "service_role";



GRANT ALL ON TABLE "public"."transport_rates" TO "anon";
GRANT ALL ON TABLE "public"."transport_rates" TO "authenticated";
GRANT ALL ON TABLE "public"."transport_rates" TO "service_role";



GRANT ALL ON TABLE "public"."user_consents" TO "anon";
GRANT ALL ON TABLE "public"."user_consents" TO "authenticated";
GRANT ALL ON TABLE "public"."user_consents" TO "service_role";



GRANT ALL ON TABLE "public"."user_prefs" TO "anon";
GRANT ALL ON TABLE "public"."user_prefs" TO "authenticated";
GRANT ALL ON TABLE "public"."user_prefs" TO "service_role";



GRANT ALL ON TABLE "public"."v_kpi_sales_by_destination" TO "anon";
GRANT ALL ON TABLE "public"."v_kpi_sales_by_destination" TO "authenticated";
GRANT ALL ON TABLE "public"."v_kpi_sales_by_destination" TO "service_role";



GRANT ALL ON TABLE "public"."v_kpi_sales_by_zone" TO "anon";
GRANT ALL ON TABLE "public"."v_kpi_sales_by_zone" TO "authenticated";
GRANT ALL ON TABLE "public"."v_kpi_sales_by_zone" TO "service_role";



GRANT ALL ON TABLE "public"."vat_rate_mock" TO "anon";
GRANT ALL ON TABLE "public"."vat_rate_mock" TO "authenticated";
GRANT ALL ON TABLE "public"."vat_rate_mock" TO "service_role";



GRANT ALL ON TABLE "public"."vat_rates" TO "anon";
GRANT ALL ON TABLE "public"."vat_rates" TO "authenticated";
GRANT ALL ON TABLE "public"."vat_rates" TO "service_role";



GRANT ALL ON TABLE "public"."watch_digests" TO "anon";
GRANT ALL ON TABLE "public"."watch_digests" TO "authenticated";
GRANT ALL ON TABLE "public"."watch_digests" TO "service_role";



GRANT ALL ON TABLE "public"."watch_items" TO "anon";
GRANT ALL ON TABLE "public"."watch_items" TO "authenticated";
GRANT ALL ON TABLE "public"."watch_items" TO "service_role";



GRANT ALL ON TABLE "public"."watch_prefs" TO "anon";
GRANT ALL ON TABLE "public"."watch_prefs" TO "authenticated";
GRANT ALL ON TABLE "public"."watch_prefs" TO "service_role";



GRANT ALL ON TABLE "public"."watch_sources" TO "anon";
GRANT ALL ON TABLE "public"."watch_sources" TO "authenticated";
GRANT ALL ON TABLE "public"."watch_sources" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







