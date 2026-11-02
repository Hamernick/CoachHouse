\set ON_ERROR_STOP on
\ir organization-closure-private-reads-fixture.sql
\ir ../migrations/20261103010000_organization_closure_storage_mutations.sql
-- Disposable Storage bootstrap models API table privileges; production RLS
-- policies and the new trigger remain actual migration code. No object provider.
grant usage on schema storage to authenticated,service_role;
grant select,insert,update,delete on storage.objects to authenticated,service_role;
create function public.fixture_closure_storage() returns void language plpgsql as $$
begin
 perform public.fixture_closure_private_reads();
 insert into storage.objects(id,bucket_id,name,metadata) values
 (public.fixture_form_id(2601),'org-documents',public.fixture_form_id(1)::text||'/library/cleanup.txt','{}'),
 (public.fixture_form_id(2602),'org-documents',public.fixture_form_id(2)::text||'/library/other.txt','{}'),
 (public.fixture_form_id(2603),'program-media',public.fixture_form_id(3)::text||'/personal.jpg','{}'),
 (public.fixture_form_id(2604),'project-assets','synthetic/1','{}');
end $$;
