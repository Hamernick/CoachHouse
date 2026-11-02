\set ON_ERROR_STOP on
\ir organization-closure-core-documents-fixture.sql
-- Minimal profile columns used by the actual atomic brand save; the inherited
-- sharing fixture already supplies public_slug and updated_at.
alter table public.organizations add column ein text, add column is_public boolean not null default false,
 add column location_lat double precision, add column location_lng double precision;
\ir ../migrations/20261021200000_private_organization_brand_kits.sql
\ir ../migrations/20261102140000_organization_closure_brand_kits.sql
create function public.fixture_closure_brand_kits() returns void language plpgsql as $$
begin
 -- Atomic brand saves change the public name. Reset the synthetic publication
 -- prerequisite before its inherited helper validates its fixed snapshot.
 delete from public.organization_closure_operations;
 delete from public.organization_closures;
 update public.organizations set profile=jsonb_set(profile,'{name}','"Community table"') where user_id=public.fixture_form_id(1);
 perform public.fixture_closure_core_documents();
 truncate public.organization_brand_kits;
 insert into public.organization_brand_kits(org_id,identity,updated_by)
 select public.fixture_form_id(n),jsonb_build_object('version',1,'revision',public.fixture_form_id(1300+n),
 'draft',jsonb_build_object('name','Original'),'assets','{}'::jsonb),public.fixture_form_id(13)
 from generate_series(1,2) n;
end; $$;
create function public.fixture_brand_save(expected_revision uuid default public.fixture_form_id(1301)) returns boolean language sql as $$
 select public.save_organization_profile_with_brand_kit(user_id,updated_at,expected_revision,
 jsonb_build_object('version',1,'revision',public.fixture_form_id(1311),'draft',jsonb_build_object('name','Edited'),'assets','{}'::jsonb),
 jsonb_build_object('profile',jsonb_set(profile,'{name}','"Edited"')))
 from public.organizations where user_id=public.fixture_form_id(1);
$$;
