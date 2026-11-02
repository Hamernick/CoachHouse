-- Offline restore mechanics only. No independent durable journal, activation,
-- application RPC grant or permission to reconnect a recovered database.
begin;
create table public.organization_restore_identity (
 singleton boolean primary key default true check(singleton),
 source_id uuid not null unique default gen_random_uuid()
);
insert into public.organization_restore_identity(singleton) values(true);
alter table public.organization_restore_identity enable row level security;
alter table public.organization_restore_identity force row level security;
revoke all on public.organization_restore_identity from public,anon,authenticated,service_role;
comment on table public.organization_restore_identity is
 'Opaque backup lineage binding. Must travel in the data backup; never regenerate it to accept an unrelated manifest. Not an independently durable suppression journal.';

create function public.replay_organization_closure_suppression(p_manifest text,p_expected_sha256 text)
 returns jsonb language plpgsql security invoker set search_path='' as $$
declare manifest jsonb; entry jsonb; org uuid; request uuid; rev integer;
 requested timestamptz; deadline timestamptz; prior public.organization_closures%rowtype;
 operation public.organization_closure_operations%rowtype; applied integer:=0; exact integer:=0;
begin
 -- Actual database admission is disabled before restore, outside the backup.
 -- This function deliberately has no path that enables it again.
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
 if jsonb_typeof(manifest)<>'object' or manifest-'format'-'sourceId'-'closures'<>'{}'::jsonb
  or manifest->>'format' is distinct from 'coach-house-closure-suppression-v1'
  or jsonb_typeof(manifest->'sourceId') is distinct from 'string'
  or jsonb_typeof(manifest->'closures') is distinct from 'array' then
  raise exception 'Invalid suppression manifest' using errcode='22023'; end if;
 if not exists(select 1 from public.organization_restore_identity where singleton and source_id=(manifest->>'sourceId')::uuid)
  or jsonb_array_length(manifest->'closures') not between 1 and 1000 then
  raise exception 'Suppression source or entries unavailable' using errcode='22023'; end if;
 -- Locks protect the complete replay even if another privileged session was
 -- already waiting when quarantine was established. Such a session is denied above.
 lock table public.organizations,public.organization_closures,public.organization_closure_operations in access exclusive mode nowait;
 if exists(select 1 from unnest(array[
   'organization_closure_publication','organization_closure_board',
   'organization_closure_pending_access','fiscal_delivery_shutdown',
   'organization_closure_cancel_ai','organization_closure_calendar_access',
   'organization_closure_disable_ai_billing','organization_closure_public_flags'
  ]) required(name) where not exists(select 1 from pg_catalog.pg_trigger t
   where t.tgrelid='public.organization_closures'::regclass and t.tgname=required.name
    and t.tgenabled in ('O','A') and (t.tgtype::integer & 5)=5 and not t.tgisinternal)) then
  raise exception 'Required closure shutdown triggers unavailable' using errcode='42501'; end if;
 if (select count(distinct (value->>'organizationId')::uuid) from jsonb_array_elements(manifest->'closures'))
  <>jsonb_array_length(manifest->'closures') then
  raise exception 'Duplicate suppression organization' using errcode='22023'; end if;
 for entry in select value from jsonb_array_elements(manifest->'closures') order by value->>'organizationId' loop
  if jsonb_typeof(entry)<>'object'
   or entry-'organizationId'-'requestId'-'revision'-'requestedAt'-'exportUntil'<>'{}'::jsonb
   or jsonb_typeof(entry->'organizationId') is distinct from 'string'
   or jsonb_typeof(entry->'requestId') is distinct from 'string'
   or jsonb_typeof(entry->'revision') is distinct from 'number'
   or jsonb_typeof(entry->'requestedAt') is distinct from 'string'
   or jsonb_typeof(entry->'exportUntil') is distinct from 'string'
   or (entry->>'revision')!~'^[1-9][0-9]*$'
   or (entry->>'requestedAt')!~'(Z|[+-]00:00)$' or (entry->>'exportUntil')!~'(Z|[+-]00:00)$' then
   raise exception 'Invalid suppression entry' using errcode='22023'; end if;
  org:=(entry->>'organizationId')::uuid; request:=(entry->>'requestId')::uuid;
  rev:=(entry->>'revision')::integer; requested:=(entry->>'requestedAt')::timestamptz;
  deadline:=(entry->>'exportUntil')::timestamptz;
  if not isfinite(requested) or not isfinite(deadline) or requested>clock_timestamp()
   or deadline<>requested+interval '720 hours'
   or not exists(select 1 from public.organizations where user_id=org) then
   raise exception 'Suppression identity or deadline invalid' using errcode='22023'; end if;
  select * into prior from public.organization_closures where org_id=org;
  if found then
   if prior.state='closing' and prior.revision=rev and prior.request_id=request
    and prior.requested_at=requested and prior.export_until=deadline then
    exact:=exact+1;
   else
    -- Active history may contain cancellation/revocations absent from this
    -- snapshot. Never guess, reclose canceled work or shorten another request.
    raise exception 'Closure history requires independent reconciliation' using errcode='40001';
   end if;
  else
   if exists(select 1 from public.organization_closure_operations where org_id=org) then
    raise exception 'Closure history requires independent reconciliation' using errcode='40001'; end if;
   insert into public.organization_closures(org_id,state,revision,request_id,requested_at,export_until)
    values(org,'closing',rev,request,requested,deadline);
   -- Existing canonical shutdown triggers withdraw publication, access and
   -- queued work atomically. They retain shared identities and external files.
   applied:=applied+1;
  end if;
  select * into operation from public.organization_closure_operations where org_id=org and operation_id=request;
  if found then
   if operation.action<>'request' or operation.expected_revision<>rev-1 then
    raise exception 'Suppression operation conflicts' using errcode='40001'; end if;
  else
   insert into public.organization_closure_operations(org_id,operation_id,action,expected_revision,completed_at)
    values(org,request,'request',rev-1,requested);
  end if;
 end loop;
 return jsonb_build_object('quarantined',true,'applied',applied,'exact',exact,
  'sourceId',manifest->>'sourceId','sha256',p_expected_sha256,'releaseQualified',false);
end $$;
revoke all on function public.replay_organization_closure_suppression(text,text) from public,anon,authenticated,service_role;
comment on function public.replay_organization_closure_suppression(text,text) is
 'Trusted offline operator only, with actual database connections disabled and no other sessions. Replays supported closing snapshots through shutdown triggers; never opens access. Pinned digest proves identity, not freshness, completeness, durable collection, deletion replay or hosted recovery.';
commit;
