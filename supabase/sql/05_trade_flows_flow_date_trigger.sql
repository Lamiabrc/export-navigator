create or replace function public.set_trade_flow_date_from_year()
returns trigger
language plpgsql
as $$
begin
  if new.flow_date is null and new.year is not null then
    new.flow_date := make_date(new.year::int, 1, 1);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_trade_flows_flow_date on public.trade_flows;

create trigger trg_trade_flows_flow_date
before insert or update on public.trade_flows
for each row
execute function public.set_trade_flow_date_from_year();
