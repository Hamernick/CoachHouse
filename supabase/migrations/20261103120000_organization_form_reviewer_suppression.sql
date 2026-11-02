-- Exact native member-reviewer generations; no actor-bearing recovery journal,
-- implicit owner access, historical reconstruction, hosted durability or activation.
begin;
lock table public.organization_form_reviewers in share row exclusive mode;
alter table public.organization_form_reviewers add column grant_id uuid not null default gen_random_uuid();
create unique index organization_form_reviewers_grant_id on public.organization_form_reviewers(grant_id);
comment on column public.organization_form_reviewers.grant_id is
 'Opaque authority generation. Rotates on actual role/grantor/manager revision changes; unchanged canonical upserts keep it. Not a new membership or response authority.';
-- Backups predating this installation cannot safely identify legacy generations.
-- Restore the captured nonce with the rows; never reconstruct or rebind it.
alter table public.organization_suppression_capture_state
 add column reviewer_generation_id uuid not null default gen_random_uuid();
alter table public.organization_suppression_events
 add column reviewer_generation_id uuid,
 add column reviewer_grant_id uuid,
 add column reviewer_permission text,
 add column reviewer_created_at timestamptz;
alter table public.organization_suppression_events drop constraint organization_suppression_events_kind_check;
alter table public.organization_suppression_events add constraint organization_suppression_events_kind_check
 check(kind in ('closure_request','closure_cancel','response_deleted','form_invitation_revoked','form_reviewer_revoked'));
alter table public.organization_suppression_events drop constraint organization_suppression_events_check;
alter table public.organization_suppression_events add constraint organization_suppression_events_check check(
 (kind<>'form_reviewer_revoked' and reviewer_generation_id is null and reviewer_grant_id is null and reviewer_permission is null and reviewer_created_at is null and (
 (kind<>'form_invitation_revoked' and invitation_id is null and invitation_parent_id is null
  and invitation_permission is null and invitation_created_at is null and (
   (kind='closure_request' and request_id is not null and request_id=operation_id and requested_at is not null
    and isfinite(requested_at) and export_until is not null and export_until=requested_at+interval '720 hours'
    and form_id is null and version_id is null and response_id is null and submitted_at is null)
   or (kind='closure_cancel' and request_id is null and requested_at is null and export_until is null
    and form_id is null and version_id is null and response_id is null and submitted_at is null)
   or (kind='response_deleted' and request_id is null and requested_at is null and export_until is null
    and form_id is not null and version_id is not null and response_id is not null
    and submitted_at is not null and isfinite(submitted_at))))
 or (kind='form_invitation_revoked' and invitation_id is not null and invitation_id=operation_id
  and form_id is not null and invitation_permission is not null
  and invitation_permission in ('view','correct','edit','manage') and invitation_created_at is not null
  and isfinite(invitation_created_at) and invitation_created_at<=occurred_at
  and invitation_parent_id is distinct from invitation_id and request_id is null and requested_at is null
  and export_until is null and version_id is null and response_id is null and submitted_at is null)))
 or (kind='form_reviewer_revoked' and reviewer_generation_id is not null and reviewer_grant_id is not null and reviewer_grant_id=operation_id
  and reviewer_permission is not null and reviewer_permission in ('view','edit','manage')
  and reviewer_created_at is not null and isfinite(reviewer_created_at) and reviewer_created_at<=occurred_at
  and form_id is not null and invitation_id is null and invitation_parent_id is null and invitation_permission is null
  and invitation_created_at is null and request_id is null and requested_at is null and export_until is null
  and version_id is null and response_id is null and submitted_at is null));
create or replace function public.organization_suppression_event_json(e public.organization_suppression_events) returns jsonb
 language sql immutable set search_path='' set timezone='UTC' as $$
 select jsonb_build_object('sequence',e.sequence,'eventId',e.event_id,'kind',e.kind,
  'organizationId',e.organization_id,'operationId',e.operation_id,'revision',e.revision,'occurredAt',e.occurred_at)
  ||case when e.kind='closure_request' then jsonb_build_object('request',jsonb_build_object(
   'requestId',e.request_id,'requestedAt',e.requested_at,'exportUntil',e.export_until))
  when e.kind='response_deleted' then jsonb_build_object('response',jsonb_build_object(
   'formId',e.form_id,'versionId',e.version_id,'responseId',e.response_id,'submittedAt',e.submitted_at))
  when e.kind='form_invitation_revoked' then jsonb_build_object('invitation',jsonb_build_object(
   'formId',e.form_id,'invitationId',e.invitation_id,'parentInvitationId',e.invitation_parent_id,
   'permission',e.invitation_permission,'createdAt',e.invitation_created_at))
  when e.kind='form_reviewer_revoked' then jsonb_build_object('reviewer',jsonb_build_object(
   'formId',e.form_id,'generationId',e.reviewer_generation_id,'grantId',e.reviewer_grant_id,'permission',e.reviewer_permission,'createdAt',e.reviewer_created_at))
  else '{}'::jsonb end;
$$;
revoke all on function public.organization_suppression_event_json(public.organization_suppression_events)
 from public,anon,authenticated,service_role;

create unique index organization_suppression_reviewer_identity
 on public.organization_suppression_events(reviewer_grant_id) where kind='form_reviewer_revoked';

create function public.record_form_reviewer_suppression(p_reviewer public.organization_form_reviewers,p_occurred timestamptz)
 returns void language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare capture public.organization_suppression_capture_state%rowtype; expected jsonb;
 emitted public.organization_suppression_events%rowtype; event_uuid uuid; happened timestamptz:=p_occurred;
begin
 select expected_event into expected from public.organization_suppression_replay_context
  where backend_pid=pg_backend_pid() and transaction_id=txid_current();
 if found then
  if not exists(select 1 from pg_catalog.pg_roles where rolname=session_user and rolsuper)
   or current_setting('session_replication_role')<>'origin'
   or exists(select 1 from pg_catalog.pg_database where datname=current_database() and datallowconn) then
   raise exception 'Offline suppression replay context required' using errcode='42501'; end if;
  event_uuid:=(expected->>'eventId')::uuid;
  happened:=(expected->>'occurredAt')::timestamptz;
 else event_uuid:=gen_random_uuid(); end if;
 begin
  select * into strict capture from public.organization_suppression_capture_state where singleton for update nowait;
 exception when lock_not_available then
  raise exception 'Suppression capture busy; retry transaction' using errcode='40001';
 end;
 if not exists(select 1 from public.organization_restore_identity where singleton and source_id=capture.source_id) then
  raise exception 'Suppression source identity changed' using errcode='40001'; end if;
 update public.organization_suppression_capture_state set high_water=high_water+1 where singleton
  returning high_water into capture.high_water;
 insert into public.organization_suppression_events(sequence,event_id,kind,organization_id,operation_id,revision,occurred_at,
  form_id,reviewer_generation_id,reviewer_grant_id,reviewer_permission,reviewer_created_at)
 values(capture.high_water,event_uuid,'form_reviewer_revoked',p_reviewer.org_id,p_reviewer.grant_id,
  p_reviewer.manager_revision,happened,p_reviewer.form_id,capture.reviewer_generation_id,p_reviewer.grant_id,p_reviewer.role,p_reviewer.created_at)
 returning * into emitted;
 if expected is not null and public.organization_suppression_event_json(emitted)<>expected then
  raise exception 'Replayed reviewer differs from retained evidence' using errcode='40001'; end if;
end $$;
revoke all on function public.record_form_reviewer_suppression(public.organization_form_reviewers,timestamptz)
 from public,anon,authenticated,service_role;

create function public.guard_form_reviewer_suppression() returns trigger
 language plpgsql security definer set search_path='' as $$
begin
 -- Both insertion and authority rotation allocate a generation. Hold this fence
 -- through commit so a concurrent DELETE cannot win after an unchecked lookup.
 begin
  perform 1 from public.organization_suppression_capture_state where singleton for share nowait;
  if not found then raise exception 'Suppression capture unavailable' using errcode='40001'; end if;
 exception when lock_not_available then
  raise exception 'Suppression capture busy; retry transaction' using errcode='40001';
 end;
 if tg_op='UPDATE' then
  if new.org_id is distinct from old.org_id or new.form_id is distinct from old.form_id
   or new.member_id is distinct from old.member_id or new.created_at is distinct from old.created_at
   or new.grant_id is distinct from old.grant_id then
   raise exception 'Form reviewer identity cannot change' using errcode='42501'; end if;
  if new.role is distinct from old.role or new.granted_by is distinct from old.granted_by
   or new.manager_revision is distinct from old.manager_revision then
   new.grant_id:=gen_random_uuid();
  end if;
 end if;
 if exists(select 1 from public.organization_suppression_events where kind='form_reviewer_revoked' and reviewer_grant_id=new.grant_id) then
  raise exception 'Form reviewer generation is suppressed' using errcode='42501'; end if;
 return new;
end $$;
create trigger organization_form_reviewer_suppression_guard before insert or update
 on public.organization_form_reviewers for each row execute function public.guard_form_reviewer_suppression();
revoke all on function public.guard_form_reviewer_suppression() from public,anon,authenticated,service_role;

create function public.capture_form_reviewer_suppression() returns trigger
 language plpgsql security definer set search_path='' as $$
begin
 -- OLD survives membership/Auth/form cascades. No lookup of deleted principals.
 if tg_op='DELETE' then
  perform public.record_form_reviewer_suppression(old,clock_timestamp());
  return old;
 end if;
 if new.grant_id is distinct from old.grant_id then
  perform public.record_form_reviewer_suppression(old,clock_timestamp());
 end if;
 return new;
end $$;
create trigger organization_form_reviewer_suppression_capture after update or delete
 on public.organization_form_reviewers for each row execute function public.capture_form_reviewer_suppression();
revoke all on function public.capture_form_reviewer_suppression() from public,anon,authenticated,service_role;

create or replace function public.read_organization_suppression_events() returns jsonb
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
 if exists(select 1 from (values
  ('organization_form_invitation_suppression_capture'::text,'public.capture_form_invitation_suppression()'::regprocedure,25),
  ('organization_form_invitation_suppression_guard','public.guard_form_invitation_suppression()'::regprocedure,23)) required(name,procedure,mask)
  where not exists(select 1 from pg_catalog.pg_trigger t where t.tgrelid='public.organization_form_viewer_invitations'::regclass
   and t.tgname=required.name and t.tgfoid=required.procedure and t.tgenabled in ('O','A')
   and (t.tgtype::integer & required.mask)=required.mask and not t.tgisinternal)) then
  raise exception 'Invitation suppression boundary unavailable' using errcode='42501'; end if;
 if exists(select 1 from (values
  ('organization_form_reviewer_suppression_capture'::text,'public.capture_form_reviewer_suppression()'::regprocedure,25),
  ('organization_form_reviewer_suppression_guard','public.guard_form_reviewer_suppression()'::regprocedure,23)) required(name,procedure,mask)
  where not exists(select 1 from pg_catalog.pg_trigger t where t.tgrelid='public.organization_form_reviewers'::regclass
   and t.tgname=required.name and t.tgfoid=required.procedure and t.tgenabled in ('O','A')
   and (t.tgtype::integer & required.mask)=required.mask and not t.tgisinternal)) then
  raise exception 'Reviewer suppression boundary unavailable' using errcode='42501'; end if;
 if exists(select 1 from public.organization_suppression_events where kind='form_reviewer_revoked'
  and reviewer_generation_id is distinct from capture.reviewer_generation_id) then
  raise exception 'Reviewer generation lineage conflicts' using errcode='40001'; end if;
 select count(*),coalesce(max(sequence),0) into total,last_sequence from public.organization_suppression_events;
 if total<>capture.high_water or last_sequence<>capture.high_water then
  raise exception 'Suppression history requires reconciliation' using errcode='40001'; end if;
 if total>1000 then raise exception 'Suppression export exceeds bounded limit' using errcode='54000'; end if;
 select jsonb_build_object('format','coach-house-suppression-capture-v1','sourceId',capture.source_id,
  'capturedSince',capture.captured_since,'historyRequiresReconciliation',true,'highWater',capture.high_water,
  'events',coalesce(jsonb_agg(public.organization_suppression_event_json(e) order by e.sequence),'[]'::jsonb)) into result from public.organization_suppression_events e;
 if octet_length(result::text)>1048576 then
  raise exception 'Suppression export exceeds bounded bytes' using errcode='54000'; end if;
 return result;
end $$;
revoke all on function public.read_organization_suppression_events() from public,anon,authenticated,service_role;
comment on function public.read_organization_suppression_events() is
 'Private bounded full-set export for a separately retained operator ledger. Never returns partial history; no content, credentials or actor identifiers. Capture begins at migration and cannot prove older deletion/revocation history, hosted durability or release readiness.';

commit;
