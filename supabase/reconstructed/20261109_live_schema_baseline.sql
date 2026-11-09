-- RECONSTRUCTED BASELINE generated from live Supabase schema on 2026-11-09.
-- Not the missing original migrations. Review and test in a disposable Supabase project before use.
-- Requires a standard Supabase project with auth and storage schemas provisioned.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create table public."companies" (
  "id" uuid default gen_random_uuid() not null,
  "name" text not null,
  "created_by" uuid not null,
  "created_at" timestamp with time zone default now() not null,
  "contact_person" text,
  "phone" text,
  "email" text,
  "address" text,
  "inn" text,
  "delivery_notes" text,
  "updated_at" timestamp with time zone default now() not null
);

create table public."company_gmail_connections" (
  "company_id" uuid not null,
  "connected_by" uuid not null,
  "gmail_address" text not null,
  "refresh_token_ciphertext" text not null,
  "scopes" text[] default '{}'::text[] not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

create table public."company_members" (
  "company_id" uuid not null,
  "user_id" uuid not null,
  "role" text default 'buyer'::text not null,
  "created_at" timestamp with time zone default now() not null
);

create table public."gmail_monitor_config" (
  "id" integer not null,
  "token_hash" text not null,
  "created_at" timestamp with time zone default now() not null
);

create table public."gmail_monitor_runs" (
  "company_id" uuid not null,
  "last_checked_at" timestamp with time zone default now() not null,
  "status" text default 'ok'::text not null,
  "messages_saved" integer default 0 not null,
  "last_error" text
);

create table public."gmail_monitor_seen_messages" (
  "company_id" uuid not null,
  "gmail_message_id" text not null,
  "checked_at" timestamp with time zone default now() not null
);

create table public."gmail_oauth_states" (
  "state" text not null,
  "user_id" uuid not null,
  "company_id" uuid not null,
  "expires_at" timestamp with time zone not null,
  "created_at" timestamp with time zone default now() not null
);

create table public."material_folders" (
  "id" uuid default gen_random_uuid() not null,
  "company_id" uuid not null,
  "name" text not null,
  "sort_order" integer default 0 not null,
  "created_at" timestamp with time zone default now() not null
);

create table public."materials" (
  "id" uuid default gen_random_uuid() not null,
  "company_id" uuid not null,
  "name" text not null,
  "category" text,
  "specification" jsonb default '{}'::jsonb not null,
  "unit" text default 'шт.'::text not null,
  "is_active" boolean default true not null,
  "created_by" uuid,
  "created_at" timestamp with time zone default now() not null,
  "last_price" numeric(18,4),
  "folder_name" text default 'Без папки'::text not null
);

create table public."purchase_request_items" (
  "id" uuid default gen_random_uuid() not null,
  "company_id" uuid not null,
  "request_id" uuid not null,
  "material_id" uuid,
  "description" text not null,
  "specification" jsonb default '{}'::jsonb not null,
  "quantity" numeric(18,4) not null,
  "unit" text not null,
  "created_at" timestamp with time zone default now() not null
);

create table public."purchase_request_suppliers" (
  "id" uuid default gen_random_uuid() not null,
  "company_id" uuid not null,
  "request_id" uuid not null,
  "supplier_id" uuid,
  "supplier_email" text not null,
  "subject_token" text not null,
  "status" text default 'draft'::text not null,
  "gmail_message_id" text,
  "sent_at" timestamp with time zone,
  "created_at" timestamp with time zone default now() not null,
  "email_subject" text,
  "email_body" text,
  "drafted_at" timestamp with time zone default now() not null,
  "replied_at" timestamp with time zone
);

create table public."purchase_requests" (
  "id" uuid default gen_random_uuid() not null,
  "company_id" uuid not null,
  "title" text not null,
  "status" text default 'draft'::text not null,
  "created_by" uuid,
  "created_at" timestamp with time zone default now() not null,
  "details" jsonb default '{}'::jsonb not null
);

create table public."quote_documents" (
  "id" uuid default gen_random_uuid() not null,
  "company_id" uuid not null,
  "request_id" uuid,
  "supplier_id" uuid,
  "storage_path" text not null,
  "original_filename" text not null,
  "mime_type" text not null,
  "extraction_status" text default 'uploaded'::text not null,
  "extracted_data" jsonb,
  "extraction_error" text,
  "uploaded_by" uuid,
  "created_at" timestamp with time zone default now() not null
);

create table public."quote_items" (
  "id" uuid default gen_random_uuid() not null,
  "company_id" uuid not null,
  "quote_id" uuid not null,
  "request_item_id" uuid,
  "description" text not null,
  "specification" jsonb default '{}'::jsonb not null,
  "quantity" numeric(18,4),
  "unit" text,
  "unit_price" numeric(18,4),
  "vat_included" boolean,
  "availability" text,
  "confidence" numeric(4,3),
  "source_page" integer,
  "source_excerpt" text,
  "created_at" timestamp with time zone default now() not null
);

create table public."supplier_email_messages" (
  "id" uuid default gen_random_uuid() not null,
  "company_id" uuid not null,
  "gmail_message_id" text not null,
  "supplier_id" uuid,
  "request_id" uuid,
  "from_email" text default ''::text not null,
  "subject" text default ''::text not null,
  "body_text" text default ''::text not null,
  "attachments" jsonb default '[]'::jsonb not null,
  "extracted_data" jsonb default '{}'::jsonb not null,
  "processing_status" text default 'received'::text not null,
  "received_at" timestamp with time zone,
  "created_at" timestamp with time zone default now() not null
);

create table public."supplier_quotes" (
  "id" uuid default gen_random_uuid() not null,
  "company_id" uuid not null,
  "request_id" uuid not null,
  "supplier_id" uuid not null,
  "document_id" uuid,
  "currency" text default 'RUB'::text not null,
  "delivery_cost" numeric(18,2) default 0 not null,
  "lead_time_days" integer,
  "payment_terms" text,
  "notes" text,
  "created_at" timestamp with time zone default now() not null
);

create table public."suppliers" (
  "id" uuid default gen_random_uuid() not null,
  "company_id" uuid not null,
  "name" text not null,
  "email" text,
  "phone" text,
  "categories" text[] default '{}'::text[] not null,
  "region" text,
  "notes" text,
  "created_at" timestamp with time zone default now() not null,
  "contact" text,
  "rating" text,
  "lead_time" text
);

alter table public."companies" add constraint "companies_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE RESTRICT;
alter table public."companies" add constraint "companies_name_check" CHECK (length(TRIM(BOTH FROM name)) > 0);
alter table public."companies" add constraint "companies_pkey" PRIMARY KEY (id);
alter table public."company_gmail_connections" add constraint "company_gmail_connections_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public."company_gmail_connections" add constraint "company_gmail_connections_connected_by_fkey" FOREIGN KEY (connected_by) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public."company_gmail_connections" add constraint "company_gmail_connections_pkey" PRIMARY KEY (company_id);
alter table public."company_members" add constraint "company_members_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public."company_members" add constraint "company_members_pkey" PRIMARY KEY (company_id, user_id);
alter table public."company_members" add constraint "company_members_role_check" CHECK (role = ANY (ARRAY['owner'::text, 'admin'::text, 'buyer'::text, 'viewer'::text]));
alter table public."company_members" add constraint "company_members_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public."gmail_monitor_config" add constraint "gmail_monitor_config_id_check" CHECK (id = 1);
alter table public."gmail_monitor_config" add constraint "gmail_monitor_config_pkey" PRIMARY KEY (id);
alter table public."gmail_monitor_runs" add constraint "gmail_monitor_runs_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public."gmail_monitor_runs" add constraint "gmail_monitor_runs_pkey" PRIMARY KEY (company_id);
alter table public."gmail_monitor_seen_messages" add constraint "gmail_monitor_seen_messages_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public."gmail_monitor_seen_messages" add constraint "gmail_monitor_seen_messages_pkey" PRIMARY KEY (company_id, gmail_message_id);
alter table public."gmail_oauth_states" add constraint "gmail_oauth_states_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public."gmail_oauth_states" add constraint "gmail_oauth_states_pkey" PRIMARY KEY (state);
alter table public."gmail_oauth_states" add constraint "gmail_oauth_states_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public."material_folders" add constraint "material_folders_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public."material_folders" add constraint "material_folders_company_id_name_key" UNIQUE (company_id, name);
alter table public."material_folders" add constraint "material_folders_name_check" CHECK (length(TRIM(BOTH FROM name)) >= 1 AND length(TRIM(BOTH FROM name)) <= 80);
alter table public."material_folders" add constraint "material_folders_pkey" PRIMARY KEY (id);
alter table public."materials" add constraint "materials_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public."materials" add constraint "materials_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public."materials" add constraint "materials_id_company_id_key" UNIQUE (id, company_id);
alter table public."materials" add constraint "materials_last_price_check" CHECK (last_price IS NULL OR last_price >= 0::numeric);
alter table public."materials" add constraint "materials_pkey" PRIMARY KEY (id);
alter table public."purchase_request_items" add constraint "purchase_request_items_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public."purchase_request_items" add constraint "purchase_request_items_id_company_id_key" UNIQUE (id, company_id);
alter table public."purchase_request_items" add constraint "purchase_request_items_material_id_company_id_fkey" FOREIGN KEY (material_id, company_id) REFERENCES materials(id, company_id) ON DELETE SET NULL;
alter table public."purchase_request_items" add constraint "purchase_request_items_pkey" PRIMARY KEY (id);
alter table public."purchase_request_items" add constraint "purchase_request_items_quantity_check" CHECK (quantity > 0::numeric);
alter table public."purchase_request_items" add constraint "purchase_request_items_request_id_company_id_fkey" FOREIGN KEY (request_id, company_id) REFERENCES purchase_requests(id, company_id) ON DELETE CASCADE;
alter table public."purchase_request_suppliers" add constraint "purchase_request_suppliers_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public."purchase_request_suppliers" add constraint "purchase_request_suppliers_company_id_request_id_supplier_e_key" UNIQUE (company_id, request_id, supplier_email);
alter table public."purchase_request_suppliers" add constraint "purchase_request_suppliers_company_id_subject_token_key" UNIQUE (company_id, subject_token);
alter table public."purchase_request_suppliers" add constraint "purchase_request_suppliers_pkey" PRIMARY KEY (id);
alter table public."purchase_request_suppliers" add constraint "purchase_request_suppliers_request_id_fkey" FOREIGN KEY (request_id) REFERENCES purchase_requests(id) ON DELETE CASCADE;
alter table public."purchase_request_suppliers" add constraint "purchase_request_suppliers_supplier_id_fkey" FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL;
alter table public."purchase_requests" add constraint "purchase_requests_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public."purchase_requests" add constraint "purchase_requests_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public."purchase_requests" add constraint "purchase_requests_id_company_id_key" UNIQUE (id, company_id);
alter table public."purchase_requests" add constraint "purchase_requests_pkey" PRIMARY KEY (id);
alter table public."purchase_requests" add constraint "purchase_requests_status_check" CHECK (status = ANY (ARRAY['draft'::text, 'sent'::text, 'collecting'::text, 'completed'::text, 'cancelled'::text]));
alter table public."quote_documents" add constraint "quote_documents_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public."quote_documents" add constraint "quote_documents_extraction_status_check" CHECK (extraction_status = ANY (ARRAY['uploaded'::text, 'processing'::text, 'review'::text, 'approved'::text, 'failed'::text]));
alter table public."quote_documents" add constraint "quote_documents_id_company_id_key" UNIQUE (id, company_id);
alter table public."quote_documents" add constraint "quote_documents_pkey" PRIMARY KEY (id);
alter table public."quote_documents" add constraint "quote_documents_request_id_company_id_fkey" FOREIGN KEY (request_id, company_id) REFERENCES purchase_requests(id, company_id) ON DELETE SET NULL (request_id);
alter table public."quote_documents" add constraint "quote_documents_supplier_id_company_id_fkey" FOREIGN KEY (supplier_id, company_id) REFERENCES suppliers(id, company_id) ON DELETE SET NULL (supplier_id);
alter table public."quote_documents" add constraint "quote_documents_uploaded_by_fkey" FOREIGN KEY (uploaded_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public."quote_items" add constraint "quote_items_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public."quote_items" add constraint "quote_items_confidence_check" CHECK (confidence IS NULL OR confidence >= 0::numeric AND confidence <= 1::numeric);
alter table public."quote_items" add constraint "quote_items_pkey" PRIMARY KEY (id);
alter table public."quote_items" add constraint "quote_items_quote_id_company_id_fkey" FOREIGN KEY (quote_id, company_id) REFERENCES supplier_quotes(id, company_id) ON DELETE CASCADE;
alter table public."quote_items" add constraint "quote_items_request_item_id_company_id_fkey" FOREIGN KEY (request_item_id, company_id) REFERENCES purchase_request_items(id, company_id) ON DELETE SET NULL (request_item_id);
alter table public."quote_items" add constraint "quote_items_unit_price_check" CHECK (unit_price IS NULL OR unit_price >= 0::numeric);
alter table public."supplier_email_messages" add constraint "supplier_email_messages_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public."supplier_email_messages" add constraint "supplier_email_messages_company_id_gmail_message_id_key" UNIQUE (company_id, gmail_message_id);
alter table public."supplier_email_messages" add constraint "supplier_email_messages_pkey" PRIMARY KEY (id);
alter table public."supplier_email_messages" add constraint "supplier_email_messages_processing_status_check" CHECK (processing_status = ANY (ARRAY['received'::text, 'parsed'::text, 'needs_review'::text, 'error'::text]));
alter table public."supplier_email_messages" add constraint "supplier_email_messages_request_id_fkey" FOREIGN KEY (request_id) REFERENCES purchase_requests(id) ON DELETE SET NULL;
alter table public."supplier_email_messages" add constraint "supplier_email_messages_supplier_id_fkey" FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL;
alter table public."supplier_quotes" add constraint "supplier_quotes_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public."supplier_quotes" add constraint "supplier_quotes_delivery_cost_check" CHECK (delivery_cost >= 0::numeric);
alter table public."supplier_quotes" add constraint "supplier_quotes_document_id_company_id_fkey" FOREIGN KEY (document_id, company_id) REFERENCES quote_documents(id, company_id) ON DELETE SET NULL (document_id);
alter table public."supplier_quotes" add constraint "supplier_quotes_id_company_id_key" UNIQUE (id, company_id);
alter table public."supplier_quotes" add constraint "supplier_quotes_lead_time_days_check" CHECK (lead_time_days IS NULL OR lead_time_days >= 0);
alter table public."supplier_quotes" add constraint "supplier_quotes_pkey" PRIMARY KEY (id);
alter table public."supplier_quotes" add constraint "supplier_quotes_request_id_company_id_fkey" FOREIGN KEY (request_id, company_id) REFERENCES purchase_requests(id, company_id) ON DELETE CASCADE;
alter table public."supplier_quotes" add constraint "supplier_quotes_supplier_id_company_id_fkey" FOREIGN KEY (supplier_id, company_id) REFERENCES suppliers(id, company_id) ON DELETE RESTRICT;
alter table public."suppliers" add constraint "suppliers_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public."suppliers" add constraint "suppliers_id_company_id_key" UNIQUE (id, company_id);
alter table public."suppliers" add constraint "suppliers_pkey" PRIMARY KEY (id);

CREATE INDEX companies_created_by_idx ON public.companies USING btree (created_by);
CREATE INDEX company_gmail_connections_connected_by_idx ON public.company_gmail_connections USING btree (connected_by);
CREATE INDEX company_members_user_id_idx ON public.company_members USING btree (user_id);
CREATE INDEX gmail_monitor_seen_checked_idx ON public.gmail_monitor_seen_messages USING btree (company_id, checked_at DESC);
CREATE INDEX gmail_oauth_states_company_id_idx ON public.gmail_oauth_states USING btree (company_id);
CREATE INDEX gmail_oauth_states_user_id_idx ON public.gmail_oauth_states USING btree (user_id);
CREATE INDEX material_folders_company_sort_idx ON public.material_folders USING btree (company_id, sort_order, name);
CREATE INDEX materials_company_idx ON public.materials USING btree (company_id);
CREATE INDEX materials_created_by_idx ON public.materials USING btree (created_by);
CREATE INDEX purchase_request_items_company_idx ON public.purchase_request_items USING btree (company_id);
CREATE INDEX purchase_request_items_material_company_idx ON public.purchase_request_items USING btree (material_id, company_id);
CREATE INDEX purchase_request_items_request_company_idx ON public.purchase_request_items USING btree (request_id, company_id);
CREATE INDEX purchase_request_suppliers_drafted_idx ON public.purchase_request_suppliers USING btree (company_id, request_id, drafted_at DESC);
CREATE INDEX purchase_request_suppliers_email_idx ON public.purchase_request_suppliers USING btree (company_id, lower(supplier_email));
CREATE INDEX purchase_request_suppliers_request_id_idx ON public.purchase_request_suppliers USING btree (request_id);
CREATE INDEX purchase_request_suppliers_request_idx ON public.purchase_request_suppliers USING btree (company_id, request_id);
CREATE INDEX purchase_request_suppliers_supplier_id_idx ON public.purchase_request_suppliers USING btree (supplier_id);
CREATE INDEX purchase_requests_company_idx ON public.purchase_requests USING btree (company_id);
CREATE INDEX purchase_requests_created_by_idx ON public.purchase_requests USING btree (created_by);
CREATE INDEX quote_documents_company_idx ON public.quote_documents USING btree (company_id);
CREATE INDEX quote_documents_request_company_idx ON public.quote_documents USING btree (request_id, company_id);
CREATE INDEX quote_documents_supplier_company_idx ON public.quote_documents USING btree (supplier_id, company_id);
CREATE INDEX quote_documents_uploaded_by_idx ON public.quote_documents USING btree (uploaded_by);
CREATE INDEX quote_items_company_idx ON public.quote_items USING btree (company_id);
CREATE INDEX quote_items_quote_company_idx ON public.quote_items USING btree (quote_id, company_id);
CREATE INDEX quote_items_request_item_company_idx ON public.quote_items USING btree (request_item_id, company_id);
CREATE INDEX supplier_email_messages_company_received_idx ON public.supplier_email_messages USING btree (company_id, received_at DESC);
CREATE INDEX supplier_email_messages_request_id_idx ON public.supplier_email_messages USING btree (request_id);
CREATE INDEX supplier_email_messages_supplier_id_fk_idx ON public.supplier_email_messages USING btree (supplier_id);
CREATE INDEX supplier_email_messages_supplier_idx ON public.supplier_email_messages USING btree (company_id, supplier_id);
CREATE INDEX supplier_quotes_company_idx ON public.supplier_quotes USING btree (company_id);
CREATE INDEX supplier_quotes_document_company_idx ON public.supplier_quotes USING btree (document_id, company_id);
CREATE INDEX supplier_quotes_request_company_idx ON public.supplier_quotes USING btree (request_id, company_id);
CREATE INDEX supplier_quotes_supplier_company_idx ON public.supplier_quotes USING btree (supplier_id, company_id);
CREATE INDEX suppliers_company_idx ON public.suppliers USING btree (company_id);

CREATE OR REPLACE FUNCTION private.add_company_creator_as_owner()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  insert into public.company_members(company_id, user_id, role)
  values (new.id, new.created_by, 'owner');
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION private.create_company_for_current_user(p_name text)
 RETURNS SETOF companies
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_name text := nullif(btrim(p_name), '');
begin
  if v_user_id is null then
    raise exception 'Необходимо войти в аккаунт.';
  end if;
  if v_name is null then
    raise exception 'Введите название предприятия.';
  end if;
  if length(v_name) > 160 then
    raise exception 'Название предприятия слишком длинное.';
  end if;

  return query
    insert into public.companies(name, created_by)
    values (v_name, v_user_id)
    returning *;
end;
$function$;

CREATE OR REPLACE FUNCTION private.create_manual_quote(p_company_id uuid, p_supplier_name text, p_supplier_email text, p_material text, p_specification text, p_quantity numeric, p_unit text, p_unit_price numeric, p_delivery_cost numeric, p_currency text, p_vat text, p_lead_time_days integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION private.is_company_member(p_company_id uuid, p_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select p_user_id = (select auth.uid())
     and exists (
       select 1
       from public.company_members m
       where m.company_id = p_company_id
         and m.user_id = (select auth.uid())
     );
$function$;

CREATE OR REPLACE FUNCTION public.create_company_for_current_user(p_name text)
 RETURNS SETOF companies
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  select * from private.create_company_for_current_user(p_name);
$function$;

CREATE OR REPLACE FUNCTION public.create_manual_quote(p_company_id uuid, p_supplier_name text, p_supplier_email text, p_material text, p_specification text, p_quantity numeric, p_unit text, p_unit_price numeric, p_delivery_cost numeric, p_currency text, p_vat text, p_lead_time_days integer)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  select private.create_manual_quote(
    p_company_id, p_supplier_name, p_supplier_email, p_material,
    p_specification, p_quantity, p_unit, p_unit_price, p_delivery_cost,
    p_currency, p_vat, p_lead_time_days
  );
$function$;

CREATE TRIGGER add_company_creator_as_owner AFTER INSERT ON companies FOR EACH ROW EXECUTE FUNCTION private.add_company_creator_as_owner();

alter table public."companies" enable row level security;
alter table public."company_gmail_connections" enable row level security;
alter table public."company_members" enable row level security;
alter table public."gmail_monitor_config" enable row level security;
alter table public."gmail_monitor_runs" enable row level security;
alter table public."gmail_monitor_seen_messages" enable row level security;
alter table public."gmail_oauth_states" enable row level security;
alter table public."material_folders" enable row level security;
alter table public."materials" enable row level security;
alter table public."purchase_request_items" enable row level security;
alter table public."purchase_request_suppliers" enable row level security;
alter table public."purchase_requests" enable row level security;
alter table public."quote_documents" enable row level security;
alter table public."quote_items" enable row level security;
alter table public."supplier_email_messages" enable row level security;
alter table public."supplier_quotes" enable row level security;
alter table public."suppliers" enable row level security;

create policy "members can read own companies" on "public"."companies" for SELECT to "authenticated" using (private.is_company_member(id, ( SELECT auth.uid() AS uid)));
create policy "members can update own companies" on "public"."companies" for UPDATE to "authenticated" using (private.is_company_member(id, ( SELECT auth.uid() AS uid))) with check (private.is_company_member(id, ( SELECT auth.uid() AS uid)));
create policy "users can create company" on "public"."companies" for INSERT to "authenticated" with check ((created_by = ( SELECT auth.uid() AS uid)));
create policy "deny_client_access_company_gmail_connections" on "public"."company_gmail_connections" for ALL to "anon", "authenticated" using (false) with check (false);
create policy "users can read own memberships" on "public"."company_members" for SELECT to "authenticated" using ((user_id = ( SELECT auth.uid() AS uid)));
create policy "deny_client_access_gmail_monitor_config" on "public"."gmail_monitor_config" for ALL to "anon", "authenticated" using (false) with check (false);
create policy "deny_client_access_gmail_monitor_runs" on "public"."gmail_monitor_runs" for ALL to "anon", "authenticated" using (false) with check (false);
create policy "deny_client_access_gmail_monitor_seen_messages" on "public"."gmail_monitor_seen_messages" for ALL to "anon", "authenticated" using (false) with check (false);
create policy "deny_client_access_gmail_oauth_states" on "public"."gmail_oauth_states" for ALL to "anon", "authenticated" using (false) with check (false);
create policy "members can manage material folders" on "public"."material_folders" for ALL to "authenticated" using (private.is_company_member(company_id, ( SELECT auth.uid() AS uid))) with check (private.is_company_member(company_id, ( SELECT auth.uid() AS uid)));
create policy "members can manage materials" on "public"."materials" for ALL to "authenticated" using (private.is_company_member(company_id, ( SELECT auth.uid() AS uid))) with check (private.is_company_member(company_id, ( SELECT auth.uid() AS uid)));
create policy "members can manage request items" on "public"."purchase_request_items" for ALL to "authenticated" using (private.is_company_member(company_id, ( SELECT auth.uid() AS uid))) with check (private.is_company_member(company_id, ( SELECT auth.uid() AS uid)));
create policy "members can manage request suppliers" on "public"."purchase_request_suppliers" for ALL to "authenticated" using (private.is_company_member(company_id, ( SELECT auth.uid() AS uid))) with check (private.is_company_member(company_id, ( SELECT auth.uid() AS uid)));
create policy "members can manage purchase requests" on "public"."purchase_requests" for ALL to "authenticated" using (private.is_company_member(company_id, ( SELECT auth.uid() AS uid))) with check (private.is_company_member(company_id, ( SELECT auth.uid() AS uid)));
create policy "members can manage quote documents" on "public"."quote_documents" for ALL to "authenticated" using (private.is_company_member(company_id, ( SELECT auth.uid() AS uid))) with check (private.is_company_member(company_id, ( SELECT auth.uid() AS uid)));
create policy "members can manage quote items" on "public"."quote_items" for ALL to "authenticated" using (private.is_company_member(company_id, ( SELECT auth.uid() AS uid))) with check (private.is_company_member(company_id, ( SELECT auth.uid() AS uid)));
create policy "deny_client_access_supplier_email_messages" on "public"."supplier_email_messages" for ALL to "anon", "authenticated" using (false) with check (false);
create policy "members can manage supplier quotes" on "public"."supplier_quotes" for ALL to "authenticated" using (private.is_company_member(company_id, ( SELECT auth.uid() AS uid))) with check (private.is_company_member(company_id, ( SELECT auth.uid() AS uid)));
create policy "members can manage suppliers" on "public"."suppliers" for ALL to "authenticated" using (private.is_company_member(company_id, ( SELECT auth.uid() AS uid))) with check (private.is_company_member(company_id, ( SELECT auth.uid() AS uid)));
create policy "company members can delete quote docs" on "storage"."objects" for DELETE to "authenticated" using (((bucket_id = 'quote-documents'::text) AND private.is_company_member(((storage.foldername(name))[1])::uuid, ( SELECT auth.uid() AS uid))));
create policy "company members can read quote docs" on "storage"."objects" for SELECT to "authenticated" using (((bucket_id = 'quote-documents'::text) AND private.is_company_member(((storage.foldername(name))[1])::uuid, ( SELECT auth.uid() AS uid))));
create policy "company members can update quote docs" on "storage"."objects" for UPDATE to "authenticated" using (((bucket_id = 'quote-documents'::text) AND private.is_company_member(((storage.foldername(name))[1])::uuid, ( SELECT auth.uid() AS uid)))) with check (((bucket_id = 'quote-documents'::text) AND private.is_company_member(((storage.foldername(name))[1])::uuid, ( SELECT auth.uid() AS uid))));
create policy "company members can upload quote docs" on "storage"."objects" for INSERT to "authenticated" with check (((bucket_id = 'quote-documents'::text) AND private.is_company_member(((storage.foldername(name))[1])::uuid, ( SELECT auth.uid() AS uid))));

-- Restrict direct quote/document mutations to procurement roles.
-- All company members retain read access; only owner/admin/buyer may write.

drop policy if exists "members can manage supplier quotes" on public.supplier_quotes;
create policy "members can read supplier quotes"
on public.supplier_quotes for select to authenticated
using (private.is_company_member(company_id, (select auth.uid())));
create policy "buyers can insert supplier quotes"
on public.supplier_quotes for insert to authenticated
with check (exists (
  select 1 from public.company_members cm
  where cm.company_id = supplier_quotes.company_id
    and cm.user_id = (select auth.uid())
    and cm.role in ('owner','admin','buyer')
));
create policy "buyers can update supplier quotes"
on public.supplier_quotes for update to authenticated
using (exists (
  select 1 from public.company_members cm
  where cm.company_id = supplier_quotes.company_id
    and cm.user_id = (select auth.uid())
    and cm.role in ('owner','admin','buyer')
))
with check (exists (
  select 1 from public.company_members cm
  where cm.company_id = supplier_quotes.company_id
    and cm.user_id = (select auth.uid())
    and cm.role in ('owner','admin','buyer')
));
create policy "buyers can delete supplier quotes"
on public.supplier_quotes for delete to authenticated
using (exists (
  select 1 from public.company_members cm
  where cm.company_id = supplier_quotes.company_id
    and cm.user_id = (select auth.uid())
    and cm.role in ('owner','admin','buyer')
));

drop policy if exists "members can manage quote items" on public.quote_items;
create policy "members can read quote items"
on public.quote_items for select to authenticated
using (private.is_company_member(company_id, (select auth.uid())));
create policy "buyers can insert quote items"
on public.quote_items for insert to authenticated
with check (exists (
  select 1 from public.company_members cm
  where cm.company_id = quote_items.company_id
    and cm.user_id = (select auth.uid())
    and cm.role in ('owner','admin','buyer')
));
create policy "buyers can update quote items"
on public.quote_items for update to authenticated
using (exists (
  select 1 from public.company_members cm
  where cm.company_id = quote_items.company_id
    and cm.user_id = (select auth.uid())
    and cm.role in ('owner','admin','buyer')
))
with check (exists (
  select 1 from public.company_members cm
  where cm.company_id = quote_items.company_id
    and cm.user_id = (select auth.uid())
    and cm.role in ('owner','admin','buyer')
));
create policy "buyers can delete quote items"
on public.quote_items for delete to authenticated
using (exists (
  select 1 from public.company_members cm
  where cm.company_id = quote_items.company_id
    and cm.user_id = (select auth.uid())
    and cm.role in ('owner','admin','buyer')
));

drop policy if exists "members can manage quote documents" on public.quote_documents;
create policy "members can read quote documents"
on public.quote_documents for select to authenticated
using (private.is_company_member(company_id, (select auth.uid())));
create policy "buyers can insert quote documents"
on public.quote_documents for insert to authenticated
with check (exists (
  select 1 from public.company_members cm
  where cm.company_id = quote_documents.company_id
    and cm.user_id = (select auth.uid())
    and cm.role in ('owner','admin','buyer')
));
create policy "buyers can update quote documents"
on public.quote_documents for update to authenticated
using (exists (
  select 1 from public.company_members cm
  where cm.company_id = quote_documents.company_id
    and cm.user_id = (select auth.uid())
    and cm.role in ('owner','admin','buyer')
))
with check (exists (
  select 1 from public.company_members cm
  where cm.company_id = quote_documents.company_id
    and cm.user_id = (select auth.uid())
    and cm.role in ('owner','admin','buyer')
));
create policy "buyers can delete quote documents"
on public.quote_documents for delete to authenticated
using (exists (
  select 1 from public.company_members cm
  where cm.company_id = quote_documents.company_id
    and cm.user_id = (select auth.uid())
    and cm.role in ('owner','admin','buyer')
));

drop policy if exists "company members can upload quote docs" on storage.objects;
create policy "buyers can upload quote docs"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'quote-documents'
  and exists (
    select 1 from public.company_members cm
    where cm.company_id = ((storage.foldername(name))[1])::uuid
      and cm.user_id = (select auth.uid())
      and cm.role in ('owner','admin','buyer')
  )
);

drop policy if exists "company members can update quote docs" on storage.objects;
create policy "buyers can update quote docs"
on storage.objects for update to authenticated
using (
  bucket_id = 'quote-documents'
  and exists (
    select 1 from public.company_members cm
    where cm.company_id = ((storage.foldername(name))[1])::uuid
      and cm.user_id = (select auth.uid())
      and cm.role in ('owner','admin','buyer')
  )
)
with check (
  bucket_id = 'quote-documents'
  and exists (
    select 1 from public.company_members cm
    where cm.company_id = ((storage.foldername(name))[1])::uuid
      and cm.user_id = (select auth.uid())
      and cm.role in ('owner','admin','buyer')
  )
);

drop policy if exists "company members can delete quote docs" on storage.objects;
create policy "buyers can delete quote docs"
on storage.objects for delete to authenticated
using (
  bucket_id = 'quote-documents'
  and exists (
    select 1 from public.company_members cm
    where cm.company_id = ((storage.foldername(name))[1])::uuid
      and cm.user_id = (select auth.uid())
      and cm.role in ('owner','admin','buyer')
  )
);


insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types) values ('quote-documents','quote-documents',false,20971520,array['application/pdf','application/csv','application/vnd.ms-excel','text/csv','text/plain','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','message/rfc822']::text[]) on conflict (id) do update set name=excluded.name, public=excluded.public, file_size_limit=excluded.file_size_limit, allowed_mime_types=excluded.allowed_mime_types;

-- Runtime grants. Internal Gmail tables remain inaccessible to client roles.
revoke all privileges on all tables in schema public from anon;
revoke all privileges on all sequences in schema public from anon;
revoke all privileges on all functions in schema public from anon;
grant all on all tables in schema public to service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke all on public."company_gmail_connections", public."gmail_oauth_states", public."supplier_email_messages", public."gmail_monitor_config", public."gmail_monitor_runs", public."gmail_monitor_seen_messages" from anon, authenticated;
grant all on public."company_gmail_connections", public."gmail_oauth_states", public."supplier_email_messages", public."gmail_monitor_config", public."gmail_monitor_runs", public."gmail_monitor_seen_messages" to service_role;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
grant execute on all functions in schema private to authenticated;
revoke execute on all functions in schema private from public, anon;
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from anon, authenticated;

-- Keep the trigger-only helper non-callable by application users.
revoke execute on function private.add_company_creator_as_owner() from public, anon, authenticated;
grant execute on function private.is_company_member(uuid, uuid) to authenticated;
grant execute on function private.create_company_for_current_user(text) to authenticated;
grant execute on function private.create_manual_quote(uuid, text, text, text, text, numeric, text, numeric, numeric, text, text, integer) to authenticated;
