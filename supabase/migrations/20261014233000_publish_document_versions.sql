-- Small canonical metadata events only; never publish the large room snapshot.
-- Existing history RLS continues to govern delivery to authenticated clients.
do $$ begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime')
    and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime'
      and schemaname='public' and tablename='document_file_versions') then
    alter publication supabase_realtime add table public.document_file_versions;
  end if;
end $$;
