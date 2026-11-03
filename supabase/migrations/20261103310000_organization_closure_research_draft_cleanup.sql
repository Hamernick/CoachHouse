-- Private, source-owned cleanup after the exact closure export window expires.
-- Research recovery edits are children; their AI runs and accounting survive.
begin;
create table public.organization_closure_research_cleanup_operations (
 org_id uuid not null,
 closure_request_id uuid not null,
 operation_id uuid not null,
 expected_closure_revision integer not null check (expected_closure_revision > 0),
 result jsonb not null check (jsonb_typeof(result) = 'object'),
 completed_at timestamptz not null default clock_timestamp(),
 primary key (org_id, closure_request_id, operation_id)
);
alter table public.organization_closure_research_cleanup_operations enable row level security;
revoke all on public.organization_closure_research_cleanup_operations from public, anon, authenticated, service_role;

create function public.guard_organization_research_cleanup_receipt() returns trigger
 language plpgsql security invoker set search_path = '' as $$
begin
 raise exception 'Research cleanup receipts are immutable' using errcode = '42501';
end $$;
revoke all on function public.guard_organization_research_cleanup_receipt() from public, anon, authenticated, service_role;
create trigger organization_research_cleanup_receipt_immutable
 before update or delete on public.organization_closure_research_cleanup_operations
 for each row execute function public.guard_organization_research_cleanup_receipt();
create trigger organization_research_cleanup_receipt_no_truncate
 before truncate on public.organization_closure_research_cleanup_operations
 for each statement execute function public.guard_organization_research_cleanup_receipt();

create function public.purge_expired_organization_research_drafts(
 p_org_id uuid, p_closure_request_id uuid, p_expected_closure_revision integer, p_operation_id uuid
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
 closure public.organization_closures;
 prior public.organization_closure_research_cleanup_operations;
 selected_ids uuid[];
 deleted_count integer;
 result jsonb;
begin
 if session_user is distinct from current_user
  or not exists (select 1 from pg_catalog.pg_roles where rolname = current_user and rolsuper)
 then raise exception 'Actual operator authority required' using errcode = '42501'; end if;
 if current_setting('transaction_isolation') <> 'read committed'
  or current_setting('session_replication_role') <> 'origin'
 then raise exception 'Cleanup requires read committed isolation and origin triggers' using errcode = '42501'; end if;
 if p_org_id is null or p_closure_request_id is null or p_operation_id is null
  or p_expected_closure_revision is null or p_expected_closure_revision < 1
 then raise exception 'Exact closure and operation identity required' using errcode = '22023'; end if;

 -- Same first row lock as request/cancel and canonical draft admission.
 perform 1 from public.organizations where user_id = p_org_id for update;
 if not found then raise exception 'Organization unavailable' using errcode = '42501'; end if;
 select * into closure from public.organization_closures where org_id = p_org_id;
 if not found or closure.state <> 'closing'
  or closure.request_id is distinct from p_closure_request_id
  or closure.revision is distinct from p_expected_closure_revision
 then raise exception 'Closure identity changed' using errcode = '40001'; end if;
 if closure.export_until is distinct from closure.requested_at + interval '720 hours'
  or clock_timestamp() < closure.export_until
 then raise exception 'Closure export window has not expired' using errcode = '42501'; end if;

 -- Verify current lifecycle even for a replay; never apply an old request to a
 -- canceled or newer closure. Exact retry returns its original batch receipt.
 select * into prior from public.organization_closure_research_cleanup_operations
 where org_id = p_org_id and closure_request_id = p_closure_request_id and operation_id = p_operation_id;
 if found then
  if prior.expected_closure_revision is distinct from p_expected_closure_revision
  then raise exception 'Cleanup retry changed' using errcode = '40001'; end if;
  return prior.result;
 end if;

 -- Do not lock or update parents: late settlement/cost evidence must remain
 -- possible. A busy child rejects the whole batch rather than skipping edits.
 begin
  select coalesce(array_agg(chosen.run_id order by chosen.run_id), '{}'::uuid[]) into selected_ids
  from (
   select draft.run_id from public.workspace_research_drafts draft
   join public.workspace_ai_runs run on run.id = draft.run_id
   where run.org_id = p_org_id order by draft.run_id limit 50 for update of draft nowait
  ) chosen;
 exception when lock_not_available then
  raise exception 'Research draft is changing; retry cleanup' using errcode = '40001';
 end;
 delete from public.workspace_research_drafts where run_id = any(selected_ids);
 get diagnostics deleted_count = row_count;
 result := jsonb_build_object('scope', 'workspace_research_drafts', 'deletedCount', deleted_count,
  'moreRemainingAtCommit', exists (
   select 1 from public.workspace_research_drafts draft
   join public.workspace_ai_runs run on run.id = draft.run_id where run.org_id = p_org_id
  ));
 insert into public.organization_closure_research_cleanup_operations
  (org_id, closure_request_id, operation_id, expected_closure_revision, result)
 values (p_org_id, p_closure_request_id, p_operation_id, p_expected_closure_revision, result);
 return result;
end $$;
revoke all on function public.purge_expired_organization_research_drafts(uuid, uuid, integer, uuid)
 from public, anon, authenticated, service_role;
comment on function public.purge_expired_organization_research_drafts(uuid, uuid, integer, uuid) is
 'Private operator-only batch of at most 50 expired-closure recovery drafts. Preserves AI runs, effects and accounting. Source-stage receipt only; no whole-organization completion, hosted cleanup admission or backup/history recovery qualification.';
commit;
