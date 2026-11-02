-- Exact primary-manager generations. Actor-free retirement evidence only;
-- no implicit replacement, publication, reopening or release qualification.
begin;
lock table public.organization_forms in share row exclusive mode;
alter table public.organization_forms
 add column primary_grant_id uuid not null default gen_random_uuid(),
 add column primary_granted_at timestamptz not null default clock_timestamp(),
 add column primary_revoked_at timestamptz,
 add constraint organization_forms_primary_times check(isfinite(primary_granted_at)
  and (primary_revoked_at is null or (isfinite(primary_revoked_at) and primary_revoked_at>=primary_granted_at)));
comment on column public.organization_forms.primary_grant_id is
 'Opaque primary authority generation. Changes only with manager identity/revision; membership restoration cannot revive a retired generation.';
comment on column public.organization_forms.primary_granted_at is
 'Authority generation allocation time; existing forms begin at this migration, not an assertion of historical grant time.';
comment on column public.organization_forms.primary_revoked_at is
 'Sticky retirement of this primary generation. Never removes or rewrites its actor identity; explicit canonical recovery allocates a new generation.';
create unique index organization_forms_primary_grant_id on public.organization_forms(primary_grant_id);
alter table public.organization_suppression_capture_state
 add column primary_manager_generation_id uuid not null default gen_random_uuid();
alter table public.organization_suppression_events
 add column primary_manager_generation_id uuid,
 add column primary_grant_id uuid,
 add column primary_granted_at timestamptz;
alter table public.organization_suppression_events drop constraint organization_suppression_events_kind_check;
alter table public.organization_suppression_events add constraint organization_suppression_events_kind_check
 check(kind in ('closure_request','closure_cancel','response_deleted','form_invitation_revoked','form_reviewer_revoked','form_primary_manager_revoked'));
alter table public.organization_suppression_events drop constraint organization_suppression_events_check;
alter table public.organization_suppression_events add constraint organization_suppression_events_check check(
 (primary_manager_generation_id is null and primary_grant_id is null and primary_granted_at is null and (
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
  and version_id is null and response_id is null and submitted_at is null)))
 or (kind='form_primary_manager_revoked' and primary_manager_generation_id is not null
  and primary_grant_id is not null and primary_grant_id=operation_id
  and primary_granted_at is not null and isfinite(primary_granted_at) and primary_granted_at<=occurred_at
  and form_id is not null and reviewer_generation_id is null and reviewer_grant_id is null
  and reviewer_permission is null and reviewer_created_at is null
  and invitation_id is null and invitation_parent_id is null and invitation_permission is null
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
  when e.kind='form_primary_manager_revoked' then jsonb_build_object('primaryManager',jsonb_build_object(
   'formId',e.form_id,'generationId',e.primary_manager_generation_id,'grantId',e.primary_grant_id,'createdAt',e.primary_granted_at))
  else '{}'::jsonb end;
$$;
revoke all on function public.organization_suppression_event_json(public.organization_suppression_events)
 from public,anon,authenticated,service_role;

create unique index organization_suppression_primary_identity
 on public.organization_suppression_events(primary_grant_id) where kind='form_primary_manager_revoked';

create function public.record_form_primary_manager_suppression(p_form public.organization_forms,p_occurred timestamptz)
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
  form_id,primary_manager_generation_id,primary_grant_id,primary_granted_at)
 values(capture.high_water,event_uuid,'form_primary_manager_revoked',p_form.org_id,p_form.primary_grant_id,
  p_form.manager_revision,happened,p_form.id,capture.primary_manager_generation_id,p_form.primary_grant_id,p_form.primary_granted_at)
 returning * into emitted;
 if expected is not null and public.organization_suppression_event_json(emitted)<>expected then
  raise exception 'Replayed primary manager differs from retained evidence' using errcode='40001'; end if;
end $$;
revoke all on function public.record_form_primary_manager_suppression(public.organization_forms,timestamptz)
 from public,anon,authenticated,service_role;

create function public.guard_form_primary_manager_suppression() returns trigger
 language plpgsql security definer set search_path='' as $$
begin
 begin
  perform 1 from public.organization_suppression_capture_state where singleton for share nowait;
  if not found then raise exception 'Suppression capture unavailable' using errcode='40001'; end if;
 exception when lock_not_available then
  raise exception 'Suppression capture busy; retry transaction' using errcode='40001';
 end;
 if tg_op='UPDATE' then
  if new.org_id is distinct from old.org_id or new.id is distinct from old.id
   or new.primary_grant_id is distinct from old.primary_grant_id
   or new.primary_granted_at is distinct from old.primary_granted_at then
   raise exception 'Form primary authority identity cannot change' using errcode='42501'; end if;
  if new.intake_manager is distinct from old.intake_manager or new.manager_revision is distinct from old.manager_revision then
   new.primary_grant_id:=gen_random_uuid(); new.primary_granted_at:=clock_timestamp(); new.primary_revoked_at:=null;
  elsif old.primary_revoked_at is not null and new.primary_revoked_at is distinct from old.primary_revoked_at then
   raise exception 'Retired form primary authority cannot reactivate' using errcode='42501';
  end if;
 end if;
 if exists(select 1 from public.organization_suppression_events where kind='form_primary_manager_revoked'
  and primary_grant_id=new.primary_grant_id and (tg_op='INSERT' or new.primary_revoked_at is null)) then
  raise exception 'Form primary authority generation is suppressed' using errcode='42501'; end if;
 return new;
end $$;
revoke all on function public.guard_form_primary_manager_suppression() from public,anon,authenticated,service_role;
create trigger organization_form_primary_manager_guard before insert or update on public.organization_forms
 for each row execute function public.guard_form_primary_manager_suppression();

create function public.capture_form_primary_manager_suppression() returns trigger
 language plpgsql security definer set search_path='' as $$
begin
 if old.primary_revoked_at is null then
  if tg_op='DELETE' then
   perform public.record_form_primary_manager_suppression(old,clock_timestamp()); return old;
  elsif new.primary_grant_id is distinct from old.primary_grant_id then
   perform public.record_form_primary_manager_suppression(old,clock_timestamp());
  elsif new.primary_revoked_at is not null then
   perform public.record_form_primary_manager_suppression(old,new.primary_revoked_at);
  end if;
 end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end $$;
revoke all on function public.capture_form_primary_manager_suppression() from public,anon,authenticated,service_role;
create trigger organization_form_primary_manager_capture after update or delete on public.organization_forms
 for each row execute function public.capture_form_primary_manager_suppression();

create or replace function public.revoke_form_access_on_membership_loss() returns trigger
 language plpgsql security definer set search_path='' as $$
declare target uuid;
begin
 -- Actual owners keep identity-based organization authority regardless of a
 -- redundant membership row. Their form rights still require explicit grants.
 if old.member_id=old.org_id then
   if tg_op='DELETE' then return old; else return new; end if;
 end if;
 if tg_op='UPDATE' and new.org_id=old.org_id and new.member_id=old.member_id
   and new.role in ('owner','admin','staff') then return new; end if;
 for target in select f.id from public.organization_forms f where f.org_id=old.org_id
   and (f.intake_manager=old.member_id or exists(select 1 from public.organization_form_reviewers g where g.org_id=f.org_id and g.form_id=f.id
     and (g.member_id=old.member_id or g.granted_by=old.member_id or f.intake_manager=old.member_id))
     or (f.intake_manager=old.member_id and exists(select 1 from public.organization_form_viewer_invitations g
       where g.org_id=f.org_id and g.form_id=f.id and g.revoked_at is null))) order by f.id for update of f loop
   update public.organization_form_viewer_invitations set revoked_at=clock_timestamp()
     where org_id=old.org_id and form_id=target and revoked_at is null
       and exists(select 1 from public.organization_forms f where f.org_id=old.org_id and f.id=target and f.intake_manager=old.member_id);
   delete from public.organization_form_reviewers where org_id=old.org_id and form_id=target
     and (member_id=old.member_id or granted_by=old.member_id
       or exists(select 1 from public.organization_forms f where f.org_id=old.org_id and f.id=target and f.intake_manager=old.member_id));
   update public.organization_forms set access_revision=access_revision+1,
    primary_revoked_at=case when intake_manager=old.member_id and primary_revoked_at is null
     then clock_timestamp() else primary_revoked_at end where org_id=old.org_id and id=target;
 end loop;
 if tg_op='DELETE' then return old; else return new; end if;
end; $$;
revoke all on function public.revoke_form_access_on_membership_loss() from public,anon,authenticated,service_role;

create or replace function public.organization_form_recovery_before_closure(p_actor_id uuid,p_command jsonb) returns jsonb
 language plpgsql security definer set search_path='' as $$
<<recovery>>
declare
 target_org uuid; page_id uuid:=(p_command->>'pageId')::uuid; form_id uuid:=(p_command->>'formId')::uuid;
 action text:=p_command->>'action'; manager uuid; member_role text; current_form public.organization_forms%rowtype;
 previous public.organization_form_recoveries%rowtype; rows jsonb; total integer;
begin
 if page_id is not null then
   if p_command->>'organizationId' is not null then raise exception 'Ambiguous recovery target' using errcode='22023'; end if;
   select org_id into target_org from public.organization_workspace_pages where id=page_id;
 else
   target_org:=(p_command->>'organizationId')::uuid;
   if target_org is null or form_id is null then raise exception 'Recovery target required' using errcode='22023'; end if;
 end if;
 if target_org is null or p_actor_id is distinct from target_org then
   if action='recoverable_forms' then return jsonb_build_object('forms','[]'::jsonb,'next',null); end if;
   raise exception 'Organization owner required' using errcode='42501';
 end if;
 -- Serialize recovery with publication/intake and fence membership insertion via its org FK.
 -- Existing membership role edits are fenced by the membership SHARE lock below.
 perform 1 from public.organizations where user_id=target_org for update;
 if not found then raise exception 'Form recovery unavailable' using errcode='42501'; end if;
 if action='recoverable_forms' then
   select coalesce(jsonb_agg(to_jsonb(t) order by t.id),'[]'),count(*) into rows,total from (
     select f.id, f.manager_revision as revision,
       case when recovery.page_id is not null then
         (select v.version->>'title' from public.organization_form_versions v
           where v.org_id=f.org_id and v.form_id=f.id and v.page_id=recovery.page_id order by v.created_at desc,v.id desc limit 1)
       else (select s.content->>'title' from public.organization_workspace_boards b
         cross join lateral public.workspace_form_sources(b.state) s
         where b.org_id=f.org_id and s.id=f.id limit 1) end as title
     from public.organization_forms f
     where f.org_id=target_org and (f.intake_manager<>target_org or f.primary_revoked_at is not null)
       and (p_command->>'after' is null or f.id>(p_command->>'after')::uuid)
       and (f.primary_revoked_at is not null or not exists(select 1 from public.organization_memberships m where m.org_id=f.org_id and m.member_id=f.intake_manager and m.role in ('owner','admin','staff')))
       and ((recovery.page_id is not null and exists(select 1 from public.organization_form_versions v where v.org_id=f.org_id and v.form_id=f.id and v.page_id=recovery.page_id))
         or (recovery.page_id is null and f.id=recovery.form_id and exists(
           select 1 from public.organization_workspace_boards b cross join lateral public.workspace_form_sources(b.state) s
           where b.org_id=f.org_id and s.id=f.id)))
     order by f.id limit 50
   ) t;
   return jsonb_build_object('forms',rows,'next',case when total=50 then rows->49->>'id' else null end);
 end if;
 if action is distinct from 'recover_form' or form_id is null or p_command->>'operationId' is null
   or coalesce((p_command->>'expectedRevision')::integer,0)<1 then
   raise exception 'Invalid recovery request' using errcode='22023'; end if;
 select intake_manager into manager from public.organization_forms where org_id=target_org and id=form_id;
 if not found then raise exception 'Form recovery unavailable' using errcode='42501'; end if;
 select role into member_role from public.organization_memberships where org_id=target_org and member_id=manager for share;
 if page_id is not null then
   perform 1 from public.organization_workspace_pages where id=page_id and org_id=target_org for share;
   if not found or not exists(select 1 from public.organization_form_versions v where v.org_id=target_org and v.form_id=recovery.form_id and v.page_id=recovery.page_id) then
     raise exception 'Form recovery unavailable' using errcode='42501'; end if;
 else
   -- Match the source-writer lock order: board before form. Never recover a deleted source.
   perform 1 from public.organization_workspace_boards where org_id=target_org for share;
   if not exists(select 1 from public.organization_workspace_boards b cross join lateral public.workspace_form_sources(b.state) s
     where b.org_id=target_org and s.id=recovery.form_id) then
     raise exception 'Form source unavailable' using errcode='42501'; end if;
 end if;
 select * into current_form from public.organization_forms f where f.org_id=target_org and f.id=form_id for update;
 select * into previous from public.organization_form_recoveries r where r.org_id=target_org and r.operation_id=(p_command->>'operationId')::uuid;
 if found then
   if previous.actor_id<>p_actor_id or previous.form_id<>form_id or previous.page_id is distinct from page_id
     or previous.expected_revision<>(p_command->>'expectedRevision')::integer then
     raise exception 'Recovery identity reused' using errcode='23505'; end if;
   return jsonb_build_object('formId',form_id,'operationId',previous.operation_id,'revision',previous.revision);
 end if;
 if current_form.manager_revision<>(p_command->>'expectedRevision')::integer or current_form.intake_manager is distinct from manager then
   raise exception 'Form manager changed' using errcode='40001'; end if;
 if current_form.primary_revoked_at is null and (manager=target_org or member_role in ('owner','admin','staff')) then
   raise exception 'Form manager still active' using errcode='42501'; end if;
 update public.organization_forms f set intake_manager=p_actor_id,manager_revision=f.manager_revision+1
   where f.org_id=target_org and f.id=form_id returning * into current_form;
 insert into public.organization_form_recoveries(org_id,operation_id,form_id,page_id,actor_id,previous_manager,expected_revision,revision)
   values(target_org,(p_command->>'operationId')::uuid,form_id,page_id,p_actor_id,manager,(p_command->>'expectedRevision')::integer,current_form.manager_revision);
 return jsonb_build_object('formId',form_id,'operationId',p_command->>'operationId','revision',current_form.manager_revision);
end; $$;
revoke all on function public.organization_form_recovery_before_closure(uuid,jsonb) from public,anon,authenticated,service_role;
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
 -- A disabled/replaced transition or membership hook must never attest that
 -- all currently supported invalidations are being captured. Column lists
 -- matter: an UPDATE-only trigger with the wrong columns is not equivalent.
 if not exists(select 1 from pg_catalog.pg_trigger t
  where t.tgrelid='public.organization_forms'::regclass
   and t.tgname='organization_form_manager_invalidation'
   and t.tgfoid='public.invalidate_form_dependents_on_manager_change()'::regprocedure
   and t.tgenabled in ('O','A') and t.tgtype::integer=17 and not t.tgisinternal
   and t.tgqual is null and t.tgnargs=0 and cardinality(t.tgattr::smallint[])=2
   and (select count(*) from pg_catalog.pg_attribute a
     where a.attrelid=t.tgrelid and a.attnum=any(t.tgattr::smallint[])
      and a.attname in ('intake_manager','manager_revision'))=2)
  or not exists(select 1 from pg_catalog.pg_trigger t
   where t.tgrelid='public.organization_memberships'::regclass
    and t.tgname='organization_form_membership_loss'
    and t.tgfoid='public.revoke_form_access_on_membership_loss()'::regprocedure
    and t.tgenabled in ('O','A') and t.tgtype::integer=27 and not t.tgisinternal
    and t.tgqual is null and t.tgnargs=0 and cardinality(t.tgattr::smallint[])=3
    and (select count(*) from pg_catalog.pg_attribute a
      where a.attrelid=t.tgrelid and a.attnum=any(t.tgattr::smallint[])
       and a.attname in ('role','org_id','member_id'))=3) then
  raise exception 'Manager invalidation capture boundary unavailable' using errcode='42501'; end if;
 if exists(select 1 from public.organization_suppression_events where kind='form_reviewer_revoked'
  and reviewer_generation_id is distinct from capture.reviewer_generation_id) then
  raise exception 'Reviewer generation lineage conflicts' using errcode='40001'; end if;
 -- Capture alone cannot attest access suppression. The follow-up authority
 -- migration installs this helper and every direct predicate atomically.
 if pg_catalog.to_regprocedure('public.is_active_organization_form_primary(uuid,uuid,uuid)') is null then
  raise exception 'Primary manager authority fence unavailable' using errcode='42501'; end if;
 if exists(select 1 from (values
  ('organization_form_primary_manager_capture'::text,'public.capture_form_primary_manager_suppression()'::regprocedure,25),
  ('organization_form_primary_manager_guard','public.guard_form_primary_manager_suppression()'::regprocedure,23)) required(name,procedure,mask)
  where not exists(select 1 from pg_catalog.pg_trigger t where t.tgrelid='public.organization_forms'::regclass
   and t.tgname=required.name and t.tgfoid=required.procedure and t.tgenabled in ('O','A')
   and t.tgtype::integer=required.mask and not t.tgisinternal
   and t.tgqual is null and t.tgnargs=0 and cardinality(t.tgattr::smallint[])=0)) then
  raise exception 'Primary manager suppression boundary unavailable' using errcode='42501'; end if;
 if exists(select 1 from public.organization_suppression_events where kind='form_primary_manager_revoked'
  and primary_manager_generation_id is distinct from capture.primary_manager_generation_id) then
  raise exception 'Primary manager generation lineage conflicts' using errcode='40001'; end if;
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

create or replace function public.replay_organization_suppression_history(p_manifest text,p_expected_sha256 text)
 returns jsonb language plpgsql security invoker set search_path='' set timezone='UTC' as $$
declare manifest jsonb; before_snapshot jsonb; entry jsonb; payload jsonb; latest jsonb;
 org uuid; operation uuid; event_version uuid; form uuid; response uuid; rev integer; seq bigint; prefix bigint;
 happened timestamptz; requested timestamptz; deadline timestamptz; submitted timestamptz;
 closure public.organization_closures%rowtype; deletion public.organization_form_response_deletions%rowtype;
 answer public.organization_form_responses%rowtype; invitation public.organization_form_viewer_invitations%rowtype; reviewer public.organization_form_reviewers%rowtype; primary_form public.organization_forms%rowtype; applied integer:=0;
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
  public.organization_forms,public.organization_form_viewer_invitations,public.organization_form_reviewers,
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
   or entry->>'kind' is null or entry->>'kind' not in ('closure_request','closure_cancel','response_deleted','form_invitation_revoked','form_reviewer_revoked','form_primary_manager_revoked') then
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
  elsif entry->>'kind'='form_invitation_revoked' then
   if payload-'invitation'<>'{}'::jsonb or jsonb_typeof(payload->'invitation') is distinct from 'object'
    or (payload->'invitation')-'formId'-'invitationId'-'parentInvitationId'-'permission'-'createdAt'<>'{}'::jsonb
    or jsonb_typeof(payload#>'{invitation,formId}') is distinct from 'string'
    or payload#>>'{invitation,invitationId}' is distinct from entry->>'operationId'
    or not ((payload->'invitation') ? 'parentInvitationId')
    or jsonb_typeof(payload#>'{invitation,parentInvitationId}') not in ('null','string')
    or payload#>>'{invitation,permission}' is null
    or payload#>>'{invitation,permission}' not in ('view','correct','edit','manage')
    or jsonb_typeof(payload#>'{invitation,createdAt}') is distinct from 'string'
    or (payload#>>'{invitation,createdAt}')!~'(Z|[+-]00:00)$' then
    raise exception 'Invalid invitation suppression event' using errcode='22023'; end if;
   form:=(payload#>>'{invitation,formId}')::uuid;
   submitted:=(payload#>>'{invitation,createdAt}')::timestamptz;
   if not isfinite(submitted) or submitted>happened
    or (payload#>>'{invitation,parentInvitationId}')::uuid=operation
    or not exists(select 1 from public.organization_forms where org_id=org and id=form) then
    raise exception 'Invitation source history unavailable' using errcode='40001'; end if;
  elsif entry->>'kind'='form_reviewer_revoked' then
   if payload-'reviewer'<>'{}'::jsonb or jsonb_typeof(payload->'reviewer') is distinct from 'object'
    or (payload->'reviewer')-'formId'-'generationId'-'grantId'-'permission'-'createdAt'<>'{}'::jsonb
    or jsonb_typeof(payload#>'{reviewer,formId}') is distinct from 'string'
    or jsonb_typeof(payload#>'{reviewer,generationId}') is distinct from 'string'
    or payload#>>'{reviewer,grantId}' is distinct from entry->>'operationId'
    or payload#>>'{reviewer,permission}' is null or payload#>>'{reviewer,permission}' not in ('view','edit','manage')
    or jsonb_typeof(payload#>'{reviewer,createdAt}') is distinct from 'string'
    or (payload#>>'{reviewer,createdAt}')!~'(Z|[+-]00:00)$' then
    raise exception 'Invalid reviewer suppression event' using errcode='22023'; end if;
   -- Before prefix skipping or absent-row replay: installing this migration
   -- after restoring an older backup must not silently regenerate authority.
   if not exists(select 1 from public.organization_suppression_capture_state where singleton
    and reviewer_generation_id=(payload#>>'{reviewer,generationId}')::uuid) then
    raise exception 'Reviewer generation lineage conflicts' using errcode='40001'; end if;
   form:=(payload#>>'{reviewer,formId}')::uuid;
   submitted:=(payload#>>'{reviewer,createdAt}')::timestamptz;
   if not isfinite(submitted) or submitted>happened
    or not exists(select 1 from public.organization_forms where org_id=org and id=form) then
    raise exception 'Reviewer source history unavailable' using errcode='40001'; end if;
  elsif entry->>'kind'='form_primary_manager_revoked' then
   if payload-'primaryManager'<>'{}'::jsonb or jsonb_typeof(payload->'primaryManager') is distinct from 'object'
    or (payload->'primaryManager')-'formId'-'generationId'-'grantId'-'createdAt'<>'{}'::jsonb
    or jsonb_typeof(payload#>'{primaryManager,formId}') is distinct from 'string'
    or jsonb_typeof(payload#>'{primaryManager,generationId}') is distinct from 'string'
    or payload#>>'{primaryManager,grantId}' is distinct from entry->>'operationId'
    or jsonb_typeof(payload#>'{primaryManager,createdAt}') is distinct from 'string'
    or (payload#>>'{primaryManager,createdAt}')!~'(Z|[+-]00:00)$' then
    raise exception 'Invalid primary manager suppression event' using errcode='22023'; end if;
   -- Before prefix skipping or absent-row replay: installing this migration
   -- after restoring an older backup must not silently regenerate authority.
   if not exists(select 1 from public.organization_suppression_capture_state where singleton
    and primary_manager_generation_id=(payload#>>'{primaryManager,generationId}')::uuid) then
    raise exception 'Primary manager generation lineage conflicts' using errcode='40001'; end if;
   form:=(payload#>>'{primaryManager,formId}')::uuid;
   submitted:=(payload#>>'{primaryManager,createdAt}')::timestamptz;
   if not isfinite(submitted) or submitted>happened
    or not exists(select 1 from public.organization_forms where org_id=org and id=form) then
    raise exception 'Primary manager source history unavailable' using errcode='40001'; end if;
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
  elsif entry->>'kind'='form_invitation_revoked' then
   select * into invitation from public.organization_form_viewer_invitations where id=operation;
   if found then
    if invitation.org_id<>org or invitation.form_id<>form or invitation.manager_revision<>rev
     or invitation.parent_invitation_id is distinct from (entry#>>'{invitation,parentInvitationId}')::uuid
     or invitation.response_permission is distinct from entry#>>'{invitation,permission}'
     or invitation.created_at is distinct from submitted or invitation.revoked_at is not null then
     raise exception 'Restored invitation conflicts with suppression' using errcode='40001'; end if;
    -- Revoke the exact row only. DELETE would cascade and manufacture extra events.
    update public.organization_form_viewer_invitations set revoked_at=happened where id=operation;
   else
    -- No actor/email is reconstructed when the invitation was absent in the backup.
    invitation.id:=operation; invitation.org_id:=org; invitation.form_id:=form;
    invitation.manager_revision:=rev; invitation.parent_invitation_id:=(entry#>>'{invitation,parentInvitationId}')::uuid;
    invitation.response_permission:=entry#>>'{invitation,permission}'; invitation.created_at:=submitted;
    perform public.record_form_invitation_suppression(invitation,happened);
   end if;
  elsif entry->>'kind'='form_reviewer_revoked' then
   select * into reviewer from public.organization_form_reviewers where grant_id=operation;
   if found then
    if reviewer.org_id<>org or reviewer.form_id<>form or reviewer.manager_revision<>rev
     or reviewer.role is distinct from entry#>>'{reviewer,permission}'
     or reviewer.created_at is distinct from submitted then
     raise exception 'Restored reviewer conflicts with suppression' using errcode='40001'; end if;
    -- Exact generation only. Canonical child cleanup emits its own events;
    -- sweeping by member/grantor would remove newer independent generations.
    delete from public.organization_form_reviewers where grant_id=operation;
   else
    -- Do not reconstruct an actor or missing lower-privilege/replacement grant.
    reviewer.grant_id:=operation; reviewer.org_id:=org; reviewer.form_id:=form;
    reviewer.manager_revision:=rev; reviewer.role:=entry#>>'{reviewer,permission}'; reviewer.created_at:=submitted;
    perform public.record_form_reviewer_suppression(reviewer,happened);
   end if;
  elsif entry->>'kind'='form_primary_manager_revoked' then
   select * into primary_form from public.organization_forms where primary_grant_id=operation;
   if found then
    if primary_form.org_id<>org or primary_form.id<>form or primary_form.manager_revision<>rev
     or primary_form.primary_granted_at is distinct from submitted or primary_form.primary_revoked_at is not null then
     raise exception 'Restored primary manager conflicts with suppression' using errcode='40001'; end if;
    update public.organization_forms set primary_revoked_at=happened where primary_grant_id=operation;
   else
    -- A newer generation is independent; no manager identity is reconstructed.
    primary_form.primary_grant_id:=operation; primary_form.org_id:=org; primary_form.id:=form;
    primary_form.manager_revision:=rev; primary_form.primary_granted_at:=submitted;
    perform public.record_form_primary_manager_suppression(primary_form,happened);
   end if;
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
  elsif entry->>'kind'='form_invitation_revoked' then
   select * into invitation from public.organization_form_viewer_invitations where id=operation;
   if found and (invitation.org_id<>org or invitation.form_id<>(entry#>>'{invitation,formId}')::uuid
    or invitation.manager_revision<>rev
    or invitation.parent_invitation_id is distinct from (entry#>>'{invitation,parentInvitationId}')::uuid
    or invitation.response_permission is distinct from entry#>>'{invitation,permission}'
    or invitation.created_at is distinct from (entry#>>'{invitation,createdAt}')::timestamptz
    or invitation.revoked_at is distinct from (entry->>'occurredAt')::timestamptz) then
    raise exception 'Restored invitation suppression does not match history' using errcode='40001'; end if;
  elsif entry->>'kind'='form_reviewer_revoked' then
   if exists(select 1 from public.organization_form_reviewers where grant_id=operation) then
    raise exception 'Restored reviewer generation remains active' using errcode='40001'; end if;
  elsif entry->>'kind'='form_primary_manager_revoked' then
   select * into primary_form from public.organization_forms where primary_grant_id=operation;
   if found and (primary_form.org_id<>org or primary_form.id<>(entry#>>'{primaryManager,formId}')::uuid
    or primary_form.manager_revision<>rev
    or primary_form.primary_granted_at is distinct from (entry#>>'{primaryManager,createdAt}')::timestamptz
    or primary_form.primary_revoked_at is distinct from (entry->>'occurredAt')::timestamptz) then
    raise exception 'Restored primary manager generation remains active or conflicts' using errcode='40001'; end if;
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
