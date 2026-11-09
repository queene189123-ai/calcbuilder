alter function public.create_company_for_current_user(text) set schema private;
alter function public.create_manual_quote(
  uuid, text, text, text, text, numeric, text, numeric, numeric, text, text, integer
) set schema private;

revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

revoke all on function private.create_company_for_current_user(text) from public, anon, authenticated;
grant execute on function private.create_company_for_current_user(text) to authenticated;

revoke all on function private.create_manual_quote(
  uuid, text, text, text, text, numeric, text, numeric, numeric, text, text, integer
) from public, anon, authenticated;
grant execute on function private.create_manual_quote(
  uuid, text, text, text, text, numeric, text, numeric, numeric, text, text, integer
) to authenticated;

create or replace function public.create_company_for_current_user(p_name text)
returns setof public.companies
language sql
security invoker
set search_path = ''
as $$
  select * from private.create_company_for_current_user(p_name);
$$;

create or replace function public.create_manual_quote(
  p_company_id uuid,
  p_supplier_name text,
  p_supplier_email text,
  p_material text,
  p_specification text,
  p_quantity numeric,
  p_unit text,
  p_unit_price numeric,
  p_delivery_cost numeric,
  p_currency text,
  p_vat text,
  p_lead_time_days integer
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.create_manual_quote(
    p_company_id, p_supplier_name, p_supplier_email, p_material,
    p_specification, p_quantity, p_unit, p_unit_price, p_delivery_cost,
    p_currency, p_vat, p_lead_time_days
  );
$$;

revoke all on function public.create_company_for_current_user(text) from public, anon;
grant execute on function public.create_company_for_current_user(text) to authenticated;

revoke all on function public.create_manual_quote(
  uuid, text, text, text, text, numeric, text, numeric, numeric, text, text, integer
) from public, anon;
grant execute on function public.create_manual_quote(
  uuid, text, text, text, text, numeric, text, numeric, numeric, text, text, integer
) to authenticated;
