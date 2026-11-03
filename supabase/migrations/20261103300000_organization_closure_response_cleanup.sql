-- Private expired-closure native-response cleanup only. No closure activation,
-- early deletion, hosted retention qualification or organization-erased signal.
begin;

create table public.organization_closure_response_cleanup_operations (
 org_id uuid not null,
 closure_request_id uuid not null,
 operation_id uuid not null,
 closure_revision integer not null check(closure_revision>0),
 result jsonb not null check(jsonb_typeof(result)='object'),
 completed_at timestamptz not null default clock_timestamp(),
 primary key(org_id,closure_request_id,operation_id)
);
alter table public.organization_closure_response_cleanup_operations enable row level security;
alter table public.organization_closure_response_cleanup_operations force row level security;
revoke all on public.organization_closure_response_cleanup_operations from public,anon,authenticated,service_role;
comment on table public.organization_closure_response_cleanup_operations is
 'Private answer-free exact batch receipts for an expired closure request. Native responses only; no organization completion or provider reconciliation. Preserve with closure/suppression evidence.';

create function public.guard_organization_closure_response_cleanup_operation()
 returns trigger language plpgsql security invoker set search_path='' as $$
begin
 raise exception 'Response cleanup receipts are immutable' using errcode='42501';
end $$;
revoke all on function public.guard_organization_closure_response_cleanup_operation()
 from public,anon,authenticated,service_role;
create trigger organization_closure_response_cleanup_immutable
 before update or delete on public.organization_closure_response_cleanup_operations
 for each row execute function public.guard_organization_closure_response_cleanup_operation();
create trigger organization_closure_response_cleanup_no_truncate
 before truncate on public.organization_closure_response_cleanup_operations
 for each statement execute function public.guard_organization_closure_response_cleanup_operation();

create function public.purge_expired_organization_form_responses(
 p_org_id uuid,p_closure_request_id uuid,p_expected_closure_revision integer,p_operation_id uuid
) returns jsonb language plpgsql security invoker set search_path='' set timezone='UTC' as $$
declare
 closure public.organization_closures%rowtype;
 previous public.organization_closure_response_cleanup_operations%rowtype;
 response record;
 response_operation uuid;
 removed integer:=0;
 identities jsonb:='[]'::jsonb;
 remaining boolean;
 result jsonb;
begin
 if session_user<>current_user
  or not exists(select 1 from pg_catalog.pg_roles where rolname=current_user and rolsuper)
  or current_setting('transaction_isolation')<>'read committed'
  or current_setting('session_replication_role')<>'origin' then
  raise exception 'Trusted response cleanup operator required' using errcode='42501';
 end if;
 if p_org_id is null or p_closure_request_id is null or p_operation_id is null
  or p_expected_closure_revision is null or p_expected_closure_revision<1 then
  raise exception 'Invalid response cleanup identity' using errcode='22023';
 end if;
 -- Same first lock as canonical intake and lifecycle request/cancel. Fresh state
 -- after the lock prevents an old closure request from deleting newer content.
 perform 1 from public.organizations where user_id=p_org_id for update;
 if not found then raise exception 'Organization unavailable' using errcode='42501'; end if;
 select * into closure from public.organization_closures where org_id=p_org_id;
 if not found or closure.state<>'closing'
  or closure.request_id is distinct from p_closure_request_id
  or closure.revision is distinct from p_expected_closure_revision
  or closure.export_until is null or closure.requested_at is null
  or closure.export_until<>closure.requested_at+interval '720 hours'
  or clock_timestamp()<closure.export_until then
  raise exception 'Expired current closure required' using errcode='42501';
 end if;
 select * into previous from public.organization_closure_response_cleanup_operations
  where org_id=p_org_id and closure_request_id=p_closure_request_id and operation_id=p_operation_id;
 if found then
  if previous.closure_revision is distinct from p_expected_closure_revision then
   raise exception 'Response cleanup identity reused' using errcode='23505';
  end if;
  return previous.result;
 end if;
 -- Reuse the current operator exporter: exact hooks, lineage, journal continuity
 -- and the existing 1000-event/1MiB capacity wrapper, including later domains.
 perform public.read_organization_suppression_events();
 for response in
  select r.version_id,r.id,r.revision,r.submitted_at
  from public.organization_form_responses r
  join public.organization_form_versions v on v.id=r.version_id
  where v.org_id=p_org_id
  order by r.version_id,r.id limit 50 for update of r nowait
 loop
  response_operation:=gen_random_uuid();
  insert into public.organization_form_response_deletions
   (version_id,response_id,operation_id,actor_id,response_revision,submitted_at)
   values(response.version_id,response.id,response_operation,null,response.revision,response.submitted_at);
  -- A disabled/replaced hook must never turn cleanup into an uncaptured delete.
  if not exists(select 1 from public.organization_suppression_events e
   where e.kind='response_deleted' and e.organization_id=p_org_id
    and e.version_id=response.version_id and e.response_id=response.id
    and e.operation_id=response_operation and e.revision=response.revision
    and e.submitted_at=response.submitted_at) then
   raise exception 'Response cleanup capture unavailable' using errcode='42501';
  end if;
  -- Existing canonical delete disposition: the current answer/hash disappear;
  -- answer-free per-response correction retry rows cascade. Other audit owners,
  -- version definitions and minimal deletion/capture receipts remain untouched.
  delete from public.organization_form_responses
   where version_id=response.version_id and id=response.id;
  removed:=removed+1;
  identities:=identities||jsonb_build_array(jsonb_build_object(
   'versionId',response.version_id,'responseId',response.id));
 end loop;
 perform public.assert_organization_suppression_capacity();
 perform public.read_organization_suppression_events();
 select exists(select 1 from public.organization_form_responses r
  join public.organization_form_versions v on v.id=r.version_id where v.org_id=p_org_id) into remaining;
 result:=jsonb_build_object('scope','native_responses','organizationId',p_org_id,
  'closureRequestId',p_closure_request_id,'closureRevision',p_expected_closure_revision,
  'operationId',p_operation_id,'deletedCount',removed,'deleted',identities,
  'moreRemainingAtCommit',remaining,'captureComplete',false,'releaseQualified',false);
 insert into public.organization_closure_response_cleanup_operations
  (org_id,closure_request_id,operation_id,closure_revision,result)
  values(p_org_id,p_closure_request_id,p_operation_id,p_expected_closure_revision,result);
 return result;
end $$;
revoke all on function public.purge_expired_organization_form_responses(uuid,uuid,integer,uuid)
 from public,anon,authenticated,service_role;
comment on function public.purge_expired_organization_form_responses(uuid,uuid,integer,uuid) is
 'Trusted operator only: up to50 native responses after the exact fixed closure deadline. Atomic suppression/capacity and exact batch retry. No early delete, response-access grant, whole-organization erasure or hosted acceptance.';

-- The prior replay correctly rejected all deletions during closure before a
-- purge owner existed. The new owner emits the same exact response tombstone,
-- with deleted_at=clock_timestamp(), only after the captured fixed deadline.
-- Keep every other replay branch and predeadline denial unchanged.
do $migration$
declare definition text; previous text; replacement text;
begin
 definition:=pg_get_functiondef('public.replay_organization_suppression_history(text,text)'::regprocedure);
 previous:=$before$if exists(select 1 from public.organization_closures where org_id=org and state='closing') then
    raise exception 'Deletion captured during unsupported closing state' using errcode='40001'; end if;$before$;
 replacement:=$after$if exists(select 1 from public.organization_closures where org_id=org and state='closing'
    and happened<export_until) then
    raise exception 'Deletion captured during unsupported closing state' using errcode='40001'; end if;$after$;
 if (length(definition)-length(replace(definition,previous,'')))/length(previous)<>1 then
  raise exception 'Unexpected response cleanup replay predecessor';
 end if;
 execute replace(definition,previous,replacement);
end $migration$;
commit;
