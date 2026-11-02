\set ON_ERROR_STOP on
begin;
select public.fixture_closure_publication();
-- Existing canonical profile CAS shape, with mixed private references.
update public.organizations set profile=profile||'{"org_people":[{"id":"person-a","name":"Joan"}],"brand":{"name":"Community"},"documents":{"core":"private-reference"},"external":"google-file-owned-elsewhere"}'::jsonb
 where user_id=public.fixture_form_id(1) and updated_at='2026-10-16T18:30:00Z';
do $$ declare original jsonb; identities jsonb; command text; role_name text;
begin
 select profile into original from public.organizations where user_id=public.fixture_form_id(1);
 if original#>>'{org_people,0,name}' is distinct from 'Joan' then raise exception 'Active CAS save failed'; end if;
 select jsonb_agg(to_jsonb(u) order by id) into identities from auth.users u;
 perform public.fixture_closure('request',600,0);
 foreach command in array array[
   'update public.organizations set profile=''{}'' where user_id=public.fixture_form_id(1)',
   'update public.organizations set public_slug=''late-publication'' where user_id=public.fixture_form_id(1)',
   'update public.organizations set updated_at=clock_timestamp() where user_id=public.fixture_form_id(1)',
   'delete from public.organizations where user_id=public.fixture_form_id(1)',
   'insert into public.organizations(user_id,profile) values(public.fixture_form_id(1),''{}'') on conflict(user_id) do update set profile=excluded.profile'
 ] loop
   begin execute command; raise exception 'Closing mutation bypass: %',command;
   exception when insufficient_privilege then null; end;
 end loop;
 if (select profile from public.organizations where user_id=public.fixture_form_id(1)) is distinct from original
   or (select count(*) from public.organization_form_responses)<>1
   or (select state from public.organization_closures where org_id=public.fixture_form_id(1))<>'closing' then
   raise exception 'Denied write/deletion changed retained data'; end if;
 -- Shared identity and unrelated organizations remain independent.
 update public.organizations set profile=profile||'{"unrelated":"saved"}' where user_id=public.fixture_form_id(2);
 insert into public.organizations(user_id,profile) values(public.fixture_form_id(11),'{}');
 delete from public.organizations where user_id=public.fixture_form_id(11);
 if (select jsonb_agg(to_jsonb(u) order by id) from auth.users u) is distinct from identities then raise exception 'Identity changed'; end if;
 perform public.fixture_closure('cancel',601,1);
 update public.organizations set profile=profile||'{"afterCancel":true}' where user_id=public.fixture_form_id(1);
 if public.read_workspace_page_public('community-table',public.fixture_form_id(10)) is not null
   or exists(select 1 from public.workspace_page_invitations where page_id=public.fixture_form_id(10) and revoked_at is null) then
   raise exception 'Cancel/save restored publication or grant'; end if;
 begin update public.organizations set user_id=public.fixture_form_id(12) where user_id=public.fixture_form_id(1);
   raise exception 'Owner reparent bypass'; exception when insufficient_privilege then null; end;
 perform public.fixture_closure('request',602,2);
 update public.organization_closures set requested_at=statement_timestamp()-interval '721 hours',export_until=statement_timestamp()-interval '1 hour' where org_id=public.fixture_form_id(1);
 begin delete from public.organizations where user_id=public.fixture_form_id(1);
   raise exception 'Expired closure became a purge permit'; exception when insufficient_privilege then null; end;
 foreach role_name in array array['anon','authenticated','service_role'] loop
   if has_function_privilege(role_name,'public.guard_organization_row_closure()','EXECUTE')
     or has_function_privilege(role_name,'public.organization_closure_command(uuid,uuid,text,uuid,integer)','EXECUTE') then raise exception 'Private function exposed'; end if;
 end loop;
end $$;
-- Prove a permitted service-role write cannot bypass the trigger. Its existing
-- SELECT/UPDATE table grants are from the original fixture, not new production ACLs.
set local role service_role;
do $$ begin
 begin update public.organizations set profile='{}' where user_id='10000000-0000-4000-8000-000000000001';
   raise exception 'Service-role bypass'; exception when insufficient_privilege then
     if sqlerrm<>'Organization unavailable' then raise; end if;
 end;
 update public.organizations set profile=profile||'{"serviceSaved":true}' where user_id='10000000-0000-4000-8000-000000000002';
end $$;
reset role;
rollback;
