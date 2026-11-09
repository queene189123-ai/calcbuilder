-- Read-only parity check for the reconstructed SnabPro baseline.
-- Run only AFTER applying 20261109_live_schema_baseline.sql in a NEW test project.

do $$
declare
  v_tables integer;
  v_columns integer;
  v_constraints integer;
  v_indexes integer;
  v_policies integer;
  v_functions integer;
  v_rls_tables integer;
begin
  select count(*) into v_tables
  from pg_tables where schemaname = 'public';

  select count(*) into v_columns
  from information_schema.columns where table_schema = 'public';

  select count(*) into v_constraints
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  join pg_namespace n on n.oid = t.relnamespace
  where n.nspname = 'public';

  select count(*) into v_indexes
  from pg_indexes where schemaname = 'public';

  select count(*) into v_policies
  from pg_policies where schemaname in ('public', 'storage');

  select count(*) into v_functions
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public', 'private') and p.prokind = 'f';

  select count(*) into v_rls_tables
  from pg_class t
  join pg_namespace n on n.oid = t.relnamespace
  where n.nspname = 'public' and t.relkind = 'r' and t.relrowsecurity;

  if exists (
    with expected(table_name, expected_columns) as (
      values
        ('companies', 11),
        ('company_gmail_connections', 7),
        ('company_members', 4),
        ('gmail_monitor_config', 3),
        ('gmail_monitor_runs', 5),
        ('gmail_monitor_seen_messages', 3),
        ('gmail_oauth_states', 5),
        ('material_folders', 5),
        ('materials', 11),
        ('purchase_request_items', 9),
        ('purchase_request_suppliers', 14),
        ('purchase_requests', 7),
        ('quote_documents', 12),
        ('quote_items', 15),
        ('supplier_email_messages', 13),
        ('supplier_quotes', 11),
        ('suppliers', 12)
    ),
    actual as (
      select table_name, count(*)::integer as actual_columns
      from information_schema.columns
      where table_schema = 'public'
      group by table_name
    )
    select 1
    from expected e
    full outer join actual a using (table_name)
    where e.expected_columns is distinct from a.actual_columns
  ) then raise exception 'Public table/column layout differs from the reconstructed inventory'; end if;

  if v_tables <> 17 then raise exception 'Expected 17 public tables, found %', v_tables; end if;
  if v_columns <> 147 then raise exception 'Expected 147 public columns, found %', v_columns; end if;
  if v_constraints <> 75 then raise exception 'Expected 75 constraints, found %', v_constraints; end if;
  if v_indexes <> 62 then raise exception 'Expected 62 public indexes, found %', v_indexes; end if;
  if v_policies <> 23 then raise exception 'Expected 23 public/storage policies, found %', v_policies; end if;
  if v_functions <> 6 then raise exception 'Expected 6 public/private functions, found %', v_functions; end if;
  if v_rls_tables <> 17 then raise exception 'Expected RLS on all 17 public tables, found %', v_rls_tables; end if;

  if not exists (
    select 1 from storage.buckets
    where id = 'quote-documents' and public = false and file_size_limit = 20971520
  ) then raise exception 'Private quote-documents bucket is missing or has unexpected settings'; end if;

  if to_regprocedure('private.is_company_member(uuid,uuid)') is null
     or to_regprocedure('private.add_company_creator_as_owner()') is null
     or to_regprocedure('private.create_company_for_current_user(text)') is null
     or to_regprocedure('public.create_company_for_current_user(text)') is null
     or to_regprocedure('private.create_manual_quote(uuid,text,text,text,text,numeric,text,numeric,numeric,text,text,integer)') is null
     or to_regprocedure('public.create_manual_quote(uuid,text,text,text,text,numeric,text,numeric,numeric,text,text,integer)') is null
  then raise exception 'One or more expected RPC/helper functions are missing'; end if;

  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
  ) then raise exception 'A SECURITY DEFINER function is exposed in public'; end if;

  if has_function_privilege('anon', 'public.create_company_for_current_user(text)', 'EXECUTE')
     or has_function_privilege('anon', 'public.create_manual_quote(uuid,text,text,text,text,numeric,text,numeric,numeric,text,text,integer)', 'EXECUTE')
     or has_function_privilege('authenticated', 'private.add_company_creator_as_owner()', 'EXECUTE')
  then raise exception 'Unexpected client execution privilege on a protected function'; end if;

  if not has_function_privilege('authenticated', 'public.create_company_for_current_user(text)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.create_manual_quote(uuid,text,text,text,text,numeric,text,numeric,numeric,text,text,integer)', 'EXECUTE')
  then raise exception 'Authenticated users cannot execute the expected public RPC wrappers'; end if;

  if has_table_privilege('anon', 'public.company_gmail_connections', 'SELECT')
     or has_table_privilege('authenticated', 'public.company_gmail_connections', 'SELECT')
     or has_table_privilege('anon', 'public.gmail_oauth_states', 'SELECT')
     or has_table_privilege('authenticated', 'public.gmail_oauth_states', 'SELECT')
     or has_table_privilege('anon', 'public.supplier_email_messages', 'SELECT')
     or has_table_privilege('authenticated', 'public.supplier_email_messages', 'SELECT')
  then raise exception 'A client role has direct SELECT privilege on an internal Gmail table'; end if;

  raise notice 'SnabPro baseline verification passed: 17 tables, 147 columns, 75 constraints, 62 indexes, 23 policies, 6 functions, RLS and protected RPC/storage settings.';
end
$$;
