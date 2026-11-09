alter table public.purchase_request_suppliers
  add column if not exists email_subject text,
  add column if not exists email_body text,
  add column if not exists drafted_at timestamptz not null default now();

create index if not exists purchase_request_suppliers_drafted_idx
  on public.purchase_request_suppliers (company_id, request_id, drafted_at desc);
