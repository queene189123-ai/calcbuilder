update storage.buckets
set allowed_mime_types = array(
  select distinct x
  from unnest(coalesce(allowed_mime_types, array[]::text[]) || array['text/csv','application/csv']) as x
)
where id = 'quote-documents';
