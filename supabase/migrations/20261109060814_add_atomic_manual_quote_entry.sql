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
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_supplier_id uuid;
  v_request_id uuid;
  v_request_item_id uuid;
  v_quote_id uuid;
begin
  if v_user_id is null then
    raise exception 'Необходимо войти в СнабПро.';
  end if;
  if not exists (
    select 1 from public.company_members cm
    where cm.company_id = p_company_id
      and cm.user_id = v_user_id
      and cm.role in ('owner','admin','buyer')
  ) then
    raise exception 'Нет прав на добавление коммерческих предложений.';
  end if;
  if nullif(btrim(p_supplier_name),'') is null
     or nullif(btrim(p_material),'') is null
     or nullif(btrim(p_unit),'') is null
     or p_quantity is null or p_quantity <= 0
     or p_unit_price is null or p_unit_price <= 0
     or p_delivery_cost is null or p_delivery_cost < 0
     or p_lead_time_days is null or p_lead_time_days < 0
     or p_currency not in ('RUB','USD','EUR')
     or coalesce(p_vat,'') not in ('','yes','no','top') then
    raise exception 'Проверьте наименование, количество, цену и условия КП.';
  end if;

  select s.id into v_supplier_id
  from public.suppliers s
  where s.company_id = p_company_id
    and lower(btrim(s.name)) = lower(btrim(p_supplier_name))
  order by s.created_at
  limit 1;

  if v_supplier_id is null then
    insert into public.suppliers(company_id,name,email)
    values(p_company_id,btrim(p_supplier_name),nullif(lower(btrim(p_supplier_email)),''))
    returning id into v_supplier_id;
  elsif nullif(lower(btrim(p_supplier_email)),'') is not null then
    update public.suppliers
      set email = coalesce(nullif(email,''),lower(btrim(p_supplier_email)))
    where id = v_supplier_id and company_id = p_company_id;
  end if;

  insert into public.purchase_requests(company_id,title,status,created_by,details)
  values(p_company_id,'КП · '||btrim(p_material),'collecting',v_user_id,
    jsonb_build_object('source','manual_quote_import','created_from','manual_quote_form'))
  returning id into v_request_id;

  insert into public.purchase_request_items(company_id,request_id,description,specification,quantity,unit)
  values(p_company_id,v_request_id,btrim(p_material),
    jsonb_build_object('text',coalesce(p_specification,'')),p_quantity,btrim(p_unit))
  returning id into v_request_item_id;

  insert into public.supplier_quotes(company_id,request_id,supplier_id,currency,delivery_cost,lead_time_days,notes)
  values(p_company_id,v_request_id,v_supplier_id,p_currency,p_delivery_cost,p_lead_time_days,'Добавлено вручную')
  returning id into v_quote_id;

  insert into public.quote_items(company_id,quote_id,request_item_id,description,specification,quantity,unit,unit_price,vat_included,confidence,source_excerpt)
  values(p_company_id,v_quote_id,v_request_item_id,btrim(p_material),
    jsonb_build_object('text',coalesce(p_specification,''),'vat_label',coalesce(p_vat,'')),
    p_quantity,btrim(p_unit),p_unit_price,
    case when p_vat='yes' then true when p_vat in ('no','top') then false else null end,
    1.0,'Ручной ввод');

  return jsonb_build_object('request_id',v_request_id,'supplier_id',v_supplier_id,'quote_id',v_quote_id,'request_item_id',v_request_item_id);
end;
$$;

revoke all on function public.create_manual_quote(uuid,text,text,text,text,numeric,text,numeric,numeric,text,text,integer) from public, anon;
grant execute on function public.create_manual_quote(uuid,text,text,text,text,numeric,text,numeric,numeric,text,text,integer) to authenticated;
