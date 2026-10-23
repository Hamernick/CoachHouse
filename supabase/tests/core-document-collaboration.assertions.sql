\set ON_ERROR_STOP on
begin;
insert into auth.users values('11111111-1111-1111-1111-111111111111'),('22222222-2222-2222-2222-222222222222');
insert into public.organizations(user_id,profile) values('11111111-1111-1111-1111-111111111111','{"name":"Keep this","roadmap":{"sections":[{"id":"mission","content":"Original only copy"}]}}');
set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
set local request.jwt.claim.role = 'authenticated';
update public.organizations set profile=jsonb_set(profile,'{roadmap,sections,0,content}','"New content"') where user_id='11111111-1111-1111-1111-111111111111';
do $$ begin
 if (select count(*) from public.organization_core_document_versions) <> 2 then raise exception 'missing original/version'; end if;
 if not exists(select 1 from public.organization_core_document_versions where content->>'content'='Original only copy' and actor_id is null) then raise exception 'original not recoverable'; end if;
 if not exists(select 1 from public.organization_core_document_versions where content->>'content'='New content' and actor_id='22222222-2222-2222-2222-222222222222') then raise exception 'actor lost'; end if;
end $$;
-- Timestamp-only changes must not consume history.
update public.organizations set profile=jsonb_set(profile,'{roadmap,sections,0,lastUpdated}','"now"');
do $$ begin if (select count(*) from public.organization_core_document_versions)<>2 then raise exception 'non-meaningful version'; end if; end $$;
-- Deletion retains both the old body and a tombstone, and restored body becomes a version.
update public.organizations set profile=jsonb_set(profile,'{roadmap,sections}','[]');
update public.organizations set profile=jsonb_set(profile,'{roadmap,sections}','[{"id":"mission","content":"Original only copy"}]');
do $$ declare stamp timestamptz; ok boolean; begin
 select updated_at into stamp from public.organizations where user_id='11111111-1111-1111-1111-111111111111';
 select public.commit_core_document_session('11111111-1111-1111-1111-111111111111','mission',stamp,null,null,
 '{"generation":"33333333-3333-3333-3333-333333333333","version":0,"document":{"type":"doc"},"steps":[],"section_content":"Original only copy"}',null) into ok;
 if not ok then raise exception 'initialization failed'; end if;
 select public.commit_core_document_session('11111111-1111-1111-1111-111111111111','mission',stamp,null,null,
 '{"generation":"44444444-4444-4444-4444-444444444444","version":0,"document":{},"steps":[],"section_content":"Original only copy"}',null) into ok;
 if ok then raise exception 'concurrent initialization overwrote state'; end if;
 update public.organizations set profile=jsonb_set(profile,'{name}','"Other edit"');
 select public.commit_core_document_session('11111111-1111-1111-1111-111111111111','mission',stamp,'33333333-3333-3333-3333-333333333333',0,
 '{"generation":"33333333-3333-3333-3333-333333333333","version":1,"document":{},"steps":[],"section_content":"Original only copy"}','{}') into ok;
 if ok then raise exception 'stale projection overwrote profile'; end if;
 if (select profile->>'name' from public.organizations) <> 'Other edit' then raise exception 'unrelated field lost'; end if;
 if has_table_privilege('authenticated','public.organization_core_document_versions','select') then raise exception 'history exposed directly'; end if;
 if has_function_privilege('authenticated','public.commit_core_document_session(uuid,text,timestamptz,uuid,integer,jsonb,jsonb)','execute') then raise exception 'untrusted write enabled'; end if;
 if exists(select 1 from pg_class where relname in ('organization_core_document_versions','organization_core_document_sessions','organization_core_document_presence') and not relrowsecurity) then raise exception 'RLS missing'; end if;
end $$;
-- Legacy keyed sections keep the only original copy when converted to arrays.
insert into public.organizations(user_id,profile) values('22222222-2222-2222-2222-222222222222',
 '{"roadmap":{"sections":{"mission_vision_values":{"content":"Legacy only copy"}}}}');
update public.organizations set profile='{"roadmap":{"sections":[{"id":"mission_vision_values","content":"Edited legacy"}]}}'
 where user_id='22222222-2222-2222-2222-222222222222';
do $$ begin
 if not exists(select 1 from public.organization_core_document_versions where org_id='22222222-2222-2222-2222-222222222222' and content->>'content'='Legacy only copy') then raise exception 'legacy content lost'; end if;
end $$;
-- Bounded retention with the latest content retained.
do $$ begin
 for n in 1..150 loop
  update public.organizations set profile=jsonb_set(profile,'{roadmap,sections,0,content}',to_jsonb('Version ' || n))
   where user_id='22222222-2222-2222-2222-222222222222';
 end loop;
 if (select count(*) from public.organization_core_document_versions where org_id='22222222-2222-2222-2222-222222222222') <> 100 then raise exception 'history not bounded'; end if;
 if not exists(select 1 from public.organization_core_document_versions where content->>'content'='Version 150') then raise exception 'latest version pruned'; end if;
end $$;
-- Direct authenticated callers cannot read tenant history or invoke the elevated writer.
set local role authenticated;
do $$ begin
 begin
  perform * from public.organization_core_document_versions;
  raise exception 'private history readable';
 exception when insufficient_privilege then null; end;
 begin
  perform public.commit_core_document_session('11111111-1111-1111-1111-111111111111','mission',now(),null,null,'{}',null);
  raise exception 'private writer executable';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
