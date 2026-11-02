\set ON_ERROR_STOP on
begin;
set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000001';
select public.fixture_closure_project_overviews();
set local role anon;
do $$ begin
 begin perform 1 from public.organization_project_overview_documents; raise exception 'Anonymous overview exposed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role authenticated;
do $$ begin
 if (select count(*) from public.organization_project_overview_documents)<>1 then raise exception 'Owner scope changed'; end if;
 update public.organization_project_overview_documents set document_text='Owner edit';
 if not found then raise exception 'Active owner cannot edit'; end if;
 begin perform public.fixture_overview_save(); raise exception 'Service RPC exposed'; exception when insufficient_privilege then null; end;
end $$;
set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000005';
do $$ begin
 if (select count(*) from public.organization_project_overview_documents)<>1 then raise exception 'Member read missing'; end if;
 update public.organization_project_overview_documents set document_text='Unauthorized';
 if found then raise exception 'Read-only member wrote overview'; end if;
end $$;
set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000014';
do $$ begin
 if exists(select 1 from public.organization_project_overview_documents) then raise exception 'Unrelated identity read overview'; end if;
end $$;
reset role;
set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000001';
select public.fixture_closure_project_overviews();
do $$ declare col text; begin
 foreach col in array array['id','org_id','project_id'] loop
 begin execute format('update public.organization_project_overview_documents set %I=public.fixture_form_id(1499) where org_id=public.fixture_form_id(1)',col);
 raise exception 'Reparent admitted'; exception when insufficient_privilege then if sqlerrm<>'Project overview identity cannot change' then raise; end if; end;
 end loop;
end $$;
savepoint active_save;
set local role service_role;
do $$ begin
 if public.fixture_overview_save()->>'ok'<>'true' or public.fixture_overview_create()->>'ok'<>'true' then raise exception 'Active atomic write failed'; end if;
 if public.fixture_overview_save('2000-01-01Z')->>'code'<>'stale' then raise exception 'Stale project save admitted'; end if;
end $$;
reset role;
do $$ begin
 if (select name from public.organization_projects where id=public.fixture_form_id(1401))<>'Edited'
 or (select document_text from public.organization_project_overview_documents where id=public.fixture_form_id(1411))<>'Edited' then raise exception 'Atomic save diverged'; end if;
end $$;
rollback to active_save;
select public.fixture_closure('request',600,0);
set local role service_role;
do $$ declare command text; begin
 foreach command in array array[
 'insert into public.organization_project_overview_documents(org_id,project_id) values(public.fixture_form_id(1),public.fixture_form_id(1403))',
 'insert into public.organization_project_overview_documents select * from public.organization_project_overview_documents where org_id=public.fixture_form_id(1) on conflict(org_id,project_id) do update set document_text=excluded.document_text',
 'update public.organization_project_overview_documents set document_text=''Changed'' where org_id=public.fixture_form_id(1)',
 'delete from public.organization_project_overview_documents where org_id=public.fixture_form_id(1)',
 'update public.organization_project_overview_documents set created_by=null where org_id=public.fixture_form_id(1)',
 'update public.organization_project_overview_documents set updated_by=null where org_id=public.fixture_form_id(1)',
 'select public.fixture_overview_save()', 'select public.fixture_overview_create()'
 ] loop
 begin execute command; raise exception 'Closing overview effect admitted'; exception when insufficient_privilege then
 if sqlerrm<>'Organization unavailable' then raise; end if; end;
 end loop;
end $$;
reset role;
-- Project deletion cannot bypass the child fence while its organization exists.
do $$ begin
 begin delete from public.organization_projects where id=public.fixture_form_id(1401); raise exception 'Closing project cascade admitted';
 exception when insufficient_privilege then if sqlerrm<>'Organization unavailable' then raise; end if; end;
 if (select name from public.organization_projects where id=public.fixture_form_id(1401))<>'Original'
 or (select count(*) from public.organization_projects)<>3 then raise exception 'Rejected RPC/cascade left effects'; end if;
end $$;
create function public.fixture_counterfeit_overview_cleanup() returns trigger language plpgsql as $$ begin
 update public.organization_project_overview_documents set created_by=null where org_id=public.fixture_form_id(1); return new; end $$;
create temporary table counterfeit_overview_cleanup(n integer);
create trigger counterfeit after insert on counterfeit_overview_cleanup for each row execute function public.fixture_counterfeit_overview_cleanup();
do $$ begin
 begin insert into counterfeit_overview_cleanup values(1); raise exception 'Counterfeit cleanup admitted'; exception when insufficient_privilege then
 if sqlerrm<>'Organization unavailable' then raise; end if; end;
 delete from auth.users where id=public.fixture_form_id(13);
 if (select count(*) from public.organization_project_overview_documents)<>2
 or exists(select 1 from public.organization_project_overview_documents where created_by is not null or updated_by is not null or document_text<>'Original')
 or not exists(select 1 from auth.users where id=public.fixture_form_id(12)) then raise exception 'Account cleanup crossed boundaries'; end if;
 delete from public.organizations where user_id=public.fixture_form_id(2);
 if (select count(*) from public.organization_project_overview_documents)<>1 or not exists(select 1 from auth.users where id=public.fixture_form_id(2)) then raise exception 'Active org cascade crossed identities'; end if;
 perform public.fixture_closure('cancel',601,1);
 if public.read_workspace_page_public('community-table',public.fixture_form_id(10)) is not null
 or exists(select 1 from public.workspace_page_image_grants where org_id=public.fixture_form_id(1)) then raise exception 'Cancel restored publication/grants'; end if;
end $$;
set local role service_role;
select public.fixture_overview_save();
reset role;
savepoint active_cascade;
delete from public.organization_projects where id=public.fixture_form_id(1401);
do $$ begin if exists(select 1 from public.organization_project_overview_documents where id=public.fixture_form_id(1411)) then raise exception 'Active project cascade failed'; end if; end $$;
rollback to active_cascade;
select public.fixture_closure('request',602,2);
update public.organization_closures set requested_at='2000-01-01Z',export_until='2000-01-31Z';
do $$ declare role_name text; begin
 begin delete from public.organization_project_overview_documents where org_id=public.fixture_form_id(1);
 raise exception 'Expiry authorized purge'; exception when insufficient_privilege then if sqlerrm<>'Organization unavailable' then raise; end if; end;
 foreach role_name in array array['anon','authenticated','service_role'] loop
 if has_function_privilege(role_name,'public.guard_project_overview_closure()','EXECUTE')
 or has_function_privilege(role_name,'public.organization_closure_command(uuid,uuid,text,uuid,integer)','EXECUTE') then raise exception 'Private lifecycle authority exposed'; end if;
 end loop;
 if not (select relrowsecurity and relforcerowsecurity from pg_class where oid='public.organization_project_overview_documents'::regclass) then raise exception 'Overview RLS removed'; end if;
end $$;
rollback;
