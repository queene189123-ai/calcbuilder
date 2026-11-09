-- Environment-specific bootstrap for a NEW Supabase project.
-- Replace the URL placeholder with that project's HTTPS URL before execution.
-- Do not run this against the existing production project unless intentionally rotating its monitor token.

create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
declare
  monitor_token text := encode(extensions.gen_random_bytes(32), 'hex');
  existing_job_id bigint;
begin
  insert into public.gmail_monitor_config (id, token_hash)
  values (1, encode(extensions.digest(monitor_token, 'sha256'), 'hex'))
  on conflict (id) do update set token_hash = excluded.token_hash;

  perform vault.create_secret(
    monitor_token,
    'snabpro_gmail_monitor_token',
    'Authentication token for scheduled SnabPro Gmail inbox monitoring'
  );

  select jobid into existing_job_id
  from cron.job
  where jobname = 'snabpro-gmail-monitor';

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;

  perform cron.schedule(
    'snabpro-gmail-monitor',
    '*/10 * * * *',
    $job$
      select net.http_post(
        url := '__SUPABASE_PROJECT_URL__/functions/v1/gmail-monitor',
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
