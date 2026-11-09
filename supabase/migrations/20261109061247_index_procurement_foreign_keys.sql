create index if not exists company_gmail_connections_connected_by_idx on public.company_gmail_connections(connected_by);
create index if not exists gmail_oauth_states_company_id_idx on public.gmail_oauth_states(company_id);
create index if not exists gmail_oauth_states_user_id_idx on public.gmail_oauth_states(user_id);
create index if not exists purchase_request_suppliers_request_id_idx on public.purchase_request_suppliers(request_id);
create index if not exists purchase_request_suppliers_supplier_id_idx on public.purchase_request_suppliers(supplier_id);
create index if not exists supplier_email_messages_request_id_idx on public.supplier_email_messages(request_id);
create index if not exists supplier_email_messages_supplier_id_fk_idx on public.supplier_email_messages(supplier_id);
