create table if not exists public.gmail_monitor_runs (
  company_id uuid primary key references public.companies(id) on delete cascade,
  last_checked_at timestamptz not null default now(),
  status text not null default 'ok',
  messages_saved integer not null default 0,
  last_error text
);
alter table public.gmail_monitor_runs enable row level security;
