\set ON_ERROR_STOP on
do $$ begin
  if current_setting('coach_house.workspace_sharing_fixture',true) is distinct from 'isolated-test-only'
    or current_database() not like 'workspace_sharing_fixture_%' then
    raise exception 'Marked isolated sharing fixture required';
  end if;
end $$;
begin;
delete from public.organization_workspace_pages;
create function pg_temp.check_canvas(value boolean) returns void language plpgsql as $$
 begin if value is distinct from true then raise exception 'Canvas assertion failed'; end if; end $$;
create function pg_temp.reject_canvas(command text,expected text) returns void language plpgsql as $$
 declare actual text;
 begin
  begin execute command;
  exception when others then get stacked diagnostics actual=returned_sqlstate;
   if actual=expected then return; end if;
   raise exception 'Expected %, received %: %',expected,actual,sqlerrm;
  end;
  raise exception 'Unexpected canvas operation success';
 end $$;
-- Same item ID in two different graphs proves selection is by exact canvas.
update public.organization_workspace_boards set state=jsonb_build_object(
 'particleGraph',state->'particleGraph',
 'workspaceCatalog',jsonb_build_object('version',1,'defaultName','Main','entries',jsonb_build_array(
  jsonb_build_object('id','10000000-0000-4000-8000-000000000070','name','Named','state',
   jsonb_build_object('particleGraph',jsonb_build_object('workspaceId',org_id,'revision',7,
    'particles',jsonb_build_array(jsonb_build_object('id','10000000-0000-4000-8000-000000000020','title','Named saved'))))))));
create function pg_temp.canvas_commit(rev integer, intent text, op integer, canvas uuid default '10000000-0000-4000-8000-000000000070', expected_graph jsonb default null)
returns jsonb language sql security invoker as $$
 select public.commit_workspace_page('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',
 '10000000-0000-4000-8000-000000000010',('10000000-0000-4000-8000-'||lpad(op::text,12,'0'))::uuid,
 repeat('a',64),rev,intent,'{"title":"Named page","description":"Welcome","particleIds":["10000000-0000-4000-8000-000000000020"]}',
 '{"version":1,"brand":{"name":"Community table","organizationSlug":"community-table"},"title":"Named page","description":"Welcome","items":[{"id":"10000000-0000-4000-8000-000000000020","title":"Named saved","content":{"kind":"text"}}]}',
 coalesce(expected_graph,(select state#>'{workspaceCatalog,entries,0,state,particleGraph}' from public.organization_workspace_boards where org_id='10000000-0000-4000-8000-000000000001')),
 '2026-10-16T18:30:00Z','[]',null,canvas);
$$;
select pg_temp.check_canvas(to_regprocedure('public.commit_workspace_page(uuid,uuid,uuid,uuid,text,integer,text,jsonb,jsonb,jsonb,timestamptz,jsonb,jsonb)') is null);
set local role anon;
select pg_temp.reject_canvas('select pg_temp.canvas_commit(0,''publish'',30)','42501');
reset role;
set local role authenticated;
select pg_temp.reject_canvas('select pg_temp.canvas_commit(0,''publish'',30)','42501');
reset role;
set local role service_role;
select pg_temp.reject_canvas('select pg_temp.canvas_commit(0,''publish'',30,''10000000-0000-4000-8000-000000000071'')','40001');
select pg_temp.reject_canvas('select pg_temp.canvas_commit(0,''publish'',30,null)','40001');
select pg_temp.canvas_commit(0,'save_draft',30);
select pg_temp.check_canvas((select canvas_id='10000000-0000-4000-8000-000000000070' and revision=1 and visibility='private' from public.organization_workspace_pages));
select pg_temp.canvas_commit(1,'publish',31);
select pg_temp.check_canvas((select (public.read_workspace_page_public('community-table','10000000-0000-4000-8000-000000000010')#>>'{snapshot,items,0,title}')='Named saved'));
select pg_temp.check_canvas((pg_temp.canvas_commit(1,'publish',31)->>'replayed')::boolean);
select pg_temp.reject_canvas('select pg_temp.canvas_commit(1,''publish'',31,null)','42501');
select pg_temp.reject_canvas('select pg_temp.canvas_commit(2,''save_draft'',32,null)','42501');
-- Unrelated root edits do not invalidate the named source.
update public.organization_workspace_boards set state=jsonb_set(state,'{particleGraph,revision}','200');
select pg_temp.canvas_commit(2,'save_draft',32);
select pg_temp.check_canvas((select visibility='public' and revision=3 from public.organization_workspace_pages));
-- A selected source changed after review cannot commit stale JSON.
select pg_temp.reject_canvas('select pg_temp.canvas_commit(3,''publish'',33,expected_graph=>''{}'')','40001');
-- Ambiguous catalog identity is rejected, even if both graphs are identical.
update public.organization_workspace_boards set state=jsonb_set(state,'{workspaceCatalog,entries}',
 (state#>'{workspaceCatalog,entries}') || (state#>'{workspaceCatalog,entries}'));
select pg_temp.reject_canvas('select pg_temp.canvas_commit(3,''publish'',33)','40001');
-- Deletion does not auto-publish root content or block explicit revocation.
update public.organization_workspace_boards set state=jsonb_set(state,'{workspaceCatalog,entries}','[]');
select pg_temp.reject_canvas('select pg_temp.canvas_commit(3,''publish'',33)','40001');
select pg_temp.canvas_commit(3,'make_private',33);
select pg_temp.check_canvas(public.read_workspace_page_public('community-table','10000000-0000-4000-8000-000000000010') is null);
reset role;
delete from public.organization_workspace_pages;
update public.organization_workspace_boards set state=jsonb_set(state,'{workspaceCatalog,defaultDeleted}','true');
set local role service_role;
select pg_temp.reject_canvas('select public.fixture_page_commit(0,''save_draft'',''10000000-0000-4000-8000-000000000034'')','40001');
reset role;
rollback;
\echo 'sharing canvas: exact source, immutable scope, legacy defaults, replay, private snapshots, role denial, deletion and revocation passed'
