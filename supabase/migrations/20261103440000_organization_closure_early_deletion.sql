-- Private operator-attested rehearsal only. No hosted owner-consent UI or API
-- execution grant. Original requested_at/export_until/revision never change.
begin;
create table public.organization_closure_early_deletions(
 org_id uuid not null,closure_request_id uuid not null,closure_revision integer not null check(closure_revision>0),
 confirmation_id uuid not null,owner_id uuid not null,owner_confirmed boolean not null check(owner_confirmed),
 consequences_version text not null check(consequences_version='organization-early-deletion-v1'),
 confirmed_at timestamptz not null check(isfinite(confirmed_at)),
 primary key(org_id,closure_request_id),unique(org_id,confirmation_id),check(owner_id=org_id)
);
alter table public.organization_closure_early_deletions enable row level security;
revoke all on public.organization_closure_early_deletions from public,anon,authenticated,service_role;
create function public.reject_organization_early_deletion_mutation() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'Early deletion confirmation is irreversible' using errcode='42501';end $$;
revoke all on function public.reject_organization_early_deletion_mutation() from public,anon,authenticated,service_role;
create trigger early_deletion_immutable before update or delete on public.organization_closure_early_deletions for each row execute function public.reject_organization_early_deletion_mutation();
create trigger early_deletion_retained before truncate on public.organization_closure_early_deletions for each statement execute function public.reject_organization_early_deletion_mutation();

alter table public.organization_suppression_events add column early_deletion jsonb;
do $migration$ declare old_shape text;other_fields text;begin
 select pg_get_constraintdef(oid) into strict old_shape from pg_constraint where conrelid='public.organization_suppression_events'::regclass and conname='organization_suppression_events_check';
 alter table public.organization_suppression_events drop constraint organization_suppression_events_kind_check;
 alter table public.organization_suppression_events add constraint organization_suppression_events_kind_check check(kind in('closure_request','closure_cancel','response_deleted','form_invitation_revoked','form_reviewer_revoked','form_primary_manager_revoked','workspace_page_invitation_revoked','workspace_page_note_scope_revoked','workspace_page_access_revoked','closure_early_delete_confirmed'));
 alter table public.organization_suppression_events drop constraint organization_suppression_events_check;
 execute 'alter table public.organization_suppression_events add constraint organization_suppression_events_check CHECK ((early_deletion is null and '||substring(old_shape from 7)||') or (kind=''closure_early_delete_confirmed'' and early_deletion is not null))';
 select string_agg(format('%I is null',attname),' and ') into other_fields from pg_attribute where attrelid='public.organization_suppression_events'::regclass and attnum>0 and not attisdropped and attname<>all(array['sequence','event_id','kind','organization_id','operation_id','revision','occurred_at','early_deletion']);
 execute 'alter table public.organization_suppression_events add constraint suppression_early_deletion_shape check(kind<>''closure_early_delete_confirmed'' or ('||other_fields||' and jsonb_typeof(early_deletion)=''object''))';
end $migration$;
create unique index organization_suppression_early_identity on public.organization_suppression_events(organization_id,operation_id) where kind='closure_early_delete_confirmed';
alter function public.organization_suppression_event_json(public.organization_suppression_events) rename to organization_suppression_event_json_before_early;
create function public.organization_suppression_event_json(e public.organization_suppression_events) returns jsonb
 language sql immutable set search_path='' set timezone='UTC' as $$
 select public.organization_suppression_event_json_before_early(e)||case when e.kind='closure_early_delete_confirmed' then jsonb_build_object('earlyDeletion',e.early_deletion) else '{}'::jsonb end
$$;
revoke all on function public.organization_suppression_event_json(public.organization_suppression_events),public.organization_suppression_event_json_before_early(public.organization_suppression_events) from public,anon,authenticated,service_role;
create function public.validate_organization_early_deletion_event(e jsonb) returns void
 language plpgsql set search_path='' as $$
declare item jsonb:=e->'earlyDeletion';stamp timestamptz;
begin
 if e-array['sequence','eventId','kind','organizationId','operationId','revision','occurredAt','earlyDeletion']<>'{}'::jsonb
  or e->>'kind' is distinct from 'closure_early_delete_confirmed' or jsonb_typeof(item) is distinct from 'object'
  or item-array['closureRequestId','ownerId','consequencesVersion','confirmedAt']<>'{}'::jsonb
  or jsonb_typeof(item->'closureRequestId') is distinct from 'string'
  or item->>'ownerId' is distinct from e->>'organizationId'
  or item->>'consequencesVersion' is distinct from 'organization-early-deletion-v1'
  or jsonb_typeof(item->'confirmedAt') is distinct from 'string' or (item->>'confirmedAt')!~'(Z|[+-]00:00)$' then
  raise exception 'Invalid early deletion suppression event' using errcode='22023';end if;
 perform (item->>'closureRequestId')::uuid;perform (item->>'ownerId')::uuid;
 stamp:=(item->>'confirmedAt')::timestamptz;
 if not isfinite(stamp) or stamp is distinct from (e->>'occurredAt')::timestamptz then raise exception 'Invalid early deletion capture time' using errcode='22023';end if;
end $$;
revoke all on function public.validate_organization_early_deletion_event(jsonb) from public,anon,authenticated,service_role;

create function public.capture_organization_early_deletion() returns trigger
 language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare closure public.organization_closures;c public.organization_suppression_capture_state;expected jsonb;emitted public.organization_suppression_events;event_uuid uuid:=gen_random_uuid();
begin
 if coalesce(nullif(current_setting('role',true),'none'),session_user)<>session_user or not exists(select 1 from pg_roles where rolname=session_user and rolsuper)
  or current_setting('transaction_isolation')<>'read committed' or current_setting('session_replication_role')<>'origin' then raise exception 'Actual early deletion operator required' using errcode='42501';end if;
 perform 1 from public.organizations where user_id=new.org_id for update;
 select * into closure from public.organization_closures where org_id=new.org_id;
 if not found or closure.state<>'closing' or closure.request_id is distinct from new.closure_request_id or closure.revision<>new.closure_revision
  or closure.export_until is distinct from closure.requested_at+interval '720 hours'
  or new.confirmed_at<closure.requested_at or new.confirmed_at>=closure.export_until or new.confirmed_at>clock_timestamp() then raise exception 'Early deletion request identity or time changed' using errcode='40001';end if;
 select expected_event into expected from public.organization_suppression_replay_context where backend_pid=pg_backend_pid() and transaction_id=txid_current();
 if found then
  if exists(select 1 from pg_database where datname=current_database() and datallowconn) then raise exception 'Offline early deletion replay required' using errcode='42501';end if;
  event_uuid:=(expected->>'eventId')::uuid;
 end if;
 begin select * into strict c from public.organization_suppression_capture_state where singleton for update nowait;
 exception when lock_not_available then raise exception 'Suppression capture busy; retry transaction' using errcode='40001';end;
 if not exists(select 1 from public.organization_restore_identity where singleton and source_id=c.source_id) then raise exception 'Suppression source identity changed' using errcode='40001';end if;
 update public.organization_suppression_capture_state set high_water=high_water+1 where singleton returning high_water into c.high_water;
 insert into public.organization_suppression_events(sequence,event_id,kind,organization_id,operation_id,revision,occurred_at,early_deletion)
 values(c.high_water,event_uuid,'closure_early_delete_confirmed',new.org_id,new.confirmation_id,new.closure_revision,new.confirmed_at,
  jsonb_build_object('closureRequestId',new.closure_request_id,'ownerId',new.owner_id,'consequencesVersion',new.consequences_version,'confirmedAt',new.confirmed_at)) returning * into emitted;
 perform public.validate_organization_early_deletion_event(public.organization_suppression_event_json(emitted));
 if expected is not null and public.organization_suppression_event_json(emitted)<>expected then raise exception 'Early deletion replay differs from retained evidence' using errcode='40001';end if;
 return new;
end $$;
revoke all on function public.capture_organization_early_deletion() from public,anon,authenticated,service_role;
create trigger a_organization_read_only_boundary before insert on public.organization_closure_early_deletions for each row execute function public.guard_organization_read_only_boundary();
create trigger early_deletion_capture after insert on public.organization_closure_early_deletions for each row execute function public.capture_organization_early_deletion();
create function public.guard_irreversible_organization_closure() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.organization_closure_early_deletions where org_id=old.org_id and closure_request_id=old.request_id)
  and (tg_op='DELETE' or to_jsonb(new) is distinct from to_jsonb(old)) then raise exception 'Confirmed early deletion cannot be canceled or changed' using errcode='42501';end if;
 if tg_op='DELETE' then return old;end if;return new;
end $$;
revoke all on function public.guard_irreversible_organization_closure() from public,anon,authenticated,service_role;
create trigger organization_early_deletion_irreversible before update or delete on public.organization_closures for each row execute function public.guard_irreversible_organization_closure();

alter function public.read_organization_suppression_events() rename to read_organization_suppression_events_before_early;
create function public.read_organization_suppression_events() returns jsonb
 language plpgsql security invoker set search_path='' set timezone='UTC' as $$
declare result jsonb;entry jsonb;
begin
 if exists(select 1 from(values
  ('organization_closure_early_deletions','a_organization_read_only_boundary','public.guard_organization_read_only_boundary()'::regprocedure,7),
  ('organization_closure_early_deletions','early_deletion_capture','public.capture_organization_early_deletion()'::regprocedure,5),
  ('organization_closure_early_deletions','early_deletion_immutable','public.reject_organization_early_deletion_mutation()'::regprocedure,27),
  ('organization_closure_early_deletions','early_deletion_retained','public.reject_organization_early_deletion_mutation()'::regprocedure,34),
  ('organization_closures','organization_early_deletion_irreversible','public.guard_irreversible_organization_closure()'::regprocedure,27)
 ) required(relation,name,procedure,mask) where not exists(select 1 from pg_trigger t where t.tgrelid=to_regclass('public.'||required.relation)
  and t.tgname=required.name and t.tgfoid=required.procedure and t.tgtype::integer=required.mask and t.tgenabled in('O','A') and not t.tgisinternal and t.tgqual is null and t.tgnargs=0 and cardinality(t.tgattr::smallint[])=0)) then
  raise exception 'Early deletion capture boundary unavailable' using errcode='42501';end if;
 result:=public.read_organization_suppression_events_before_early();
 for entry in select value from jsonb_array_elements(result->'events') where value->>'kind'='closure_early_delete_confirmed' loop
  perform public.validate_organization_early_deletion_event(entry);
  if not exists(select 1 from public.organization_closure_early_deletions where org_id=(entry->>'organizationId')::uuid
   and closure_request_id=(entry#>>'{earlyDeletion,closureRequestId}')::uuid and closure_revision=(entry->>'revision')::integer
   and confirmation_id=(entry->>'operationId')::uuid and owner_id=(entry#>>'{earlyDeletion,ownerId}')::uuid
   and consequences_version=entry#>>'{earlyDeletion,consequencesVersion}' and confirmed_at=(entry->>'occurredAt')::timestamptz) then
   raise exception 'Early deletion capture requires reconciliation' using errcode='40001';end if;
 end loop;
 if (select count(*) from public.organization_closure_early_deletions)<>(select count(*) from public.organization_suppression_events where kind='closure_early_delete_confirmed') then raise exception 'Early deletion capture incomplete' using errcode='40001';end if;
 return result;
end $$;
revoke all on function public.read_organization_suppression_events(),public.read_organization_suppression_events_before_early() from public,anon,authenticated,service_role;

create function public.organization_closure_cleanup_due_at(p_org uuid,p_request uuid,p_revision integer,p_at timestamptz) returns boolean
 language sql volatile security definer set search_path='' set timezone='UTC' as $$
 select isfinite(p_at) and exists(select 1 from public.organization_closures c where c.org_id=p_org and c.state='closing' and c.request_id=p_request and c.revision=p_revision
  and c.export_until=c.requested_at+interval '720 hours' and (p_at>=c.export_until or exists(
   select 1 from public.organization_closure_early_deletions e join public.organization_suppression_events j
    on j.kind='closure_early_delete_confirmed' and j.organization_id=e.org_id and j.operation_id=e.confirmation_id and j.revision=e.closure_revision and j.occurred_at=e.confirmed_at
    and j.early_deletion=jsonb_build_object('closureRequestId',e.closure_request_id,'ownerId',e.owner_id,'consequencesVersion',e.consequences_version,'confirmedAt',e.confirmed_at)
   where e.org_id=c.org_id and e.closure_request_id=c.request_id and e.closure_revision=c.revision and e.confirmed_at<=p_at)))
$$;
create or replace function public.organization_closure_cleanup_due(p_org uuid,p_request uuid,p_revision integer) returns boolean
 language sql volatile security definer set search_path='' as $$select public.organization_closure_cleanup_due_at(p_org,p_request,p_revision,clock_timestamp())$$;
revoke all on function public.organization_closure_cleanup_due_at(uuid,uuid,integer,timestamptz),public.organization_closure_cleanup_due(uuid,uuid,integer) from public,anon,authenticated,service_role;

create function public.confirm_organization_early_deletion(p_actor_id uuid,p_org_id uuid,p_closure_request_id uuid,p_expected_revision integer,p_confirmation_id uuid,p_consequences_version text,p_owner_confirmed boolean) returns jsonb
 language plpgsql security invoker set search_path='' as $$
declare closure public.organization_closures;prior public.organization_closure_early_deletions;stamp timestamptz;
begin
 if session_user<>current_user or not exists(select 1 from pg_roles where rolname=current_user and rolsuper)
  or current_setting('transaction_isolation')<>'read committed' or current_setting('session_replication_role')<>'origin' then raise exception 'Actual early deletion operator required' using errcode='42501';end if;
 if p_actor_id is null or p_actor_id is distinct from p_org_id or p_closure_request_id is null or p_confirmation_id is null or p_expected_revision is null or p_expected_revision<1
  or p_consequences_version is distinct from 'organization-early-deletion-v1' or p_owner_confirmed is distinct from true then raise exception 'Explicit exact owner confirmation required' using errcode='42501';end if;
 perform 1 from public.organizations where user_id=p_org_id for update;
 if not found then raise exception 'Organization unavailable' using errcode='42501';end if;
 select * into closure from public.organization_closures where org_id=p_org_id;
 if not found or closure.state<>'closing' or closure.request_id is distinct from p_closure_request_id or closure.revision<>p_expected_revision
  or closure.export_until is distinct from closure.requested_at+interval '720 hours' then raise exception 'Closure identity changed' using errcode='40001';end if;
 perform public.read_organization_suppression_events();
 select * into prior from public.organization_closure_early_deletions where org_id=p_org_id and closure_request_id=p_closure_request_id;
 if found then
  if prior.confirmation_id<>p_confirmation_id or prior.closure_revision<>p_expected_revision or prior.owner_id<>p_actor_id or prior.consequences_version<>p_consequences_version then raise exception 'Early confirmation identity changed' using errcode='23505';end if;
 else
  stamp:=clock_timestamp();
  if stamp<closure.requested_at or stamp>=closure.export_until then raise exception 'Early confirmation window unavailable' using errcode='42501';end if;
  insert into public.organization_closure_early_deletions values(p_org_id,p_closure_request_id,p_expected_revision,p_confirmation_id,p_actor_id,true,p_consequences_version,stamp) returning * into prior;
  perform public.read_organization_suppression_events();
 end if;
 return jsonb_build_object('organizationId',p_org_id,'closureRequestId',p_closure_request_id,'closureRevision',p_expected_revision,'confirmationId',prior.confirmation_id,
  'consequencesVersion',prior.consequences_version,'confirmedAt',prior.confirmed_at,'originalExportUntil',closure.export_until,'effectiveExportUntil',prior.confirmed_at,'irreversible',true,'releaseQualified',false);
end $$;
revoke all on function public.confirm_organization_early_deletion(uuid,uuid,uuid,integer,uuid,text,boolean) from public,anon,authenticated,service_role;

-- The existing locked guard already feeds response export, private/calendar
-- reads and Storage SELECT. Existing issued URLs/HTTP are not recalled.
do $migration$ declare definition text;needle text;replacement text;target text;begin
 definition:=pg_get_functiondef('public.guard_organization_closure(uuid,boolean)'::regprocedure);
 needle:='if p_export_read is distinct from true or clock_timestamp()>=closure.export_until then';
 replacement:='if p_export_read is distinct from true or clock_timestamp()>=closure.export_until or exists(select 1 from public.organization_closure_early_deletions where org_id=p_org_id and closure_request_id=closure.request_id) then';
 if (length(definition)-length(replace(definition,needle,'')))/length(needle)<>1 then raise exception 'Unexpected export guard predecessor';end if;execute replace(definition,needle,replacement);
 definition:=pg_get_functiondef('public.organization_storage_link_deadline(uuid,integer)'::regprocedure);
 needle:='select export_until into deadline from public.organization_closures where org_id=p_org and state=''closing'';';
 replacement:='select least(c.export_until,e.confirmed_at) into deadline from public.organization_closures c left join public.organization_closure_early_deletions e on e.org_id=c.org_id and e.closure_request_id=c.request_id where c.org_id=p_org and c.state=''closing'';';
 if (length(definition)-length(replace(definition,needle,'')))/length(needle)<>1 then raise exception 'Unexpected link deadline predecessor';end if;execute replace(definition,needle,replacement);
 foreach target in array array['purge_expired_organization_form_responses','purge_expired_organization_research_drafts','purge_expired_organization_workspace_content','purge_expired_organization_core_content','purge_expired_organization_operating_content','purge_expired_organization_project_content','purge_expired_organization_ai_content','purge_expired_organization_external_documents','purge_expired_organization_profile_metadata'] loop
  definition:=pg_get_functiondef(('public.'||target||'(uuid,uuid,integer,uuid)')::regprocedure);
  needle:=case when target='purge_expired_organization_research_drafts' then 'clock_timestamp() < closure.export_until' else 'clock_timestamp()<closure.export_until' end;
  replacement:='not public.organization_closure_cleanup_due(p_org_id,p_closure_request_id,p_expected_closure_revision)';
  if (length(definition)-length(replace(definition,needle,'')))/length(needle)<>1 then raise exception 'Unexpected source cleanup predecessor: %',target;end if;execute replace(definition,needle,replacement);
 end loop;
 definition:=pg_get_functiondef('public.assert_expired_document_closure(uuid,uuid,integer)'::regprocedure);needle:='clock_timestamp()<closure.export_until';replacement:='not public.organization_closure_cleanup_due(p_org,p_request,p_revision)';
 if (length(definition)-length(replace(definition,needle,'')))/length(needle)<>1 then raise exception 'Unexpected document cleanup predecessor';end if;execute replace(definition,needle,replacement);
 foreach target in array array['closure_workspace_retirement_allowed(uuid)','closure_core_retirement_allowed(uuid,text,jsonb)','closure_operating_retirement_allowed(uuid)','closure_project_retirement_allowed(uuid)','closure_ai_retirement_allowed(uuid)','closure_external_retirement_allowed(uuid,text,uuid)','closure_profile_metadata_retirement_allowed(jsonb,jsonb)'] loop
  definition:=pg_get_functiondef(('public.'||target)::regprocedure);needle:='clock_timestamp()>=c.export_until';replacement:='public.organization_closure_cleanup_due(r.org_id,r.closure_request_id,r.closure_revision)';
  if (length(definition)-length(replace(definition,needle,'')))/length(needle)<>1 then raise exception 'Unexpected private cleanup marker: %',target;end if;execute replace(definition,needle,replacement);
 end loop;
end $migration$;

create function public.apply_organization_early_deletion_suppression(e jsonb) returns void
 language plpgsql security invoker set search_path='' as $$
begin
 perform public.validate_organization_early_deletion_event(e);
 if session_user<>current_user or not exists(select 1 from pg_roles where rolname=current_user and rolsuper)
  or exists(select 1 from pg_database where datname=current_database() and datallowconn)
  or not exists(select 1 from public.organization_suppression_replay_context where backend_pid=pg_backend_pid() and transaction_id=txid_current() and expected_event=e) then
  raise exception 'Exact offline early deletion replay required' using errcode='42501';end if;
 insert into public.organization_closure_early_deletions(org_id,closure_request_id,closure_revision,confirmation_id,owner_id,owner_confirmed,consequences_version,confirmed_at)
 values((e->>'organizationId')::uuid,(e#>>'{earlyDeletion,closureRequestId}')::uuid,(e->>'revision')::integer,(e->>'operationId')::uuid,
  (e#>>'{earlyDeletion,ownerId}')::uuid,true,e#>>'{earlyDeletion,consequencesVersion}',(e->>'occurredAt')::timestamptz);
end $$;
create function public.assert_organization_early_deletion_suppressed(e jsonb) returns void
 language plpgsql security invoker set search_path='' as $$
begin
 perform public.validate_organization_early_deletion_event(e);
 if not exists(select 1 from public.organization_closure_early_deletions d join public.organization_closures c on c.org_id=d.org_id
  where d.org_id=(e->>'organizationId')::uuid and d.closure_request_id=(e#>>'{earlyDeletion,closureRequestId}')::uuid
   and d.closure_revision=(e->>'revision')::integer and d.confirmation_id=(e->>'operationId')::uuid
   and d.owner_id=(e#>>'{earlyDeletion,ownerId}')::uuid and d.consequences_version=e#>>'{earlyDeletion,consequencesVersion}'
   and d.confirmed_at=(e->>'occurredAt')::timestamptz and c.state='closing' and c.request_id=d.closure_request_id and c.revision=d.closure_revision
   and public.organization_closure_cleanup_due_at(c.org_id,c.request_id,c.revision,d.confirmed_at)) then
  raise exception 'Restored early deletion differs from captured history' using errcode='40001';end if;
end $$;
revoke all on function public.apply_organization_early_deletion_suppression(jsonb),public.assert_organization_early_deletion_suppressed(jsonb) from public,anon,authenticated,service_role;

-- Add one disjoint event; retain every established domain's ordering and checks.
do $migration$ declare definition text;needle text;replacement text;begin
 definition:=pg_get_functiondef('public.replay_organization_suppression_history(text,text)'::regprocedure);
 needle:='lock table public.organizations,public.organization_closures,public.organization_closure_operations,';
 replacement:='lock table public.organizations,public.organization_closures,public.organization_closure_operations,public.organization_closure_early_deletions,';
 if (length(definition)-length(replace(definition,needle,'')))/length(needle)<>1 then raise exception 'Unexpected replay lock predecessor';end if;definition:=replace(definition,needle,replacement);
 needle:='''workspace_page_note_scope_revoked'',''workspace_page_access_revoked'') then';
 replacement:='''workspace_page_note_scope_revoked'',''workspace_page_access_revoked'',''closure_early_delete_confirmed'') then';
 if (length(definition)-length(replace(definition,needle,'')))/length(needle)<>1 then raise exception 'Unexpected replay kind predecessor';end if;definition:=replace(definition,needle,replacement);
 needle:=$old$  elsif entry->>'kind'='workspace_page_access_revoked' then
   perform public.validate_workspace_page_access_event(entry);
  else$old$;
 replacement:=$new$  elsif entry->>'kind'='workspace_page_access_revoked' then
   perform public.validate_workspace_page_access_event(entry);
  elsif entry->>'kind'='closure_early_delete_confirmed' then
   perform public.validate_organization_early_deletion_event(entry);
  else$new$;
 if (length(definition)-length(replace(definition,needle,'')))/length(needle)<>1 then raise exception 'Unexpected replay validation predecessor';end if;definition:=replace(definition,needle,replacement);
 needle:=$old$  elsif entry->>'kind'='workspace_page_access_revoked' then
   perform public.apply_workspace_page_access_suppression(entry);
  else$old$;
 replacement:=$new$  elsif entry->>'kind'='workspace_page_access_revoked' then
   perform public.apply_workspace_page_access_suppression(entry);
  elsif entry->>'kind'='closure_early_delete_confirmed' then
   perform public.apply_organization_early_deletion_suppression(entry);
  else$new$;
 if (length(definition)-length(replace(definition,needle,'')))/length(needle)<>1 then raise exception 'Unexpected replay application predecessor';end if;definition:=replace(definition,needle,replacement);
 needle:='and happened<export_until) then';
 replacement:='and not public.organization_closure_cleanup_due_at(org,request_id,revision,happened)) then';
 if (length(definition)-length(replace(definition,needle,'')))/length(needle)<>1 then raise exception 'Unexpected replay deletion deadline predecessor';end if;definition:=replace(definition,needle,replacement);
 needle:=$old$  elsif entry->>'kind'='workspace_page_access_revoked' then
   perform public.assert_workspace_page_access_suppressed(entry);
  else$old$;
 replacement:=$new$  elsif entry->>'kind'='workspace_page_access_revoked' then
   perform public.assert_workspace_page_access_suppressed(entry);
  elsif entry->>'kind'='closure_early_delete_confirmed' then
   perform public.assert_organization_early_deletion_suppressed(entry);
  else$new$;
 if (length(definition)-length(replace(definition,needle,'')))/length(needle)<>1 then raise exception 'Unexpected replay assertion predecessor';end if;definition:=replace(definition,needle,replacement);
 execute definition;
end $migration$;
comment on table public.organization_closure_early_deletions is 'Private immutable operator-attested rehearsal of explicit owner intent. Not a hosted consent channel. Ends new authorized export access; cannot recall already-issued URLs or admitted requests. Original closure deadline retained.';
commit;
