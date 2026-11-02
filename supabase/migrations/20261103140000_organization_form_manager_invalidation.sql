-- Materialize dependent grant invalidation at the existing manager boundary.
-- Exact invitation/reviewer capture and quarantined replay remain unchanged.
-- No historical backfill, primary-manager reconstruction or release activation.
begin;
lock table public.organization_forms in share row exclusive mode;

create function public.invalidate_form_dependents_on_manager_change() returns trigger
 language plpgsql security definer set search_path='' as $$
begin
 if new.intake_manager is not distinct from old.intake_manager
  and new.manager_revision is not distinct from old.manager_revision then
  return new;
 end if;
 -- The canonical writer already holds the form row after membership/board
 -- locks. Never take an organization or membership lock from this trigger.
 -- Existing capture hooks retire exact IDs/generations in this transaction.
 -- Failure to append capture rolls the entire manager transition back.
 update public.organization_form_viewer_invitations set revoked_at=clock_timestamp()
  where org_id=new.org_id and form_id=new.id and revoked_at is null
   and (manager_revision<>new.manager_revision
    or new.intake_manager is distinct from old.intake_manager);
 delete from public.organization_form_reviewers
  where org_id=new.org_id and form_id=new.id
   and (manager_revision<>new.manager_revision
    or new.intake_manager is distinct from old.intake_manager);
 return new;
end $$;
revoke all on function public.invalidate_form_dependents_on_manager_change()
 from public,anon,authenticated,service_role;
create trigger organization_form_manager_invalidation
 after update of intake_manager,manager_revision on public.organization_forms
 for each row execute function public.invalidate_form_dependents_on_manager_change();
comment on function public.invalidate_form_dependents_on_manager_change() is
 'Materializes current manager-transition dependent-grant invalidations using exact suppression events. No primary-manager identity replay, historical reconstruction, membership-derived response access or release qualification.';

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
