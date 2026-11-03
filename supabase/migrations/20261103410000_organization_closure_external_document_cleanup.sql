-- Organization references and callback intents only. User connections, tokens
-- and all externally owned Google files remain independent and untouched.
begin;
create function public.guard_google_drive_intent_closure() returns trigger
 language plpgsql security definer set search_path='' as $$
begin
 if tg_op='UPDATE' and (new.id is distinct from old.id or new.org_id is distinct from old.org_id
  or new.user_id is distinct from old.user_id or new.state_sha256 is distinct from old.state_sha256) then
  raise exception 'Drive callback intent identity cannot change' using errcode='42501';end if;
 perform public.guard_uploaded_document_organization(new.org_id);
 return new;
end $$;
revoke all on function public.guard_google_drive_intent_closure() from public,anon,authenticated,service_role;
create trigger google_drive_intent_closure before insert or update on public.google_drive_oauth_intents
 for each row execute function public.guard_google_drive_intent_closure();

create table public.organization_closure_external_cleanups (
 org_id uuid not null,closure_request_id uuid not null,operation_id uuid not null,
 closure_revision integer not null check(closure_revision>0),transaction_id bigint not null,operator_role text not null,
 document_ids uuid[] not null,intent_ids uuid[] not null,activity_ids uuid[] not null,
 state text not null check(state in('running','complete')),result jsonb,
 created_at timestamptz not null default clock_timestamp(),completed_at timestamptz,
 primary key(org_id,closure_request_id,operation_id),check((state='complete')=(result is not null and completed_at is not null))
);
alter table public.organization_closure_external_cleanups enable row level security;
revoke all on public.organization_closure_external_cleanups from public,anon,authenticated,service_role;
create function public.guard_closure_external_cleanup_receipt() returns trigger
 language plpgsql security invoker set search_path='' as $$
begin
 if tg_op<>'UPDATE' then raise exception 'External cleanup receipts are retained' using errcode='42501';end if;
 if (to_jsonb(new)-array['state','result','completed_at']) is distinct from (to_jsonb(old)-array['state','result','completed_at'])
  or old.state<>'running' or new.state<>'complete' or new.result is null or new.completed_at is null then raise exception 'External cleanup receipt is immutable' using errcode='42501';end if;
 return new;
end $$;
revoke all on function public.guard_closure_external_cleanup_receipt() from public,anon,authenticated,service_role;
create trigger closure_external_cleanup_immutable before update or delete on public.organization_closure_external_cleanups for each row execute function public.guard_closure_external_cleanup_receipt();
create trigger closure_external_cleanup_retained before truncate on public.organization_closure_external_cleanups for each statement execute function public.guard_closure_external_cleanup_receipt();

create function public.closure_external_retirement_allowed(p_org uuid,p_table text,p_id uuid) returns boolean
 language plpgsql security definer set search_path='' as $$
begin
 if coalesce(nullif(current_setting('role',true),'none'),session_user)<>session_user
  or not exists(select 1 from pg_catalog.pg_roles where rolname=session_user and rolsuper)
  or current_setting('transaction_isolation')<>'read committed' or current_setting('session_replication_role')<>'origin' then return false;end if;
 return exists(select 1 from public.organization_closure_external_cleanups r join public.organization_closures c
  on c.org_id=r.org_id and c.request_id=r.closure_request_id and c.revision=r.closure_revision
  where r.org_id=p_org and r.transaction_id=txid_current() and r.operator_role=session_user and r.state='running'
   and c.state='closing' and c.export_until=c.requested_at+interval '720 hours' and clock_timestamp()>=c.export_until
   and case p_table when 'organization_external_documents' then p_id=any(r.document_ids)
    when 'organization_project_activity_events' then p_id=any(r.activity_ids) else false end);
end $$;
create function public.project_retired_external_activity(p_row jsonb) returns jsonb
 language sql immutable set search_path='' as $$
 select p_row||jsonb_build_object('title','Retired content','metadata',jsonb_build_object('source','organization_external_documents'),
  'from_status',case when p_row->>'from_status'=any(array['available','trashed','inaccessible','needs_reconnect']) then p_row->>'from_status' else null end,
  'to_status',case when p_row->>'to_status'=any(array['available','trashed','inaccessible','needs_reconnect']) then p_row->>'to_status' else null end)
$$;
revoke all on function public.project_retired_external_activity(jsonb) from public,anon,authenticated,service_role;
create function public.closure_external_activity_projection_allowed(p_old jsonb,p_new jsonb) returns boolean
 language plpgsql security definer set search_path='' as $$
begin
 if not public.closure_external_retirement_allowed((p_old->>'org_id')::uuid,'organization_project_activity_events',(p_old->>'id')::uuid) then return false;end if;
 return p_old->>'entity_type'='file' and p_old#>>'{metadata,source}'='organization_external_documents'
  and p_new=public.project_retired_external_activity(p_old);
end $$;
revoke all on function public.closure_external_retirement_allowed(uuid,text,uuid),public.closure_external_activity_projection_allowed(jsonb,jsonb) from public,anon,authenticated,service_role;

-- Compose with existing uploaded-file/project cleanup guards; never recapture
-- the just-retired filename into a new activity event.
do $migration$
declare definition text;needle text;replacement text;
begin
 definition:=pg_get_functiondef('public.guard_external_document_closure()'::regprocedure);needle:='begin'||chr(10);
 replacement:=needle||' if tg_op=''DELETE'' and public.closure_external_retirement_allowed(old.org_id,tg_table_name,old.id) then return old;end if;'||chr(10);
 if (length(definition)-length(replace(definition,needle,'')))/length(needle)<>1 then raise exception 'Unexpected external document guard';end if;execute replace(definition,needle,replacement);
 definition:=pg_get_functiondef('public.record_organization_file_activity()'::regprocedure);
 needle:='  -- Compliance uploads are already captured by their profile document mutation.';
 replacement:='  if tg_table_name=''organization_external_documents'' and tg_op=''DELETE'' and public.closure_external_retirement_allowed((previous->>''org_id'')::uuid,tg_table_name,(previous->>''id'')::uuid) then return old;end if;'||chr(10)||needle;
 if (length(definition)-length(replace(definition,needle,'')))/length(needle)<>1 then raise exception 'Unexpected file activity owner';end if;execute replace(definition,needle,replacement);
 definition:=pg_get_functiondef('public.guard_organization_activity_closure()'::regprocedure);needle:='begin'||chr(10);
 replacement:=needle||' if tg_op=''UPDATE'' and public.closure_external_activity_projection_allowed(to_jsonb(old),to_jsonb(new)) then return new;end if;'||chr(10);
 if (length(definition)-length(replace(definition,needle,'')))/length(needle)<>1 then raise exception 'Unexpected organization activity guard';end if;execute replace(definition,needle,replacement);
end $migration$;

create function public.purge_expired_organization_external_documents(p_org_id uuid,p_closure_request_id uuid,p_expected_closure_revision integer,p_operation_id uuid) returns jsonb
 language plpgsql security invoker set search_path='' as $$
declare closure public.organization_closures;prior public.organization_closure_external_cleanups;
 documents uuid[];intents uuid[];activities uuid[];document_count integer;intent_count integer;activity_count integer;cleanup_result jsonb;
begin
 if session_user<>current_user or not exists(select 1 from pg_catalog.pg_roles where rolname=current_user and rolsuper)
  or current_setting('transaction_isolation')<>'read committed' or current_setting('session_replication_role')<>'origin' then raise exception 'Actual external cleanup operator required' using errcode='42501';end if;
 if p_org_id is null or p_closure_request_id is null or p_operation_id is null or p_expected_closure_revision is null or p_expected_closure_revision<1 then raise exception 'Exact external cleanup identity required' using errcode='22023';end if;
 perform 1 from public.organizations where user_id=p_org_id for update;
 if not found then raise exception 'Organization unavailable' using errcode='42501';end if;
 select * into closure from public.organization_closures where org_id=p_org_id;
 if not found or closure.state<>'closing' or closure.request_id is distinct from p_closure_request_id or closure.revision is distinct from p_expected_closure_revision
  or closure.export_until is null or closure.requested_at is null or closure.export_until<>closure.requested_at+interval '720 hours' or clock_timestamp()<closure.export_until then raise exception 'Expired current closure required' using errcode='42501';end if;
 select * into prior from public.organization_closure_external_cleanups where org_id=p_org_id and closure_request_id=p_closure_request_id and operation_id=p_operation_id;
 if found then
  if prior.closure_revision<>p_expected_closure_revision or prior.state<>'complete' then raise exception 'External cleanup retry changed' using errcode='23505';end if;return prior.result;
 end if;
 -- Canonical source rows precede their copied activity. Busy children roll back
 -- the whole batch rather than inverting an editor/callback transaction's lock.
 select coalesce(array_agg(id order by id),'{}'::uuid[]) into documents from(
  select id from public.organization_external_documents where org_id=p_org_id order by id limit 50 for update nowait) q;
 select coalesce(array_agg(id order by id),'{}'::uuid[]) into intents from(
  select id from public.google_drive_oauth_intents where org_id=p_org_id order by id limit 50 for update nowait) q;
 select coalesce(array_agg(id order by id),'{}'::uuid[]) into activities from(
  select id from public.organization_project_activity_events e where org_id=p_org_id and entity_type='file'
   and metadata->>'source'='organization_external_documents'
   and to_jsonb(e) is distinct from public.project_retired_external_activity(to_jsonb(e))
   order by id limit 50 for update nowait) q;
 if exists(select 1 from public.organization_project_activity_events e join public.organization_external_documents d on d.id=e.entity_id
  where e.id=any(activities) and d.org_id<>p_org_id) then raise exception 'External activity source ownership requires reconciliation' using errcode='42501';end if;
 insert into public.organization_closure_external_cleanups(org_id,closure_request_id,operation_id,closure_revision,transaction_id,operator_role,document_ids,intent_ids,activity_ids,state)
 values(p_org_id,p_closure_request_id,p_operation_id,p_expected_closure_revision,txid_current(),session_user,documents,intents,activities,'running');
 update public.organization_project_activity_events e set title='Retired content',metadata='{"source":"organization_external_documents"}',
  from_status=public.project_retired_external_activity(to_jsonb(e))->>'from_status',
  to_status=public.project_retired_external_activity(to_jsonb(e))->>'to_status' where org_id=p_org_id and id=any(activities);
 get diagnostics activity_count=row_count;
 delete from public.organization_external_documents where org_id=p_org_id and id=any(documents);
 get diagnostics document_count=row_count;
 delete from public.google_drive_oauth_intents where org_id=p_org_id and id=any(intents);
 get diagnostics intent_count=row_count;
 cleanup_result:=jsonb_build_object('scope','external_document_metadata','deletedReferences',document_count,'deletedOAuthIntents',intent_count,'retiredActivityPayloads',activity_count,
  'moreRemainingAtCommit',exists(select 1 from public.organization_external_documents where org_id=p_org_id)
   or exists(select 1 from public.google_drive_oauth_intents where org_id=p_org_id)
   or exists(select 1 from public.organization_project_activity_events e where org_id=p_org_id and entity_type='file' and metadata->>'source'='organization_external_documents'
    and to_jsonb(e) is distinct from public.project_retired_external_activity(to_jsonb(e))));
 update public.organization_closure_external_cleanups set state='complete',result=cleanup_result,completed_at=clock_timestamp() where org_id=p_org_id and closure_request_id=p_closure_request_id and operation_id=p_operation_id;
 return cleanup_result;
end $$;
revoke all on function public.purge_expired_organization_external_documents(uuid,uuid,integer,uuid) from public,anon,authenticated,service_role;
comment on function public.purge_expired_organization_external_documents(uuid,uuid,integer,uuid) is
 'Private expired-closure batch of50 scoped references/intents/copied activity payloads each. Preserves user-global Drive connections/credentials and external files. Already consumed provider operations require independent reconciliation; no provider calls, public controls or whole-organization completion.';
commit;
