create extension if not exists pg_cron;
create extension if not exists pg_net;

create table if not exists public.gmail_monitor_config (
  id integer primary key check (id = 1),
  token_hash text not null,
  created_at timestamptz not null default now()
);
alter table public.gmail_monitor_config enable row level security;

do $$
declare
  monitor_token text := encode(extensions.gen_random_bytes(32), 'hex');
begin
  insert into public.gmail_monitor_config (id, token_hash)
  values (1, encode(extensions.digest(monitor_token, 'sha256'), 'hex'))
  on conflict (id) do update set token_hash = excluded.token_hash;

  perform vault.create_secret(
    monitor_token,
    'snabpro_gmail_monitor_token',
    'Authentication token for scheduled SnabPro Gmail inbox monitoring'
  );
end $$;

do $$
begin
  perform cron.schedule(
    'snabpro-gmail-monitor',
    '*/10 * * * *',
    $job$
      select net.http_post(
        url := 'https://tdewylpxanviyhdwdnci.supabase.co/functions/v1/gmail-monitor',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-monitor-token',
          (select decrypted_secret from vault.decrypted_secrets where name = 'snabpro_gmail_monitor_token')
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 120000
      );
    $job$
  );
end $$;
