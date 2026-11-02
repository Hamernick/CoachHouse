\set ON_ERROR_STOP on
begin;
do $$ begin
 if current_setting('coach_house.workspace_sharing_fixture',true) is distinct from 'isolated-test-only' then raise exception 'Fixture required'; end if;
end $$;
insert into public.organization_memberships(org_id,member_id,role) values(public.fixture_form_id(1),public.fixture_form_id(4),'staff') on conflict(org_id,member_id) do update set role='staff';
update public.organization_workspace_boards set state='{}',updated_by=coalesce((select intake_manager from public.organization_forms where org_id=public.fixture_form_id(1) and id=public.fixture_form_id(20)),public.fixture_form_id(1));
truncate public.organization_forms cascade;
delete from public.organization_workspace_pages;
select public.fixture_form_publish(0,'publish',80,4);
select public.fixture_form_command('submit');
create function pg_temp.source(actor integer default 2) returns jsonb language sql as $$
 select public.organization_form_source_command(public.fixture_form_id(actor),jsonb_build_object('action','read_form_source','versionId',public.fixture_form_id(80)));
$$;
create function pg_temp.invite(scope text,op integer) returns void language plpgsql as $$ begin
 perform public.organization_form_viewer_access(public.fixture_form_id(4),jsonb_build_object('action','invite_viewer','versionId',public.fixture_form_id(80),'email','person2@example.org','responsePermission',scope,
 'operationId',public.fixture_form_id(op),'expectedRevision',(select access_revision from public.organization_forms where id=public.fixture_form_id(20))));
end $$;
create function pg_temp.accept(op integer) returns void language sql as $$
 select public.organization_form_viewer_access(public.fixture_form_id(2),jsonb_build_object('action','accept_viewer','versionId',public.fixture_form_id(80),'invitationId',public.fixture_form_id(op)));
$$;
create function pg_temp.save(token text,op integer default 710,title text default 'Updated form') returns jsonb language sql as $$
 select public.organization_form_source_command(public.fixture_form_id(2),jsonb_build_object('action','save_form_source','versionId',public.fixture_form_id(80),'operationId',public.fixture_form_id(op),'expectedRevision',token,
 'content',jsonb_build_object('title',title,'description','Updated description','definition',jsonb_build_object('questions','[{"id":"10000000-0000-4000-8000-000000000090","type":"text","label":"Full name","required":true}]'::jsonb))));
$$;
do $$ begin
 begin perform pg_temp.source(); raise exception 'Ungrantable source'; exception when insufficient_privilege then null; end;
 begin perform pg_temp.source(1); raise exception 'Implicit owner access'; exception when insufficient_privilege then null; end;
 begin perform pg_temp.source(null); raise exception 'Anonymous access'; exception when insufficient_privilege then null; end;
end $$;
select pg_temp.invite('view',700); select pg_temp.accept(700);
do $$ begin
 begin perform pg_temp.source(); raise exception 'View edited source'; exception when insufficient_privilege then null; end;
end $$;
select pg_temp.invite('correct',701); select pg_temp.accept(701);
do $$ begin
 begin perform pg_temp.source(); raise exception 'Correct edited source'; exception when insufficient_privilege then null; end;
end $$;
select pg_temp.invite('edit',702);
do $$ begin
 begin perform pg_temp.source(); raise exception 'Pending editor access'; exception when insufficient_privilege then null; end;
 if public.organization_form_viewer_access(public.fixture_form_id(2),jsonb_build_object('action','viewer_offer','versionId',public.fixture_form_id(80)))->>'responsePermission'<>'edit' then raise exception 'Hidden scope'; end if;
end $$;
select pg_temp.accept(702);
-- Two appearances of the canonical form, distinct layout and unrelated content.
update public.organization_workspace_boards set updated_by=public.fixture_form_id(4), state=state||jsonb_build_object('privateNeighbor','untouched','workspaceCatalog',jsonb_build_object('entries',jsonb_build_array(
 jsonb_build_object('id',public.fixture_form_id(33),'name','Another board','state',jsonb_build_object('layout','keep','particleGraph',state->'particleGraph')))));
do $$ declare source jsonb; saved jsonb; token text; board jsonb; begin
 source:=pg_temp.source(); token:=source->>'revision';
 if source - array['formId','title','description','definition','revision'] <> '{}'::jsonb then raise exception 'Source over-disclosed'; end if;
 if not (public.fixture_form_command('responses',2)#>>'{permissions,canEditDefinition}')::boolean then raise exception 'Editor affordance missing'; end if;
 saved:=pg_temp.save(token);
 if saved<>pg_temp.save(token) then raise exception 'Exact retry not stable'; end if;
 if (select count(*) from public.organization_form_source_operations)<>1 then raise exception 'Duplicate source save'; end if;
 begin perform pg_temp.save(token,710,'Different'); raise exception 'Operation reused'; exception when unique_violation then null; end;
 begin perform pg_temp.save(token,711); raise exception 'Stale source saved'; exception when serialization_failure then null; end;
 select state into board from public.organization_workspace_boards;
 if board->>'privateNeighbor'<>'untouched' or board#>>'{workspaceCatalog,entries,0,state,layout}'<>'keep'
   or board#>>'{particleGraph,particles,0,title}'<>'Updated form' or board#>>'{workspaceCatalog,entries,0,state,particleGraph,particles,0,title}'<>'Updated form'
   or board#>>'{particleGraph,revision}'<>'1' or board#>>'{particleGraph,particles,0,revision}'<>'1' then raise exception 'Canonical propagation or preservation failed'; end if;
 if (select version->>'title' from public.organization_form_versions where id=public.fixture_form_id(80))<>'Sign up'
   or (select published_snapshot#>>'{items,0,title}' from public.organization_workspace_pages where id=public.fixture_form_id(10))<>'Sign up'
   or (select count(*) from public.organization_form_responses)<>1 or exists(select 1 from public.organization_form_corrections) then raise exception 'Published/response state changed'; end if;
 if exists(select 1 from public.organization_memberships where org_id=public.fixture_form_id(1) and member_id=public.fixture_form_id(2)) then raise exception 'Manufactured membership'; end if;
 if has_function_privilege('authenticated','public.organization_form_source_command(uuid,jsonb)','EXECUTE')
   or has_table_privilege('authenticated','public.organization_form_source_operations','SELECT') then raise exception 'Private surface exposed'; end if;
 -- An unrelated board change is preserved without invalidating this source token.
 token:=pg_temp.source()->>'revision';
 update public.organization_workspace_boards set state=jsonb_set(state,'{privateNeighbor}','"new neighbor"'),updated_by=public.fixture_form_id(4);
 perform pg_temp.save(token,712,'Second edit');
 if (select state->>'privateNeighbor' from public.organization_workspace_boards)<>'new neighbor' then raise exception 'Unrelated edit overwritten'; end if;
end $$;
-- Revocation also rejects an exact retry; receipts cannot resurrect authority.
select public.organization_form_viewer_access(public.fixture_form_id(4),jsonb_build_object('action','revoke_viewer','versionId',public.fixture_form_id(80),'operationId',public.fixture_form_id(720),'invitationId',public.fixture_form_id(702),'expectedRevision',7));
do $$ begin
 begin perform pg_temp.source(); raise exception 'Revoked reader'; exception when insufficient_privilege then null; end;
 begin perform pg_temp.save(repeat('a',64)); raise exception 'Revoked writer'; exception when insufficient_privilege then null; end;
end $$;
rollback;
