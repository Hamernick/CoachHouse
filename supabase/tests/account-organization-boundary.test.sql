\set ON_ERROR_STOP on
begin;
select public.fixture_form_publish(0);
select public.fixture_form_command('submit');
do $$ begin
  if not exists(select 1 from pg_constraint where conrelid='public.organizations'::regclass
    and conname='organizations_user_id_fkey' and confdeltype='r' and convalidated) then
    raise exception 'Owner deletion must be restricted by a validated FK';
  end if;
  begin
    delete from auth.users where id=public.fixture_form_id(1);
    raise exception 'Owned login deletion unexpectedly succeeded';
  exception when foreign_key_violation then null; end;
  if not exists(select 1 from auth.users where id=public.fixture_form_id(1))
    or not exists(select 1 from public.organizations where user_id=public.fixture_form_id(1))
    or (select count(*) from public.organization_form_responses) <> 1 then
    raise exception 'Rejected login deletion changed organization or responses';
  end if;
  -- An independent actor can still delete a login with no organization.
  delete from auth.users where id=public.fixture_form_id(12);
  if exists(select 1 from auth.users where id=public.fixture_form_id(12)) then
    raise exception 'Unowned login was not deleted';
  end if;
  if not exists(select 1 from public.organizations where user_id=public.fixture_form_id(2)) then
    raise exception 'Another organization was changed';
  end if;
end $$;
rollback;
