alter table alerts add column if not exists country_iso2 text;
alter table alerts add column if not exists source text;

update alerts
set country_iso2 = coalesce(country_iso2, country)
where country_iso2 is null and country is not null;

update alerts
set source = coalesce(source, type, 'manual')
where source is null;

insert into alerts (type, country_iso2, hs_prefix, title, message, severity, source)
select 'sanctions', 'RU', null, 'Mise a jour sanctions (UE)', 'Verifier les restrictions sur certains pays sensibles.', 'high', 'EU'
where not exists (select 1 from alerts where title = 'Mise a jour sanctions (UE)');

insert into alerts (type, country_iso2, hs_prefix, title, message, severity, source)
select 'taxes', 'US', '3004', 'Evolution taxes import US', 'Certaines lignes HS 3004 impactees par un relevement de droits.', 'medium', 'WITS'
where not exists (select 1 from alerts where title = 'Evolution taxes import US');
