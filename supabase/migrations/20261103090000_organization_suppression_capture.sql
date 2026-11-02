-- Transactional, answer-free capture only. The source journal is not independent
-- durable storage, complete historical reconciliation, or permission to reopen.
begin;
lock table public.organization_closure_operations,public.organization_form_response_deletions
 in share row exclusive mode;

create table public.organization_suppression_capture_state (
 singleton boolean primary key default true check(singleton),
 source_id uuid not null,
 captured_since timestamptz not null default clock_timestamp(),
 history_requires_reconciliation boolean not null default true check(history_requires_reconciliation),
 high_water bigint not null default 0 check(high_water>=0)
);
insert into public.organization_suppression_capture_state(singleton,source_id)
 select true,source_id from public.organization_restore_identity where singleton;

create table public.organization_suppression_events (
 sequence bigint primary key check(sequence>0),
 event_id uuid not null unique default gen_random_uuid(),
 kind text not null check(kind in ('closure_request','closure_cancel','response_deleted')),
 organization_id uuid not null,
 operation_id uuid not null,
 revision integer not null check(revision>0),
 occurred_at timestamptz not null check(isfinite(occurred_at)),
 request_id uuid,
 requested_at timestamptz,
 export_until timestamptz,
 form_id uuid,
 version_id uuid,
 response_id uuid,
 submitted_at timestamptz,
 check(
  (kind='closure_request' and request_id is not null and request_id=operation_id and requested_at is not null
   and isfinite(requested_at) and export_until=requested_at+interval '720 hours'
   and export_until is not null and form_id is null and version_id is null
   and response_id is null and submitted_at is null)
  or (kind='closure_cancel' and request_id is null and requested_at is null and export_until is null
   and form_id is null and version_id is null and response_id is null and submitted_at is null)
  or (kind='response_deleted' and request_id is null and requested_at is null and export_until is null
   and form_id is not null and version_id is not null and response_id is not null
   and submitted_at is not null and isfinite(submitted_at)))
);
create unique index organization_suppression_closure_identity
 on public.organization_suppression_events(organization_id,operation_id)
 where kind in ('closure_request','closure_cancel');
create unique index organization_suppression_response_identity
 on public.organization_suppression_events(version_id,response_id) where kind='response_deleted';
alter table public.organization_suppression_capture_state enable row level security;
alter table public.organization_suppression_capture_state force row level security;
alter table public.organization_suppression_events enable row level security;
alter table public.organization_suppression_events force row level security;
revoke all on public.organization_suppression_capture_state,public.organization_suppression_events
 from public,anon,authenticated,service_role;
comment on table public.organization_suppression_events is
 'Immutable answer-free events without cascading content/identity FKs. Source-local capture only: independently retained history, historical revocations, recovery, retention and hosted durability remain unqualified. No expiry or purge authority.';

create function public.reject_organization_suppression_event_mutation() returns trigger
 language plpgsql set search_path='' as $$
begin raise exception 'Suppression history is immutable' using errcode='42501'; end $$;
create trigger organization_suppression_events_immutable before update or delete
 on public.organization_suppression_events for each row
 execute function public.reject_organization_suppression_event_mutation();
create trigger organization_suppression_events_no_truncate before truncate
 on public.organization_suppression_events for each statement
 execute function public.reject_organization_suppression_event_mutation();
revoke all on function public.reject_organization_suppression_event_mutation()
 from public,anon,authenticated,service_role;

create function public.capture_organization_suppression_event() returns trigger
 language plpgsql security definer set search_path='' as $$
declare capture public.organization_suppression_capture_state%rowtype;
 closure public.organization_closures%rowtype; org uuid; form uuid;
begin
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
  insert into public.organization_suppression_events(sequence,kind,organization_id,operation_id,revision,occurred_at,
   request_id,requested_at,export_until)
   values(capture.high_water,'closure_'||new.action,new.org_id,new.operation_id,closure.revision,new.completed_at,
    closure.request_id,closure.requested_at,closure.export_until);
 elsif tg_table_name='organization_form_response_deletions' then
  select org_id,form_id into strict org,form from public.organization_form_versions where id=new.version_id;
  insert into public.organization_suppression_events(sequence,kind,organization_id,operation_id,revision,occurred_at,
   form_id,version_id,response_id,submitted_at)
   values(capture.high_water,'response_deleted',org,new.operation_id,new.response_revision,new.deleted_at,
    form,new.version_id,new.response_id,new.submitted_at);
 else raise exception 'Unsupported suppression capture' using errcode='42501'; end if;
 return new;
end $$;
revoke all on function public.capture_organization_suppression_event() from public,anon,authenticated,service_role;
create trigger organization_closure_suppression_capture after insert on public.organization_closure_operations
 for each row execute function public.capture_organization_suppression_event();
create trigger organization_response_suppression_capture after insert on public.organization_form_response_deletions
 for each row execute function public.capture_organization_suppression_event();

create function public.read_organization_suppression_events() returns jsonb
 language plpgsql security invoker set search_path='' set timezone='UTC' as $$
declare capture public.organization_suppression_capture_state%rowtype; result jsonb; total bigint; last_sequence bigint;
begin
 if session_user<>current_user or not exists(select 1 from pg_catalog.pg_roles where rolname=current_user and rolsuper)
  or current_setting('transaction_isolation')<>'read committed'
  or current_setting('session_replication_role')<>'origin' then
  raise exception 'Trusted capture operator session required' using errcode='42501'; end if;
 begin
  select * into strict capture from public.organization_suppression_capture_state where singleton for share nowait;
 exception when lock_not_available then
  raise exception 'Suppression capture busy; retry transaction' using errcode='40001';
 end;
 if not exists(select 1 from public.organization_restore_identity where singleton and source_id=capture.source_id)
  or exists(select 1 from (values
   ('organization_closure_operations'::text,'organization_closure_suppression_capture'::text),
   ('organization_form_response_deletions','organization_response_suppression_capture')) required(relation,name)
   where not exists(select 1 from pg_catalog.pg_trigger t
    where t.tgrelid=pg_catalog.to_regclass('public.'||required.relation) and t.tgname=required.name
     and t.tgenabled in ('O','A') and t.tgfoid='public.capture_organization_suppression_event()'::regprocedure
     and (t.tgtype::integer & 5)=5 and not t.tgisinternal)) then
  raise exception 'Suppression capture boundary unavailable' using errcode='42501'; end if;
 select count(*),coalesce(max(sequence),0) into total,last_sequence from public.organization_suppression_events;
 if total<>capture.high_water or last_sequence<>capture.high_water then
  raise exception 'Suppression history requires reconciliation' using errcode='40001'; end if;
 if total>1000 then raise exception 'Suppression export exceeds bounded limit' using errcode='54000'; end if;
 select jsonb_build_object('format','coach-house-suppression-capture-v1','sourceId',capture.source_id,
  'capturedSince',capture.captured_since,'historyRequiresReconciliation',true,'highWater',capture.high_water,
  'events',coalesce(jsonb_agg(jsonb_build_object('sequence',e.sequence,'eventId',e.event_id,'kind',e.kind,
   'organizationId',e.organization_id,'operationId',e.operation_id,'revision',e.revision,'occurredAt',e.occurred_at)
   ||case when e.kind='closure_request' then jsonb_build_object('request',jsonb_build_object(
    'requestId',e.request_id,'requestedAt',e.requested_at,'exportUntil',e.export_until))
   when e.kind='response_deleted' then jsonb_build_object('response',jsonb_build_object(
    'formId',e.form_id,'versionId',e.version_id,'responseId',e.response_id,'submittedAt',e.submitted_at))
   else '{}'::jsonb end order by e.sequence),'[]'::jsonb)) into result from public.organization_suppression_events e;
 if octet_length(result::text)>1048576 then
  raise exception 'Suppression export exceeds bounded bytes' using errcode='54000'; end if;
 return result;
end $$;
revoke all on function public.read_organization_suppression_events() from public,anon,authenticated,service_role;
comment on function public.read_organization_suppression_events() is
 'Private bounded full-set export for a separately retained operator ledger. Never returns partial history; no content, credentials or actor identifiers. Capture begins at migration and cannot prove older deletion/revocation history, hosted durability or release readiness.';
commit;
