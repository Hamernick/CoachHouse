-- Private retirement of the workspace/form/page content group. Identity-only
-- replay and audit records survive; this is not whole-organization completion.
begin;
create table public.organization_closure_workspace_cleanups (
 org_id uuid not null,closure_request_id uuid not null,operation_id uuid not null,
 closure_revision integer not null check(closure_revision>0),operator_role text not null,
 transaction_id bigint not null,state text not null check(state in('running','complete')),
 result jsonb,created_at timestamptz not null default clock_timestamp(),completed_at timestamptz,
 primary key(org_id,closure_request_id,operation_id),
 check((state='complete')=(result is not null and completed_at is not null))
);
alter table public.organization_closure_workspace_cleanups enable row level security;
revoke all on public.organization_closure_workspace_cleanups from public,anon,authenticated,service_role;
create function public.guard_closure_workspace_cleanup_receipt() returns trigger
 language plpgsql security invoker set search_path='' as $$
begin
 if tg_op<>'UPDATE' then raise exception 'Workspace cleanup receipts are retained' using errcode='42501';end if;
 if (to_jsonb(new)-array['state','result','completed_at']) is distinct from (to_jsonb(old)-array['state','result','completed_at'])
  or old.state<>'running' or new.state<>'complete' or new.result is null or new.completed_at is null then
  raise exception 'Workspace cleanup receipt is immutable' using errcode='42501';end if;
 return new;
end $$;
revoke all on function public.guard_closure_workspace_cleanup_receipt() from public,anon,authenticated,service_role;
create trigger closure_workspace_cleanup_immutable before update or delete on public.organization_closure_workspace_cleanups for each row execute function public.guard_closure_workspace_cleanup_receipt();
create trigger closure_workspace_cleanup_retained before truncate on public.organization_closure_workspace_cleanups for each statement execute function public.guard_closure_workspace_cleanup_receipt();

-- The marker is a private exact operation row in the SAME transaction. It is
-- never a caller-set GUC, role claim or general exception for closing state.
create function public.closure_workspace_retirement_allowed(p_org uuid) returns boolean
 language plpgsql security definer set search_path='' as $$
begin
 if coalesce(nullif(current_setting('role',true),'none'),session_user)<>session_user
  or not exists(select 1 from pg_catalog.pg_roles where rolname=session_user and rolsuper)
  or current_setting('transaction_isolation')<>'read committed' or current_setting('session_replication_role')<>'origin' then return false;end if;
 return exists(select 1 from public.organization_closure_workspace_cleanups r
  join public.organization_closures c on c.org_id=r.org_id and c.request_id=r.closure_request_id and c.revision=r.closure_revision
  where r.org_id=p_org and r.transaction_id=txid_current() and r.state='running'
   and c.state='closing' and c.export_until=c.requested_at+interval '720 hours' and clock_timestamp()>=c.export_until);
end $$;
revoke all on function public.closure_workspace_retirement_allowed(uuid) from public,anon,authenticated,service_role;

-- Exact delete-only exceptions for the one retiring board. No form authority,
-- calendar writer or ordinary data-view receipt mutation is granted.
do $migration$
declare definition text; needle text; replacement text; target text;
begin
 foreach target in array array['guard_workspace_board_closure','guard_workspace_form_sources','record_workspace_particle_calendar_revision'] loop
  definition:=pg_get_functiondef(('public.'||target||'()')::regprocedure);
  needle:='begin'||chr(10);
  replacement:=needle||' if tg_op=''DELETE'' and public.closure_workspace_retirement_allowed(old.org_id) then return old;end if;'||chr(10);
  if (length(definition)-length(replace(definition,needle,'')))/length(needle)<>1 then raise exception 'Unexpected workspace cleanup predecessor: %',target;end if;
  execute replace(definition,needle,replacement);
 end loop;
 definition:=pg_get_functiondef('public.guard_data_view_store()'::regprocedure);
 needle:=' perform public.guard_uploaded_document_organization(org);';
 replacement:=' if public.closure_workspace_retirement_allowed(org) then
  if tg_op=''DELETE'' and tg_table_name in(''organization_data_tables'',''organization_data_rows'',''organization_data_views'') then return old;end if;
  if tg_table_name=''organization_data_view_receipts'' and tg_op=''UPDATE''
   and to_jsonb(new)->''command''=''{}''::jsonb and to_jsonb(new)->''result''=''{}''::jsonb
   and (to_jsonb(old)-array[''command'',''result''])=(to_jsonb(new)-array[''command'',''result'']) then return new;end if;
 end if;'||chr(10)||needle;
 if (length(definition)-length(replace(definition,needle,'')))/length(needle)<>1 then raise exception 'Unexpected data-view cleanup predecessor';end if;
 execute replace(definition,needle,replacement);
end $migration$;

create function public.purge_expired_organization_workspace_content(p_org_id uuid,p_closure_request_id uuid,p_expected_closure_revision integer,p_operation_id uuid) returns jsonb
 language plpgsql security invoker set search_path='' as $$
declare closure public.organization_closures;previous public.organization_closure_workspace_cleanups;
 cleanup_result jsonb;before_capture jsonb;board_count integer;page_count integer;version_count integer;
 table_count integer;row_count integer;view_count integer;receipt_count integer;
begin
 if session_user<>current_user or not exists(select 1 from pg_catalog.pg_roles where rolname=current_user and rolsuper)
  or current_setting('transaction_isolation')<>'read committed' or current_setting('session_replication_role')<>'origin' then
  raise exception 'Actual workspace cleanup operator required' using errcode='42501';end if;
 if p_org_id is null or p_closure_request_id is null or p_operation_id is null or p_expected_closure_revision is null or p_expected_closure_revision<1 then
  raise exception 'Exact workspace cleanup identity required' using errcode='22023';end if;
 perform 1 from public.organizations where user_id=p_org_id for update;
 if not found then raise exception 'Organization unavailable' using errcode='42501';end if;
 select * into closure from public.organization_closures where org_id=p_org_id;
 if not found or closure.state<>'closing' or closure.request_id is distinct from p_closure_request_id
  or closure.revision is distinct from p_expected_closure_revision or closure.export_until is null or closure.requested_at is null
  or closure.export_until<>closure.requested_at+interval '720 hours' or clock_timestamp()<closure.export_until then
  raise exception 'Expired current closure required' using errcode='42501';end if;
 select * into previous from public.organization_closure_workspace_cleanups
  where org_id=p_org_id and closure_request_id=p_closure_request_id and operation_id=p_operation_id;
 if found then
  if previous.closure_revision<>p_expected_closure_revision or previous.state<>'complete' then raise exception 'Workspace cleanup identity changed' using errcode='23505';end if;
  return previous.result;
 end if;
 -- Native responses have their own capture-and-delete owner. Never cascade away
 -- answers or their minimal deletion receipts by deleting form/version rows.
 if exists(select 1 from public.organization_form_responses r join public.organization_form_versions v on v.id=r.version_id where v.org_id=p_org_id) then
  raise exception 'Native response cleanup must complete first' using errcode='42501';end if;
 if exists(select 1 from public.organization_workspace_pages where org_id=p_org_id and (visibility<>'private' or guest_snapshot is not null or public_grant_id is not null or guest_grant_id is not null))
  or exists(select 1 from public.workspace_page_image_grants where org_id=p_org_id)
  or exists(select 1 from public.workspace_page_document_grants where org_id=p_org_id)
  or exists(select 1 from public.workspace_page_note_scopes where org_id=p_org_id and enabled)
  or exists(select 1 from public.workspace_page_invitations where org_id=p_org_id and revoked_at is null) then
  raise exception 'Workspace publication shutdown requires reconciliation' using errcode='42501';end if;
 -- Reject inconsistent cross-owner projections rather than cascading content
 -- belonging to another organization through a nominally owned table.
 if exists(select 1 from public.organization_data_rows r join public.organization_data_tables t on t.id=r.table_id where (r.org_id=p_org_id or t.org_id=p_org_id) and r.org_id<>t.org_id)
  or exists(select 1 from public.organization_data_views v join public.organization_data_tables t on t.id=v.table_id where (v.org_id=p_org_id or t.org_id=p_org_id) and v.org_id<>t.org_id)
  or exists(select 1 from public.organization_form_versions v join public.organization_workspace_pages p on p.id=v.page_id where (v.org_id=p_org_id or p.org_id=p_org_id) and v.org_id<>p.org_id) then
  raise exception 'Independent workspace source ownership requires reconciliation' using errcode='42501';end if;
 before_capture:=public.read_organization_suppression_events();
 -- Existing writers serialize on organization or canonical board; lock children
 -- without waiting behind a reverse-order writer. Retry the exact operation.
 perform 1 from public.organization_workspace_boards where org_id=p_org_id for update nowait;
 perform 1 from public.organization_workspace_pages where org_id=p_org_id order by id for update nowait;
 perform 1 from public.organization_form_versions where org_id=p_org_id order by id for update nowait;
 perform 1 from public.organization_data_tables where org_id=p_org_id order by id for update nowait;
 perform 1 from public.organization_data_rows where org_id=p_org_id order by id for update nowait;
 perform 1 from public.organization_data_views where org_id=p_org_id order by id for update nowait;
 perform 1 from public.organization_data_view_receipts where org_id=p_org_id order by request_id for update nowait;
 insert into public.organization_closure_workspace_cleanups(org_id,closure_request_id,operation_id,closure_revision,operator_role,transaction_id,state)
 values(p_org_id,p_closure_request_id,p_operation_id,p_expected_closure_revision,session_user,txid_current(),'running');
 delete from public.organization_workspace_boards where org_id=p_org_id;get diagnostics board_count=row_count;
 update public.organization_workspace_pages set title='',description='',published_snapshot=null,published_at=null,guest_snapshot=null where org_id=p_org_id;get diagnostics page_count=row_count;
 update public.organization_form_versions set version='{}' where org_id=p_org_id;get diagnostics version_count=row_count;
 delete from public.organization_data_rows where org_id=p_org_id;get diagnostics row_count=row_count;
 delete from public.organization_data_views where org_id=p_org_id;get diagnostics view_count=row_count;
 delete from public.organization_data_tables where org_id=p_org_id;get diagnostics table_count=row_count;
 update public.organization_data_view_receipts set command='{}',result='{}' where org_id=p_org_id;get diagnostics receipt_count=row_count;
 if public.read_organization_suppression_events() is distinct from before_capture then raise exception 'Workspace cleanup changed suppression history' using errcode='42501';end if;
 cleanup_result:=jsonb_build_object('scope','workspace_form_page_content','organizationId',p_org_id,'closureRequestId',p_closure_request_id,'closureRevision',p_expected_closure_revision,'operationId',p_operation_id,
  'boardsDeleted',board_count,'pagesScrubbed',page_count,'formVersionsScrubbed',version_count,'tablesDeleted',table_count,'rowsDeleted',row_count,'viewsDeleted',view_count,'receiptPayloadsScrubbed',receipt_count,
  'identitiesAndSuppressionRetained',true,'captureComplete',false,'releaseQualified',false);
 update public.organization_closure_workspace_cleanups set state='complete',result=cleanup_result,completed_at=clock_timestamp()
 where org_id=p_org_id and closure_request_id=p_closure_request_id and operation_id=p_operation_id;
 return cleanup_result;
end $$;
revoke all on function public.purge_expired_organization_workspace_content(uuid,uuid,integer,uuid) from public,anon,authenticated,service_role;
comment on function public.purge_expired_organization_workspace_content(uuid,uuid,integer,uuid) is
 'Actual operator only after fixed closure deadline and native response/publication shutdown. Removes board/named-canvas, page/form payloads and owned data content; retains minimal form/page/retry identities and suppression. Projects/files/AI/accounting/security records and shared identities are separate owners. No organization-complete or hosted claim.';
commit;
