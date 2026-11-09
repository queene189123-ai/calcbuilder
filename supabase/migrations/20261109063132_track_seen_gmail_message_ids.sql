create table if not exists public.gmail_monitor_seen_messages (
  company_id uuid not null references public.companies(id) on delete cascade,
  gmail_message_id text not null,
  checked_at timestamptz not null default now(),
  primary key (company_id, gmail_message_id)
);
alter table public.gmail_monitor_seen_messages enable row level security;
create index if not exists gmail_monitor_seen_checked_idx
  on public.gmail_monitor_seen_messages(company_id, checked_at desc);
insert into public.gmail_monitor_seen_messages(company_id,gmail_message_id,checked_at)
select company_id,gmail_message_id,coalesce(received_at,now())
from public.supplier_email_messages
on conflict (company_id,gmail_message_id) do nothing;
