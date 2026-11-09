do $$
declare r record;
begin
  for r in select tablename from pg_tables where schemaname = 'public' loop
    execute format('revoke all privileges on table public.%I from anon', r.tablename);
  end loop;
  for r in select sequence_name from information_schema.sequences where sequence_schema = 'public' loop
    execute format('revoke all privileges on sequence public.%I from anon', r.sequence_name);
  end loop;
end $$;

revoke all privileges on table
  public.gmail_monitor_config,
  public.gmail_monitor_runs,
  public.gmail_monitor_seen_messages,
  public.company_gmail_connections,
  public.gmail_oauth_states,
  public.supplier_email_messages
from authenticated;

alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated;
