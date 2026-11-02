-- Supported captured-history replay only. No reopening, historical reconciliation,
-- provider activation, independent durability or general-purpose deletion authority.
begin;
create table public.organization_suppression_replay_context (
 backend_pid integer primary key,
 transaction_id bigint not null,
 expected_event jsonb not null check(jsonb_typeof(expected_event)='object')
);
alter table public.organization_suppression_replay_context enable row level security;
alter table public.organization_suppression_replay_context force row level security;
revoke all on public.organization_suppression_replay_context from public,anon,authenticated,service_role;
comment on table public.organization_suppression_replay_context is
 'Private transaction/backend-scoped original event identity. The offline operator sets one expected event; canonical capture remains enabled and rejects any payload mismatch. Never an application bypass.';

create or replace function public.capture_organization_suppression_event() returns trigger
 language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare capture public.organization_suppression_capture_state%rowtype;
 closure public.organization_closures%rowtype; org uuid; form uuid; expected jsonb; emitted public.organization_suppression_events%rowtype; document jsonb; event_uuid uuid;
begin
 select expected_event into expected from public.organization_suppression_replay_context
  where backend_pid=pg_backend_pid() and transaction_id=txid_current();
 if found then
  if not exists(select 1 from pg_catalog.pg_roles where rolname=session_user and rolsuper)
   or current_setting('session_replication_role')<>'origin'
   or exists(select 1 from pg_catalog.pg_database where datname=current_database() and datallowconn) then
   raise exception 'Offline suppression replay context required' using errcode='42501'; end if;
  event_uuid:=(expected->>'eventId')::uuid;
 else event_uuid:=gen_random_uuid(); end if;
 -- Never wait for a cross-organization capture lock while holding domain locks.
 -- Retrying the whole rejected transaction preserves canonical operation IDs.
 begin
  select * into strict capture from public.organization_suppression_capture_state where singleton for update nowait;
 exception when lock_not_available then
  raise exception 'Suppression capture busy; retry transaction' using errcode='40001';
 end;
 if not exists(select 1 from public.organization_restore_identity where singleton and source_id=capture.source_id) then
  raise exception 'Suppression source identity changed' using errcode='40001'; end if;
 update public.organization_suppression_capture_state set high_water=high_water+1 where singleton
  returning high_water into capture.high_water;
 if tg_table_name='organization_closure_operations' then
  select * into strict closure from public.organization_closures where org_id=new.org_id;
  if closure.revision<>new.expected_revision+1
   or (new.action='request' and (closure.state<>'closing' or closure.request_id<>new.operation_id))
   or (new.action='cancel' and closure.state<>'active') then
   raise exception 'Closure capture does not match transition' using errcode='40001'; end if;
  insert into public.organization_suppression_events(sequence,event_id,kind,organization_id,operation_id,revision,occurred_at,
   request_id,requested_at,export_until)
   values(capture.high_water,event_uuid,'closure_'||new.action,new.org_id,new.operation_id,closure.revision,new.completed_at,
    closure.request_id,closure.requested_at,closure.export_until) returning * into emitted;
 elsif tg_table_name='organization_form_response_deletions' then
  select org_id,form_id into strict org,form from public.organization_form_versions where id=new.version_id;
  insert into public.organization_suppression_events(sequence,event_id,kind,organization_id,operation_id,revision,occurred_at,
   form_id,version_id,response_id,submitted_at)
   values(capture.high_water,event_uuid,'response_deleted',org,new.operation_id,new.response_revision,new.deleted_at,
    form,new.version_id,new.response_id,new.submitted_at) returning * into emitted;
 else raise exception 'Unsupported suppression capture' using errcode='42501'; end if;
 if expected is not null then
  document:=jsonb_build_object('sequence',emitted.sequence,'eventId',emitted.event_id,'kind',emitted.kind,
   'organizationId',emitted.organization_id,'operationId',emitted.operation_id,'revision',emitted.revision,'occurredAt',emitted.occurred_at)
   ||case when emitted.kind='closure_request' then jsonb_build_object('request',jsonb_build_object(
    'requestId',emitted.request_id,'requestedAt',emitted.requested_at,'exportUntil',emitted.export_until))
   when emitted.kind='response_deleted' then jsonb_build_object('response',jsonb_build_object(
    'formId',emitted.form_id,'versionId',emitted.version_id,'responseId',emitted.response_id,'submittedAt',emitted.submitted_at))
   else '{}'::jsonb end;
  if document<>expected then raise exception 'Replayed event differs from retained evidence' using errcode='40001'; end if;
 end if;
 return new;
end $$;
revoke all on function public.capture_organization_suppression_event() from public,anon,authenticated,service_role;

create function public.replay_organization_suppression_history(p_manifest text,p_expected_sha256 text)
 returns jsonb language plpgsql security invoker set search_path='' set timezone='UTC' as $$
declare manifest jsonb; before_snapshot jsonb; entry jsonb; payload jsonb; latest jsonb;
 org uuid; operation uuid; event_version uuid; form uuid; response uuid; rev integer; seq bigint; prefix bigint;
 happened timestamptz; requested timestamptz; deadline timestamptz; submitted timestamptz;
 closure public.organization_closures%rowtype; deletion public.organization_form_response_deletions%rowtype;
 answer public.organization_form_responses%rowtype; applied integer:=0;
begin
 perform pg_catalog.pg_stat_clear_snapshot();
 if session_user<>current_user or not exists(select 1 from pg_catalog.pg_roles where rolname=current_user and rolsuper)
  or current_setting('transaction_isolation')<>'read committed'
  or current_setting('session_replication_role')<>'origin'
  or exists(select 1 from pg_catalog.pg_database where datname=current_database() and datallowconn)
  or exists(select 1 from pg_catalog.pg_stat_activity where datname=current_database() and pid<>pg_backend_pid())
  or exists(select 1 from pg_catalog.pg_prepared_xacts where database=current_database()) then
  raise exception 'Isolated offline restore session required' using errcode='42501'; end if;
 if p_manifest is null or octet_length(p_manifest)>1048576 or p_expected_sha256 is null
  or p_expected_sha256!~'^[0-9a-f]{64}$'
  or encode(sha256(convert_to(p_manifest,'UTF8')),'hex')<>p_expected_sha256 then
  raise exception 'Suppression evidence digest mismatch' using errcode='22023'; end if;
 manifest:=p_manifest::jsonb;
 if jsonb_typeof(manifest) is distinct from 'object'
  or manifest-'format'-'sourceId'-'capturedSince'-'historyRequiresReconciliation'-'highWater'-'events'<>'{}'::jsonb
  or manifest->>'format' is distinct from 'coach-house-suppression-capture-v1'
  or jsonb_typeof(manifest->'sourceId') is distinct from 'string'
  or jsonb_typeof(manifest->'capturedSince') is distinct from 'string'
  or manifest->'historyRequiresReconciliation' is distinct from 'true'::jsonb
  or jsonb_typeof(manifest->'highWater') is distinct from 'number'
  or (manifest->>'highWater')!~'^(0|[1-9][0-9]*)$'
  or jsonb_typeof(manifest->'events') is distinct from 'array' then
  raise exception 'Invalid suppression history' using errcode='22023'; end if;
 if jsonb_array_length(manifest->'events')>1000
  or (manifest->>'highWater')::bigint<>jsonb_array_length(manifest->'events') then
  raise exception 'Incomplete suppression history' using errcode='22023'; end if;
 lock table public.organizations,public.organization_closures,public.organization_closure_operations,
  public.organization_form_versions,public.organization_form_responses,public.organization_form_corrections,
  public.organization_form_response_deletions,public.organization_suppression_capture_state,
  public.organization_suppression_events,public.organization_suppression_replay_context in access exclusive mode nowait;
 if exists(select 1 from public.organization_suppression_replay_context) then
  raise exception 'Suppression replay context already present' using errcode='40001'; end if;
 if exists(select 1 from unnest(array[
   'organization_closure_publication','organization_closure_board',
   'organization_closure_pending_access','fiscal_delivery_shutdown',
   'organization_closure_cancel_ai','organization_closure_calendar_access',
   'organization_closure_disable_ai_billing','organization_closure_public_flags'
  ]) required(name) where not exists(select 1 from pg_catalog.pg_trigger t
   where t.tgrelid='public.organization_closures'::regclass and t.tgname=required.name
    and t.tgenabled in ('O','A') and (t.tgtype::integer & 21)=21 and not t.tgisinternal)) then
  raise exception 'Required closure shutdown triggers unavailable' using errcode='42501'; end if;
 before_snapshot:=public.read_organization_suppression_events();
 prefix:=(before_snapshot->>'highWater')::bigint;
 if before_snapshot-'events'-'highWater'<>manifest-'events'-'highWater'
  or prefix>(manifest->>'highWater')::bigint
  or exists(select 1 from jsonb_array_elements(before_snapshot->'events') with ordinality t(value,n)
    where value<>manifest->'events'->(n::integer-1)) then
  raise exception 'Suppression history prefix conflicts' using errcode='40001'; end if;
 if (select count(distinct value->>'eventId') from jsonb_array_elements(manifest->'events'))
  <>jsonb_array_length(manifest->'events') then
  raise exception 'Duplicate suppression event' using errcode='22023'; end if;
 for entry,seq in select value,n from jsonb_array_elements(manifest->'events') with ordinality t(value,n) loop
  if jsonb_typeof(entry) is distinct from 'object'
   or jsonb_typeof(entry->'sequence') is distinct from 'number'
   or (entry->>'sequence')!~'^[1-9][0-9]*$' or (entry->>'sequence')::bigint<>seq
   or jsonb_typeof(entry->'eventId') is distinct from 'string'
   or jsonb_typeof(entry->'organizationId') is distinct from 'string'
   or jsonb_typeof(entry->'operationId') is distinct from 'string'
   or jsonb_typeof(entry->'revision') is distinct from 'number'
   or (entry->>'revision')!~'^[1-9][0-9]*$'
   or jsonb_typeof(entry->'occurredAt') is distinct from 'string'
   or (entry->>'occurredAt')!~'(Z|[+-]00:00)$'
   or entry->>'kind' is null or entry->>'kind' not in ('closure_request','closure_cancel','response_deleted') then
   raise exception 'Invalid suppression event' using errcode='22023'; end if;
  perform (entry->>'eventId')::uuid;
  org:=(entry->>'organizationId')::uuid; operation:=(entry->>'operationId')::uuid;
  rev:=(entry->>'revision')::integer; happened:=(entry->>'occurredAt')::timestamptz;
  if not isfinite(happened) or happened>clock_timestamp()
   or not exists(select 1 from public.organizations where user_id=org) then
   raise exception 'Suppression event identity or time unavailable' using errcode='40001'; end if;
  payload:=entry-'sequence'-'eventId'-'kind'-'organizationId'-'operationId'-'revision'-'occurredAt';
  if entry->>'kind'='closure_request' then
   if payload-'request'<>'{}'::jsonb or jsonb_typeof(payload->'request') is distinct from 'object'
    or (payload->'request')-'requestId'-'requestedAt'-'exportUntil'<>'{}'::jsonb
    or payload#>>'{request,requestId}' is distinct from entry->>'operationId'
    or jsonb_typeof(payload#>'{request,requestedAt}') is distinct from 'string'
    or jsonb_typeof(payload#>'{request,exportUntil}') is distinct from 'string'
    or (payload#>>'{request,requestedAt}')!~'(Z|[+-]00:00)$'
    or (payload#>>'{request,exportUntil}')!~'(Z|[+-]00:00)$' then
    raise exception 'Invalid closure request event' using errcode='22023'; end if;
   requested:=(payload#>>'{request,requestedAt}')::timestamptz;
   deadline:=(payload#>>'{request,exportUntil}')::timestamptz;
   if not isfinite(requested) or not isfinite(deadline) or requested>happened
    or deadline<>requested+interval '720 hours' then
    raise exception 'Invalid original closure window' using errcode='22023'; end if;
  elsif entry->>'kind'='closure_cancel' then
   if payload<>'{}'::jsonb then raise exception 'Invalid cancellation event' using errcode='22023'; end if;
  else
   if payload-'response'<>'{}'::jsonb or jsonb_typeof(payload->'response') is distinct from 'object'
    or (payload->'response')-'formId'-'versionId'-'responseId'-'submittedAt'<>'{}'::jsonb
    or jsonb_typeof(payload#>'{response,formId}') is distinct from 'string'
    or jsonb_typeof(payload#>'{response,versionId}') is distinct from 'string'
    or jsonb_typeof(payload#>'{response,responseId}') is distinct from 'string'
    or jsonb_typeof(payload#>'{response,submittedAt}') is distinct from 'string'
    or (payload#>>'{response,submittedAt}')!~'(Z|[+-]00:00)$' then
    raise exception 'Invalid deletion event' using errcode='22023'; end if;
   form:=(payload#>>'{response,formId}')::uuid; event_version:=(payload#>>'{response,versionId}')::uuid;
   response:=(payload#>>'{response,responseId}')::uuid; submitted:=(payload#>>'{response,submittedAt}')::timestamptz;
   if not isfinite(submitted) or submitted>happened
    or not exists(select 1 from public.organization_form_versions where id=event_version and org_id=org and form_id=form)
    or not exists(select 1 from public.organization_forms where org_id=org and id=form) then
    raise exception 'Deletion source history unavailable' using errcode='40001'; end if;
  end if;
  if seq<=prefix then continue; end if;
  insert into public.organization_suppression_replay_context values(pg_backend_pid(),txid_current(),entry);
  if entry->>'kind' in ('closure_request','closure_cancel') then
   if exists(select 1 from public.organization_closure_operations where org_id=org and operation_id=operation) then
    raise exception 'Closure receipt conflicts with captured prefix' using errcode='40001'; end if;
   select * into closure from public.organization_closures where org_id=org;
   if not found then closure.state:='active'; closure.revision:=0; end if;
   if closure.revision<>rev-1 then raise exception 'Closure revision conflicts' using errcode='40001'; end if;
   if entry->>'kind'='closure_request' then
    if closure.state<>'active' then raise exception 'Closure request history conflicts' using errcode='40001'; end if;
    insert into public.organization_closures(org_id,state,revision,request_id,requested_at,export_until)
     values(org,'closing',rev,operation,requested,deadline)
     on conflict(org_id) do update set state=excluded.state,revision=excluded.revision,
      request_id=excluded.request_id,requested_at=excluded.requested_at,export_until=excluded.export_until;
   else
    if closure.state<>'closing' or happened<closure.requested_at or happened>=closure.export_until then
     raise exception 'Cancellation history conflicts' using errcode='40001'; end if;
    update public.organization_closures set state='active',revision=rev,request_id=null,requested_at=null,export_until=null where org_id=org;
   end if;
   insert into public.organization_closure_operations(org_id,operation_id,action,expected_revision,completed_at)
    values(org,operation,replace(entry->>'kind','closure_',''),rev-1,happened);
  else
   if exists(select 1 from public.organization_closures where org_id=org and state='closing') then
    raise exception 'Deletion captured during unsupported closing state' using errcode='40001'; end if;
   if exists(select 1 from public.organization_form_response_deletions where version_id=event_version and (response_id=response or operation_id=operation)) then
    raise exception 'Deletion receipt conflicts with captured prefix' using errcode='40001'; end if;
   select * into answer from public.organization_form_responses where version_id=event_version and id=response;
   if found and (answer.revision>rev or answer.submitted_at<>submitted) then
    raise exception 'Restored response conflicts with deletion' using errcode='40001'; end if;
   insert into public.organization_form_response_deletions(version_id,response_id,operation_id,actor_id,response_revision,submitted_at,deleted_at)
    values(event_version,response,operation,null,rev,submitted,happened);
   -- Canonical response DELETE cascades corrections. Unknown original actor is
   -- deliberately not reconstructed as the owner or another shared identity.
   delete from public.organization_form_responses where version_id=event_version and id=response;
  end if;
  delete from public.organization_suppression_replay_context where backend_pid=pg_backend_pid() and transaction_id=txid_current();
  applied:=applied+1;
 end loop;
 -- Prefix matches alone do not attest or repair every domain's revocations.
 -- Check the supported canonical outcomes; retain the quarantine regardless.
 for latest in select distinct on (value->>'organizationId') value from jsonb_array_elements(manifest->'events')
  where value->>'kind' in ('closure_request','closure_cancel') order by value->>'organizationId',(value->>'sequence')::bigint desc loop
  select * into closure from public.organization_closures where org_id=(latest->>'organizationId')::uuid;
  if not found or closure.revision<>(latest->>'revision')::integer
   or (latest->>'kind'='closure_cancel' and closure.state<>'active')
   or (latest->>'kind'='closure_request' and (closure.state<>'closing'
    or closure.request_id is distinct from (latest->>'operationId')::uuid
    or closure.requested_at is distinct from (latest#>>'{request,requestedAt}')::timestamptz
    or closure.export_until is distinct from (latest#>>'{request,exportUntil}')::timestamptz)) then
   raise exception 'Restored lifecycle does not match captured history' using errcode='40001'; end if;
 end loop;
 for entry in select value from jsonb_array_elements(manifest->'events') loop
  org:=(entry->>'organizationId')::uuid; operation:=(entry->>'operationId')::uuid; rev:=(entry->>'revision')::integer;
  if entry->>'kind' in ('closure_request','closure_cancel') then
   if not exists(select 1 from public.organization_closure_operations where org_id=org and operation_id=operation
    and action=replace(entry->>'kind','closure_','') and expected_revision=rev-1 and completed_at=(entry->>'occurredAt')::timestamptz) then
    raise exception 'Restored closure receipt does not match history' using errcode='40001'; end if;
  else
   event_version:=(entry#>>'{response,versionId}')::uuid; response:=(entry#>>'{response,responseId}')::uuid;
   select * into deletion from public.organization_form_response_deletions where version_id=event_version and response_id=response;
   if not found or deletion.operation_id<>operation or deletion.response_revision<>rev
    or deletion.submitted_at<>(entry#>>'{response,submittedAt}')::timestamptz
    or deletion.deleted_at<>(entry->>'occurredAt')::timestamptz
    or exists(select 1 from public.organization_form_responses where version_id=event_version and id=response)
    or exists(select 1 from public.organization_form_corrections where version_id=event_version and response_id=response) then
    raise exception 'Restored deletion does not match captured history' using errcode='40001'; end if;
  end if;
 end loop;
 if public.read_organization_suppression_events()<>manifest then
  raise exception 'Replayed history differs from retained evidence' using errcode='40001'; end if;
 return jsonb_build_object('quarantined',true,'applied',applied,'exact',prefix,'highWater',manifest->'highWater',
  'sha256',p_expected_sha256,'captureComplete',false,'releaseQualified',false);
end $$;
revoke all on function public.replay_organization_suppression_history(text,text) from public,anon,authenticated,service_role;
comment on function public.replay_organization_suppression_history(text,text) is
 'Sole offline superuser only, connections disabled. Replays a pinned bounded exact capture prefix with original IDs/times and enabled canonical shutdown/capture hooks; deletes supported restored answers/corrections with suppression tombstones. Never restores actor identity, grants or publication. Does not qualify prior/independent revocations, freshness, durable capture, hosted control, purge or reopening.';
commit;
