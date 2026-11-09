do $$
declare t text;
begin
  foreach t in array array[
    'company_gmail_connections',
    'gmail_monitor_config',
    'gmail_monitor_runs',
    'gmail_monitor_seen_messages',
    'gmail_oauth_states',
    'supplier_email_messages'
  ] loop
    execute format('drop policy if exists %I on public.%I', 'deny_client_access_' || t, t);
    execute format(
      'create policy %I on public.%I for all to anon, authenticated using (false) with check (false)',
      'deny_client_access_' || t, t
    );
  end loop;
end $$;
