create role service_role bypassrls;
create table auth.users(id uuid primary key);
alter table public.organizations add column updated_at timestamptz not null default clock_timestamp();
create function public.touch_core_document_test_organization() returns trigger language plpgsql as $$ begin new.updated_at=clock_timestamp(); return new; end $$;
create trigger touch_core_document_test_organization before update on public.organizations for each row execute function public.touch_core_document_test_organization();
