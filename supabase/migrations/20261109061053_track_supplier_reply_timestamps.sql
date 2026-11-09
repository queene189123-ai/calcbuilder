alter table public.purchase_request_suppliers
  add column if not exists replied_at timestamptz;
