\set ON_ERROR_STOP on
begin;
set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000001';
select public.fixture_closure_external_documents();
set local role authenticated;
set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000005';
do $$ begin
 if (select count(*) from public.organization_external_documents)<>1 then raise exception 'Member reference visibility changed'; end if;
 begin update public.organization_external_documents set name='Unauthorized'; raise exception 'Direct authenticated write admitted'; exception when insufficient_privilege then null; end;
 begin perform * from public.google_drive_connections; raise exception 'Shared credentials exposed'; exception when insufficient_privilege then null; end;
end $$;
set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000006';
do $$ begin
 if exists(select 1 from public.organization_external_documents) then raise exception 'Outsider read references'; end if;
end $$;
reset role;
set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000001';
do $$ declare command text; begin
 foreach command in array array[
 'update public.organization_external_documents set org_id=public.fixture_form_id(2) where id=public.fixture_form_id(1101)',
 'update public.organization_external_documents set id=public.fixture_form_id(1199) where id=public.fixture_form_id(1101)',
 'update public.organization_external_documents set provider=''other'' where id=public.fixture_form_id(1101)',
 'update public.organization_external_documents set provider_file_id=''syntheticReplacement'' where id=public.fixture_form_id(1101)'
 ] loop
 begin execute command; raise exception 'Reference identity changed'; exception when insufficient_privilege then
 if sqlerrm<>'External document identity cannot change' then raise; end if; end;
 end loop;
end $$;
select public.fixture_closure('request',600,0);
set local role service_role;
do $$ declare command text; begin
 foreach command in array array[
 'insert into public.organization_external_documents select * from public.organization_external_documents where org_id=public.fixture_form_id(1) on conflict do nothing',
 'update public.organization_external_documents set name=''Changed'' where org_id=public.fixture_form_id(1)',
 'delete from public.organization_external_documents where org_id=public.fixture_form_id(1)',
 'select public.fixture_external_reattach()',
 'update public.organization_external_documents set status=''needs_reconnect'' where org_id=public.fixture_form_id(1)',
 'update public.organization_external_documents set connection_id=null where org_id=public.fixture_form_id(1)',
 'update public.organization_external_documents set attached_by=null where org_id=public.fixture_form_id(1)'
 ] loop
 begin execute command; raise exception 'Closing reference write admitted'; exception when insufficient_privilege then
 if sqlerrm<>'Organization unavailable' then raise; end if; end;
 end loop;
end $$;
reset role;
-- Nested execution alone cannot impersonate an actual revocation or FK cleanup.
create temporary table external_probe(command text);
create function pg_temp.external_probe() returns trigger language plpgsql as $$ begin execute new.command; return new; end; $$;
create trigger external_probe after insert on external_probe for each row execute function pg_temp.external_probe();
do $$ declare command text; begin
 foreach command in array array[
 'update public.organization_external_documents set status=''needs_reconnect'' where org_id=public.fixture_form_id(1)',
 'update public.organization_external_documents set connection_id=null where org_id=public.fixture_form_id(1)',
 'update public.organization_external_documents set attached_by=null where org_id=public.fixture_form_id(1)'
 ] loop
 begin insert into external_probe values(command); raise exception 'Forged nested cleanup admitted'; exception when insufficient_privilege then
 if sqlerrm<>'Organization unavailable' then raise; end if; end;
 end loop;
 if (select count(*) from public.organization_external_documents)<>2
 or exists(select 1 from public.organization_external_documents where status<>'available' or name<>'External file')
 or (select status from public.google_drive_connections where id=public.fixture_form_id(1110))<>'connected'
 or (select count(*) from public.organization_project_activity_events where metadata->>'source'='organization_external_documents')<>2 then raise exception 'Closure or denied write altered shared state/audit'; end if;
end $$;
-- Explicit shared disconnect still succeeds with a closing organization attached.
set local role service_role;
select public.fixture_drive_disconnect();
reset role;
do $$ begin
 if exists(select 1 from public.organization_external_documents where status<>'needs_reconnect')
 or (select count(*) from public.organization_external_documents)<>2 then raise exception 'Shared disconnect lost references or failed'; end if;
 begin insert into external_probe values('update public.organization_external_documents set status=''needs_reconnect'',name=''Forged'' where org_id=public.fixture_form_id(1)');
 raise exception 'Revocation broadened to metadata edit'; exception when insufficient_privilege then
 if sqlerrm<>'Organization unavailable' then raise; end if; end;
end $$;
set local role service_role;
select public.fixture_drive_reconnect();
update public.organization_external_documents set status='available' where org_id=public.fixture_form_id(2);
reset role;
do $$ begin
 if (select status from public.organization_external_documents where id=public.fixture_form_id(1101))<>'needs_reconnect' then raise exception 'Reconnect restored closing reference'; end if;
 perform public.fixture_closure('cancel',601,1);
 if (select status from public.organization_external_documents where id=public.fixture_form_id(1101))<>'needs_reconnect'
 or public.read_workspace_page_public('community-table',public.fixture_form_id(10)) is not null
 or exists(select 1 from public.workspace_page_image_grants where org_id=public.fixture_form_id(1)) then raise exception 'Cancel restored revoked access/publication'; end if;
end $$;
set local role service_role;
select public.fixture_external_reattach();
reset role;
do $$ begin
 if (select status from public.organization_external_documents where id=public.fixture_form_id(1101))<>'available'
 or (select name from public.organization_external_documents where id=public.fixture_form_id(1101))<>'Reattached' then raise exception 'Explicit reattach failed'; end if;
end $$;
select public.fixture_closure('request',602,2);
set local role service_role;
delete from public.google_drive_connections where id=public.fixture_form_id(1110);
reset role;
do $$ begin
 if exists(select 1 from public.organization_external_documents where connection_id is not null or status<>'needs_reconnect')
 or (select count(*) from public.organization_external_documents)<>2
 or not exists(select 1 from auth.users where id=public.fixture_form_id(12)) then raise exception 'Connection deletion lost references/identity or retained access'; end if;
 -- Attribution cleanup is independent from organization ownership and closure.
 delete from auth.users where id=public.fixture_form_id(13);
 if exists(select 1 from public.organization_external_documents where attached_by is not null)
 or not exists(select 1 from auth.users where id=public.fixture_form_id(12)) then raise exception 'Attribution cleanup failed'; end if;
 delete from public.organizations where user_id=public.fixture_form_id(2);
 if (select count(*) from public.organization_external_documents)<>1
 or not exists(select 1 from auth.users where id=public.fixture_form_id(2)) then raise exception 'Active org cascade crossed boundaries'; end if;
end $$;
update public.organization_closures set requested_at='2000-01-01Z',export_until='2000-01-31Z';
set local role service_role;
do $$ begin
 begin delete from public.organization_external_documents where org_id=public.fixture_form_id(1); raise exception 'Expiry authorized erasure';
 exception when insufficient_privilege then if sqlerrm<>'Organization unavailable' then raise; end if; end;
end $$;
reset role;
do $$ declare role_name text; begin
 foreach role_name in array array['anon','authenticated','service_role'] loop
 if has_function_privilege(role_name,'public.guard_external_document_closure()','EXECUTE')
 or has_function_privilege(role_name,'public.organization_closure_command(uuid,uuid,text,uuid,integer)','EXECUTE') then raise exception 'Private lifecycle authority exposed'; end if;
 end loop;
end $$;
rollback;

-- Actual account deletion owns shared connection cleanup; neither org is erased.
begin;
set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000001';
select public.fixture_closure_external_documents();
select public.fixture_closure('request',600,0);
delete from auth.users where id=public.fixture_form_id(12);
do $$ begin
 if exists(select 1 from public.google_drive_connections)
 or (select count(*) from public.organization_external_documents)<>2
 or exists(select 1 from public.organization_external_documents where connection_id is not null or status<>'needs_reconnect' or name<>'External file')
 or not exists(select 1 from auth.users where id=public.fixture_form_id(13))
 or (select count(*) from public.organizations where user_id in(public.fixture_form_id(1),public.fixture_form_id(2)))<>2 then raise exception 'Account cleanup crossed organizations/attribution'; end if;
end $$;
rollback;
