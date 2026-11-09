-- Restrict direct quote/document mutations to procurement roles.
-- All company members retain read access; only owner/admin/buyer may write.

drop policy if exists "members can manage supplier quotes" on public.supplier_quotes;
create policy "members can read supplier quotes"
on public.supplier_quotes for select to authenticated
using (private.is_company_member(company_id, (select auth.uid())));
create policy "buyers can insert supplier quotes"
on public.supplier_quotes for insert to authenticated
with check (exists (
  select 1 from public.company_members cm
  where cm.company_id = supplier_quotes.company_id
    and cm.user_id = (select auth.uid())
    and cm.role in ('owner','admin','buyer')
));
create policy "buyers can update supplier quotes"
on public.supplier_quotes for update to authenticated
using (exists (
  select 1 from public.company_members cm
  where cm.company_id = supplier_quotes.company_id
    and cm.user_id = (select auth.uid())
    and cm.role in ('owner','admin','buyer')
))
with check (exists (
  select 1 from public.company_members cm
  where cm.company_id = supplier_quotes.company_id
    and cm.user_id = (select auth.uid())
    and cm.role in ('owner','admin','buyer')
));
create policy "buyers can delete supplier quotes"
on public.supplier_quotes for delete to authenticated
using (exists (
  select 1 from public.company_members cm
  where cm.company_id = supplier_quotes.company_id
    and cm.user_id = (select auth.uid())
    and cm.role in ('owner','admin','buyer')
));

drop policy if exists "members can manage quote items" on public.quote_items;
create policy "members can read quote items"
on public.quote_items for select to authenticated
using (private.is_company_member(company_id, (select auth.uid())));
create policy "buyers can insert quote items"
on public.quote_items for insert to authenticated
with check (exists (
  select 1 from public.company_members cm
  where cm.company_id = quote_items.company_id
    and cm.user_id = (select auth.uid())
    and cm.role in ('owner','admin','buyer')
));
create policy "buyers can update quote items"
on public.quote_items for update to authenticated
using (exists (
  select 1 from public.company_members cm
  where cm.company_id = quote_items.company_id
    and cm.user_id = (select auth.uid())
    and cm.role in ('owner','admin','buyer')
))
with check (exists (
  select 1 from public.company_members cm
  where cm.company_id = quote_items.company_id
    and cm.user_id = (select auth.uid())
    and cm.role in ('owner','admin','buyer')
));
create policy "buyers can delete quote items"
on public.quote_items for delete to authenticated
using (exists (
  select 1 from public.company_members cm
  where cm.company_id = quote_items.company_id
    and cm.user_id = (select auth.uid())
    and cm.role in ('owner','admin','buyer')
));

drop policy if exists "members can manage quote documents" on public.quote_documents;
create policy "members can read quote documents"
on public.quote_documents for select to authenticated
using (private.is_company_member(company_id, (select auth.uid())));
create policy "buyers can insert quote documents"
on public.quote_documents for insert to authenticated
with check (exists (
  select 1 from public.company_members cm
  where cm.company_id = quote_documents.company_id
    and cm.user_id = (select auth.uid())
    and cm.role in ('owner','admin','buyer')
));
create policy "buyers can update quote documents"
on public.quote_documents for update to authenticated
using (exists (
  select 1 from public.company_members cm
  where cm.company_id = quote_documents.company_id
    and cm.user_id = (select auth.uid())
    and cm.role in ('owner','admin','buyer')
))
with check (exists (
  select 1 from public.company_members cm
  where cm.company_id = quote_documents.company_id
    and cm.user_id = (select auth.uid())
    and cm.role in ('owner','admin','buyer')
));
create policy "buyers can delete quote documents"
on public.quote_documents for delete to authenticated
using (exists (
  select 1 from public.company_members cm
  where cm.company_id = quote_documents.company_id
    and cm.user_id = (select auth.uid())
    and cm.role in ('owner','admin','buyer')
));

drop policy if exists "company members can upload quote docs" on storage.objects;
create policy "buyers can upload quote docs"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'quote-documents'
  and exists (
    select 1 from public.company_members cm
    where cm.company_id = ((storage.foldername(name))[1])::uuid
      and cm.user_id = (select auth.uid())
      and cm.role in ('owner','admin','buyer')
  )
);

drop policy if exists "company members can update quote docs" on storage.objects;
create policy "buyers can update quote docs"
on storage.objects for update to authenticated
using (
  bucket_id = 'quote-documents'
  and exists (
    select 1 from public.company_members cm
    where cm.company_id = ((storage.foldername(name))[1])::uuid
      and cm.user_id = (select auth.uid())
      and cm.role in ('owner','admin','buyer')
  )
)
with check (
  bucket_id = 'quote-documents'
  and exists (
    select 1 from public.company_members cm
    where cm.company_id = ((storage.foldername(name))[1])::uuid
      and cm.user_id = (select auth.uid())
      and cm.role in ('owner','admin','buyer')
  )
);

drop policy if exists "company members can delete quote docs" on storage.objects;
create policy "buyers can delete quote docs"
on storage.objects for delete to authenticated
using (
  bucket_id = 'quote-documents'
  and exists (
    select 1 from public.company_members cm
    where cm.company_id = ((storage.foldername(name))[1])::uuid
      and cm.user_id = (select auth.uid())
      and cm.role in ('owner','admin','buyer')
  )
);
