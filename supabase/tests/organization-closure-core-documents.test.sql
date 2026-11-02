\set ON_ERROR_STOP on
begin;
set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000001';
select public.fixture_closure_core_documents();
-- Even the organization owner has no direct private-state table/RPC authority.
set local role authenticated;
do $$ declare target text; begin
 foreach target in array array['organization_core_document_versions','organization_core_document_sessions','organization_core_document_presence'] loop
 begin execute format('select * from public.%I',target); raise exception 'Private state exposed'; exception when insufficient_privilege then null; end;
 end loop;
 begin perform public.fixture_core_commit(); raise exception 'Elevated writer exposed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ declare target text; key text; begin
 foreach target in array array['organization_core_document_versions','organization_core_document_sessions','organization_core_document_presence'] loop
 foreach key in array array['org_id','section_id'] loop
 begin
 execute format('update public.%I set %I=%s where org_id=public.fixture_form_id(1)',target,key,
 case when key='org_id' then 'public.fixture_form_id(2)' else '''different-section''' end);
 raise exception 'Core identity changed'; exception when insufficient_privilege then
 if sqlerrm<>'Core document identity cannot change' then raise; end if; end;
 end loop; end loop;
 begin update public.organization_core_document_presence set actor_id=public.fixture_form_id(1) where org_id=public.fixture_form_id(1);
 raise exception 'Presence impersonation admitted'; exception when insufficient_privilege then
 if sqlerrm<>'Core document identity cannot change' then raise; end if; end;
end $$;
savepoint initial_session;
set local role service_role;
do $$ begin
 if not public.fixture_core_initialize() or public.fixture_core_initialize() then raise exception 'Initialization CAS failed'; end if;
 if public.fixture_core_commit(false,99) then raise exception 'Stale session revision admitted'; end if;
 if public.commit_core_document_session(public.fixture_form_id(1),'mission','2000-01-01Z',public.fixture_form_id(1211),0,'{}',null) then raise exception 'Stale organization revision admitted'; end if;
end $$;
reset role;
rollback to initial_session;
select public.fixture_closure('request',600,0);
set local role service_role;
do $$ declare target text; command text; begin
 foreach target in array array['organization_core_document_versions','organization_core_document_sessions','organization_core_document_presence'] loop
 begin execute format('insert into public.%1$I select * from public.%1$I where org_id=public.fixture_form_id(1) on conflict do nothing',target);
 raise exception 'Closing core insert admitted'; exception when insufficient_privilege then
 if sqlerrm<>'Organization unavailable' then raise; end if; end;
 end loop;
 foreach command in array array[
 'update public.organization_core_document_sessions set version=version+1 where org_id=public.fixture_form_id(1)',
 'update public.organization_core_document_presence set mode=''editing'' where org_id=public.fixture_form_id(1)',
 'delete from public.organization_core_document_versions where org_id=public.fixture_form_id(1)',
 'delete from public.organization_core_document_sessions where org_id=public.fixture_form_id(1)',
 'select public.fixture_core_commit()',
 'select public.fixture_core_commit(true)',
 'select public.fixture_core_initialize()'
 ] loop
 begin execute command; raise exception 'Closing core effect admitted'; exception when insufficient_privilege then
 if sqlerrm<>'Organization unavailable' then raise; end if; end;
 end loop;
 -- Optional departure/expiry never becomes a new collaboration admission.
 delete from public.organization_core_document_presence where org_id=public.fixture_form_id(1);
 update public.organization_core_document_sessions set section_content='Other saved' where org_id=public.fixture_form_id(2);
end $$;
reset role;
do $$ begin
 begin update public.organization_core_document_versions set actor_id=null where org_id=public.fixture_form_id(1);
 raise exception 'Manual attribution clearing bypassed closure'; exception when insufficient_privilege then
 if sqlerrm<>'Organization unavailable' then raise; end if; end;
 if (select count(*) from public.organization_core_document_versions)<>2
 or (select profile#>>'{roadmap,sections,0,content}' from public.organizations where user_id=public.fixture_form_id(1))<>'Original'
 or (select version from public.organization_core_document_sessions where org_id=public.fixture_form_id(1))<>0
 or exists(select 1 from public.organization_core_document_presence where org_id=public.fixture_form_id(1)) then raise exception 'Rejected save left effects or leave failed'; end if;
 -- Actual login deletion clears only attribution/presence, retaining both histories.
 delete from auth.users where id=public.fixture_form_id(13);
 if (select count(*) from public.organization_core_document_versions)<>2
 or exists(select 1 from public.organization_core_document_versions where actor_id is not null or content->>'content'<>'Original')
 or exists(select 1 from public.organization_core_document_presence)
 or not exists(select 1 from auth.users where id=public.fixture_form_id(12)) then raise exception 'Account cleanup erased history or another identity'; end if;
 delete from public.organizations where user_id=public.fixture_form_id(2);
 if (select count(*) from public.organization_core_document_versions)<>1
 or (select count(*) from public.organization_core_document_sessions)<>1
 or not exists(select 1 from auth.users where id=public.fixture_form_id(2)) then raise exception 'Active org cascade crossed boundaries'; end if;
 perform public.fixture_closure('cancel',601,1);
 if exists(select 1 from public.organization_core_document_presence)
 or public.read_workspace_page_public('community-table',public.fixture_form_id(10)) is not null
 or exists(select 1 from public.workspace_page_image_grants where org_id=public.fixture_form_id(1)) then raise exception 'Cancel restored presence/publication/grants'; end if;
end $$;
set local role service_role;
do $$ begin
 if not public.fixture_core_commit(false,0) then raise exception 'Session-only retry failed'; end if;
 if (select count(*) from public.organization_core_document_versions)<>1 then raise exception 'Session-only write invented history'; end if;
 if not public.fixture_core_commit(true,1) or public.fixture_core_commit(true,1) then raise exception 'Profile save/revision retry failed'; end if;
end $$;
insert into public.organization_core_document_presence(org_id,section_id,session_id,actor_id,display_name,role)
 values(public.fixture_form_id(1),'mission','synthetic-new',public.fixture_form_id(1),'Owner','owner');
reset role;
do $$ declare org public.organizations; recovered jsonb; begin
 if (select count(*) from public.organization_core_document_versions)<>2
 or (select version from public.organization_core_document_sessions where org_id=public.fixture_form_id(1))<>2
 or (select profile#>>'{roadmap,sections,0,content}' from public.organizations where user_id=public.fixture_form_id(1))<>'Edited' then raise exception 'Profile/session/history save diverged'; end if;
 select * into org from public.organizations where user_id=public.fixture_form_id(1);
 select content into recovered from public.organization_core_document_versions where id=public.fixture_form_id(1201);
 if not public.commit_core_document_session(org.user_id,'mission',org.updated_at,public.fixture_form_id(1211),2,
 jsonb_build_object('generation',public.fixture_form_id(1261),'version',0,'document',jsonb_build_object('type','doc'),'steps','[]'::jsonb,'section_content',recovered->>'content'),
 jsonb_set(org.profile,'{roadmap,sections,0}',recovered)) then raise exception 'Explicit history restore failed'; end if;
 if (select count(*) from public.organization_core_document_versions)<>3
 or (select generation from public.organization_core_document_sessions where org_id=org.user_id)<>public.fixture_form_id(1261)
 or (select profile#>>'{roadmap,sections,0,content}' from public.organizations where user_id=org.user_id)<>'Original'
 or (select profile->>'name' from public.organizations where user_id=org.user_id) is distinct from org.profile->>'name' then raise exception 'Restore lost content or unrelated profile'; end if;
end $$;
-- Existing capture/retention remains usable while active: latest100 plus daily
-- checkpoints within30days, never expired history purged through closing writes.
insert into public.organization_core_document_versions(org_id,section_id,content,created_at)
 select public.fixture_form_id(1),'mission',jsonb_build_object('content','day-'||days),now()-make_interval(days=>days)
 from unnest(array[1,7,40]) days;
do $$ begin
 for n in 1..150 loop
 update public.organizations set profile=jsonb_set(profile,'{roadmap,sections,0,content}',to_jsonb('Version '||n)) where user_id=public.fixture_form_id(1);
 end loop;
 if (select count(*) from public.organization_core_document_versions where org_id=public.fixture_form_id(1))<>102
 or not exists(select 1 from public.organization_core_document_versions where content->>'content'='day-7')
 or exists(select 1 from public.organization_core_document_versions where content->>'content'='day-40')
 or not exists(select 1 from public.organization_core_document_versions where content->>'content'='Version 150') then raise exception 'Active retention boundary changed'; end if;
end $$;
select public.fixture_closure('request',602,2);
update public.organization_closures set requested_at='2000-01-01Z',export_until='2000-01-31Z';
set local role service_role;
do $$ declare target text; begin
 foreach target in array array['organization_core_document_versions','organization_core_document_sessions'] loop
 begin execute format('delete from public.%I where org_id=public.fixture_form_id(1)',target); raise exception 'Expiry authorized history/session purge';
 exception when insufficient_privilege then if sqlerrm<>'Organization unavailable' then raise; end if; end;
 end loop;
 delete from public.organization_core_document_presence where org_id=public.fixture_form_id(1);
end $$;
reset role;
do $$ declare role_name text; begin
 foreach role_name in array array['anon','authenticated','service_role'] loop
 if has_function_privilege(role_name,'public.guard_core_document_closure()','EXECUTE')
 or has_function_privilege(role_name,'public.organization_closure_command(uuid,uuid,text,uuid,integer)','EXECUTE') then raise exception 'Private lifecycle authority exposed'; end if;
 end loop;
 if has_table_privilege('service_role','public.organization_core_document_versions','UPDATE') then raise exception 'History mutation authority broadened'; end if;
end $$;
rollback;
