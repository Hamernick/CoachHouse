-- Retire organization-owned project/task/program content without cascading
-- financial/signing records, mixed asset bindings, or shared identity rows.
begin;
create table public.organization_closure_project_cleanups(
 org_id uuid not null,closure_request_id uuid not null,operation_id uuid not null,
 closure_revision integer not null check(closure_revision>0),operator_role text not null,
 transaction_id bigint not null,state text not null check(state in('running','complete')),
 result jsonb,created_at timestamptz not null default clock_timestamp(),completed_at timestamptz,
 primary key(org_id,closure_request_id,operation_id),
 check((state='complete')=(result is not null and completed_at is not null))
);
alter table public.organization_closure_project_cleanups enable row level security;
revoke all on public.organization_closure_project_cleanups from public,anon,authenticated,service_role;
create function public.guard_closure_project_cleanup_receipt() returns trigger
 language plpgsql security invoker set search_path='' as $$
begin
 if tg_op<>'UPDATE' then raise exception 'Project cleanup receipts are retained' using errcode='42501';end if;
 if (to_jsonb(new)-array['state','result','completed_at']) is distinct from (to_jsonb(old)-array['state','result','completed_at'])
  or old.state<>'running' or new.state<>'complete' or new.result is null or new.completed_at is null then
  raise exception 'Project cleanup receipt is immutable' using errcode='42501';end if;
 return new;
end $$;
revoke all on function public.guard_closure_project_cleanup_receipt() from public,anon,authenticated,service_role;
create trigger closure_project_cleanup_immutable before update or delete on public.organization_closure_project_cleanups for each row execute function public.guard_closure_project_cleanup_receipt();
create trigger closure_project_cleanup_retained before truncate on public.organization_closure_project_cleanups for each statement execute function public.guard_closure_project_cleanup_receipt();

create function public.closure_project_retirement_allowed(p_org uuid) returns boolean
 language plpgsql security definer set search_path='' as $$
begin
 if coalesce(nullif(current_setting('role',true),'none'),session_user)<>session_user
  or not exists(select 1 from pg_catalog.pg_roles where rolname=session_user and rolsuper)
  or current_setting('transaction_isolation')<>'read committed' or current_setting('session_replication_role')<>'origin' then return false;end if;
 return exists(select 1 from public.organization_closure_project_cleanups r
  join public.organization_closures c on c.org_id=r.org_id and c.request_id=r.closure_request_id and c.revision=r.closure_revision
  where r.org_id=p_org and r.operator_role=session_user and r.transaction_id=txid_current() and r.state='running'
   and c.state='closing' and c.export_until=c.requested_at+interval '720 hours' and clock_timestamp()>=c.export_until);
end $$;
revoke all on function public.closure_project_retirement_allowed(uuid) from public,anon,authenticated,service_role;

-- Full-row projection makes every exception exact: unrelated fields cannot
-- hitchhike on a private retirement. Fiscal enablement is the existing proven
-- boolean contract; no financial-looking key names receive blanket retention.
create function public.project_retired_project_content(p_table text,p_row jsonb) returns jsonb
 language plpgsql immutable set search_path='' as $$
declare fiscal jsonb;result jsonb;
begin
 case p_table
 when 'organization_projects' then
  fiscal:=case when jsonb_typeof(p_row#>'{option_settings,fiscalSponsorshipEnabled}')='boolean'
   then jsonb_build_object('fiscalSponsorshipEnabled',p_row#>'{option_settings,fiscalSponsorshipEnabled}') else '{}'::jsonb end;
  result:=p_row||jsonb_build_object('name','','description',null,'client_name',null,'type_label',null,'duration_label',null,
   'tags','[]'::jsonb,'member_labels','[]'::jsonb,'tracker_metadata',null,'option_settings',jsonb_build_object('tags','[]'::jsonb,'sprintTypes','[]'::jsonb)||fiscal,
   'guided_setup',case when jsonb_typeof(p_row#>'{guided_setup,fiscalSponsorshipEnabled}')='boolean'
    then jsonb_build_object('fiscalSponsorshipEnabled',p_row#>'{guided_setup,fiscalSponsorshipEnabled}') else '{}'::jsonb end);
 when 'organization_tasks' then
  result:=p_row||jsonb_build_object('title','','description',null,'tag_label',null,'workstream_name',null,'tracker_metadata',null);
 when 'programs' then
  result:=p_row||jsonb_build_object('title','','slug',null,'subtitle',null,'location',null,'duration_label',null,
   'features','[]'::jsonb,'status_label',null,'address_street',null,'address_city',null,'address_state',null,'address_postal',null,
   'address_country',null,'cta_label',null,'cta_url',null,'description',null,'location_url',null,'team_ids','[]'::jsonb,'wizard_snapshot','{}'::jsonb);
 when 'organization_project_activity_events' then
  if p_row->>'entity_type' not in('project','task','program') then return null;end if;
  result:=p_row||jsonb_build_object('title','Retired content','metadata','{}'::jsonb,
   'from_status',case when p_row->>'entity_type'='project' and p_row->>'from_status'=any(array['backlog','planned','active','on-hold','cancelled','completed'])
     or p_row->>'entity_type'='task' and p_row->>'from_status'=any(array['todo','in-progress','waiting','done']) then p_row->>'from_status' else null end,
   'to_status',case when p_row->>'entity_type'='project' and p_row->>'to_status'=any(array['backlog','planned','active','on-hold','cancelled','completed'])
     or p_row->>'entity_type'='task' and p_row->>'to_status'=any(array['todo','in-progress','waiting','done']) then p_row->>'to_status' else null end);
 when 'task_tracker_import_batches' then result:=p_row||jsonb_build_object('manifest','{}'::jsonb,'result','{}'::jsonb);
 when 'task_tracker_import_records' then result:=p_row||jsonb_build_object('source_payload','{}'::jsonb,'reason',null);
 else return null;
 end case;
 return result;
end $$;
revoke all on function public.project_retired_project_content(text,jsonb) from public,anon,authenticated,service_role;

create function public.closure_project_projection_allowed(p_table text,p_old jsonb,p_new jsonb) returns boolean
 language plpgsql security definer set search_path='' as $$
declare org uuid;
begin
 if p_table='task_tracker_import_records' then
  select org_id into org from public.task_tracker_import_batches where id=(p_old->>'batch_id')::uuid;
 else org:=(p_old->>case when p_table='programs' then 'user_id' else 'org_id' end)::uuid;end if;
 return public.closure_project_retirement_allowed(org)
  and (p_new-'updated_at')=(public.project_retired_project_content(p_table,p_old)-'updated_at');
end $$;
revoke all on function public.closure_project_projection_allowed(text,jsonb,jsonb) from public,anon,authenticated,service_role;

do $migration$
declare definition text;needle text;replacement text;target text;
begin
 foreach target in array array['guard_project_task_closure','guard_project_overview_closure','guard_organization_activity_closure',
  'record_organization_project_activity','record_organization_task_activity','record_organization_program_activity'] loop
  definition:=pg_get_functiondef(('public.'||target||'()')::regprocedure);
  needle:='begin'||chr(10);
  replacement:=needle||' if tg_op=''UPDATE'' and public.closure_project_projection_allowed(tg_table_name,to_jsonb(old),to_jsonb(new)) then return new;end if;'||chr(10);
  if target in('guard_project_task_closure','guard_project_overview_closure') then
   replacement:=replacement||' if tg_op=''DELETE'' and tg_table_name in(''organization_task_assignees'',''organization_project_notes'',''organization_project_quick_links'',''organization_project_overview_documents'') and public.closure_project_retirement_allowed((to_jsonb(old)->>''org_id'')::uuid) then return old;end if;'||chr(10);
  end if;
  if (length(definition)-length(replace(definition,needle,'')))/length(needle)<>1 then raise exception 'Unexpected project cleanup predecessor: %',target;end if;
  execute replace(definition,needle,replacement);
 end loop;
end $migration$;

create function public.purge_expired_organization_project_content(p_org_id uuid,p_closure_request_id uuid,p_expected_closure_revision integer,p_operation_id uuid) returns jsonb
 language plpgsql security invoker set search_path='' as $$
declare closure public.organization_closures;prior public.organization_closure_project_cleanups;relation text;
 cleanup_result jsonb;before_capture jsonb;batch record;item jsonb;destination uuid;owned boolean;
 projects integer;tasks integer;programs integer;notes integer;links integer;overviews integer;assignees integer;events integer;batches integer;records integer;notifications integer;
begin
 if session_user<>current_user or not exists(select 1 from pg_catalog.pg_roles where rolname=current_user and rolsuper)
  or current_setting('transaction_isolation')<>'read committed' or current_setting('session_replication_role')<>'origin' then
  raise exception 'Actual project cleanup operator required' using errcode='42501';end if;
 if p_org_id is null or p_closure_request_id is null or p_operation_id is null or p_expected_closure_revision is null or p_expected_closure_revision<1 then
  raise exception 'Exact project cleanup identity required' using errcode='22023';end if;
 perform 1 from public.organizations where user_id=p_org_id for update;
 if not found then raise exception 'Organization unavailable' using errcode='42501';end if;
 select * into closure from public.organization_closures where org_id=p_org_id;
 if not found or closure.state<>'closing' or closure.request_id is distinct from p_closure_request_id or closure.revision is distinct from p_expected_closure_revision
  or closure.export_until is null or closure.requested_at is null or closure.export_until<>closure.requested_at+interval '720 hours' or clock_timestamp()<closure.export_until then
  raise exception 'Expired current closure required' using errcode='42501';end if;
 select * into prior from public.organization_closure_project_cleanups where org_id=p_org_id and closure_request_id=p_closure_request_id and operation_id=p_operation_id;
 if found then
  if prior.closure_revision<>p_expected_closure_revision or prior.state<>'complete' then raise exception 'Project cleanup retry changed' using errcode='23505';end if;
  return prior.result;
 end if;
 if exists(select 1 from public.organization_projects where (org_id=p_org_id or canonical_org_id=p_org_id) and canonical_org_id is not null and canonical_org_id<>org_id) then
  raise exception 'Independent canonical project ownership requires reconciliation' using errcode='42501';end if;
 foreach relation in array array['organization_tasks','organization_project_notes','organization_project_quick_links','organization_project_overview_documents','organization_project_assets'] loop
  execute format('select exists(select 1 from public.%I c join public.organization_projects p on p.id=c.project_id where (c.org_id=$1 or p.org_id=$1) and c.org_id<>p.org_id)',relation) into owned using p_org_id;
  if owned then raise exception 'Independent project child ownership requires reconciliation' using errcode='42501';end if;
 end loop;
 if exists(select 1 from public.organization_task_assignees a join public.organization_tasks t on t.id=a.task_id where (a.org_id=p_org_id or t.org_id=p_org_id) and a.org_id<>t.org_id)
  or exists(select 1 from public.programs where user_id=p_org_id and is_public) then
  raise exception 'Project assignment or program publication requires reconciliation' using errcode='42501';end if;
 -- These retained strings are proven machine identities, not arbitrary labels.
 if exists(select 1 from public.organization_projects where org_id=p_org_id and starter_seed_key is not null
    and starter_seed_key !~ '^[0-9]+$' and starter_seed_key not in('platform:public-map-claims','public_fiscal_intake_v1'))
  or exists(select 1 from public.organization_tasks where org_id=p_org_id and starter_seed_key is not null and starter_seed_key !~ '^[0-9]+:[0-9]+-[0-9]+$') then
  raise exception 'Unrecognized project source identity requires reconciliation' using errcode='42501';end if;
 foreach relation in array array['organization_projects','organization_tasks','organization_task_assignees','organization_project_notes',
  'organization_project_quick_links','organization_project_overview_documents','organization_project_activity_events','task_tracker_import_batches'] loop
  execute format('select 1 from public.%I where org_id=$1 order by id for update nowait',relation) using p_org_id;
 end loop;
 perform 1 from public.programs where user_id=p_org_id order by id for update nowait;
 perform 1 from public.task_tracker_import_records r join public.task_tracker_import_batches b on b.id=r.batch_id where b.org_id=p_org_id order by r.namespace,r.entity_type,r.source_id for update of r nowait;
 perform 1 from public.notifications where org_id=p_org_id and type in('task_assigned','task_assignment_confirmed') order by id for update nowait;
 -- Held/personal/unresolved records are not organization content merely because
 -- their import batch has an org_id. Reject the entire operation atomically.
 for batch in select * from public.task_tracker_import_batches where org_id=p_org_id loop
  if batch.status='applying' or batch.namespace<>'coach-house-tracker-20260928' or batch.source_hash !~ '^[0-9a-f]{64}$' or batch.manifest_hash !~ '^[0-9a-f]{64}$' then
   raise exception 'Tracker source identity requires reconciliation' using errcode='42501';end if;
  if exists(select 1 from public.task_tracker_import_records r where r.batch_id=batch.id and
   (r.namespace<>batch.namespace or r.entity_type not in('Projects','Tasks','Project Templates','Template Tasks','Recurring Tasks','Work Inbox','Auxiliary projects')
    or r.source_id !~ '^(P-[0-9]+|PROJ-[0-9A-F]{8}|TASK-([0-9]+|[0-9A-F]{8})|row-[0-9]+)$'
    or r.disposition='held' or (r.source_payload<>'{}'::jsonb or r.reason is not null) and (r.destination_id is null
     or not(exists(select 1 from public.organization_projects p where p.id=r.destination_id and p.org_id=p_org_id)
      or exists(select 1 from public.organization_tasks t where t.id=r.destination_id and t.org_id=p_org_id)
      or exists(select 1 from public.organization_project_notes n where n.id=r.destination_id and n.org_id=p_org_id))))) then
   raise exception 'Tracker personal or unresolved source ownership requires reconciliation' using errcode='42501';end if;
  if batch.manifest<>'{}'::jsonb then
   if jsonb_typeof(batch.manifest)<>'object' or batch.manifest-array['batchId','namespace','sourceHash','orgId','actorId','links','projects','tasks','notes','records','auxiliaryRecords']<>'{}'::jsonb
    or batch.manifest->>'orgId' is distinct from p_org_id::text or batch.manifest->'links' is distinct from '[]'::jsonb then
    raise exception 'Tracker manifest ownership requires reconciliation' using errcode='42501';end if;
   foreach relation in array array['projects','tasks','notes','records','auxiliaryRecords'] loop
    if jsonb_typeof(batch.manifest->relation) is distinct from 'array' then raise exception 'Tracker manifest ownership requires reconciliation' using errcode='42501';end if;
    for item in select value from jsonb_array_elements(batch.manifest->relation) loop
     if relation in('records','auxiliaryRecords') then
      if not exists(select 1 from public.task_tracker_import_records r where r.batch_id=batch.id and r.entity_type=item->>'entityType' and r.source_id=item->>'sourceId'
       and r.source_payload=item->'source' and r.disposition=item->>'disposition' and r.reason is not distinct from item->>'reason' and r.destination_id::text is not distinct from item->>'destinationId') then
       raise exception 'Tracker manifest record ownership requires reconciliation' using errcode='42501';end if;
     else
      begin destination:=(item->>'id')::uuid;exception when invalid_text_representation then raise exception 'Tracker manifest identity requires reconciliation' using errcode='42501';end;
      execute format('select exists(select 1 from public.%I where id=$1 and org_id=$2)',case relation when 'projects' then 'organization_projects' when 'tasks' then 'organization_tasks' else 'organization_project_notes' end) into owned using destination,p_org_id;
      if owned is not true then raise exception 'Tracker manifest destination ownership requires reconciliation' using errcode='42501';end if;
     end if;
    end loop;
   end loop;
  end if;
 end loop;
 if exists(select 1 from public.notifications n where n.org_id=p_org_id and n.type in('task_assigned','task_assignment_confirmed') and
  (jsonb_typeof(n.metadata) is distinct from 'object' or n.metadata-array['taskId','projectId','assigneeId']<>'{}'::jsonb
   or not exists(select 1 from public.organization_tasks t join public.organization_projects p on p.id=t.project_id
    where t.org_id=p_org_id and p.org_id=p_org_id and t.id::text=n.metadata->>'taskId' and p.id::text=n.metadata->>'projectId')
   or not exists(select 1 from auth.users u where u.id::text=n.metadata->>'assigneeId')
   or n.href is not null and n.href not in('/tasks','/projects/'||(n.metadata->>'projectId'),'/organizations/'||(n.metadata->>'projectId')))) then
  raise exception 'Task notification ownership requires reconciliation' using errcode='42501';end if;
 before_capture:=public.read_organization_suppression_events();
 insert into public.organization_closure_project_cleanups(org_id,closure_request_id,operation_id,closure_revision,operator_role,transaction_id,state)
 values(p_org_id,p_closure_request_id,p_operation_id,p_expected_closure_revision,session_user,txid_current(),'running');
 update public.organization_projects p set name='',description=null,client_name=null,type_label=null,duration_label=null,tags='{}',member_labels='{}',tracker_metadata=null,
  option_settings=public.project_retired_project_content('organization_projects',to_jsonb(p))->'option_settings',
  guided_setup=public.project_retired_project_content('organization_projects',to_jsonb(p))->'guided_setup' where org_id=p_org_id;get diagnostics projects=row_count;
 update public.organization_tasks set title='',description=null,tag_label=null,workstream_name=null,tracker_metadata=null where org_id=p_org_id;get diagnostics tasks=row_count;
 update public.programs set title='',slug=null,subtitle=null,location=null,duration_label=null,features='{}',status_label=null,
  address_street=null,address_city=null,address_state=null,address_postal=null,address_country=null,cta_label=null,cta_url=null,description=null,location_url=null,team_ids='{}',wizard_snapshot='{}' where user_id=p_org_id;get diagnostics programs=row_count;
 delete from public.organization_task_assignees where org_id=p_org_id;get diagnostics assignees=row_count;
 delete from public.organization_project_notes where org_id=p_org_id;get diagnostics notes=row_count;
 delete from public.organization_project_quick_links where org_id=p_org_id;get diagnostics links=row_count;
 delete from public.organization_project_overview_documents where org_id=p_org_id;get diagnostics overviews=row_count;
 update public.organization_project_activity_events e set title='Retired content',metadata='{}',
  from_status=public.project_retired_project_content('organization_project_activity_events',to_jsonb(e))->>'from_status',
  to_status=public.project_retired_project_content('organization_project_activity_events',to_jsonb(e))->>'to_status'
  where org_id=p_org_id and entity_type in('project','task','program');get diagnostics events=row_count;
 update public.task_tracker_import_records r set source_payload='{}',reason=null from public.task_tracker_import_batches b where b.id=r.batch_id and b.org_id=p_org_id;get diagnostics records=row_count;
 update public.task_tracker_import_batches set manifest='{}',result='{}' where org_id=p_org_id;get diagnostics batches=row_count;
 update public.notifications set title='Retired content',description='' where org_id=p_org_id and type in('task_assigned','task_assignment_confirmed');get diagnostics notifications=row_count;
 if public.read_organization_suppression_events() is distinct from before_capture then raise exception 'Project cleanup changed suppression history' using errcode='42501';end if;
 cleanup_result:=jsonb_build_object('scope','owned_project_task_program_content','projectsScrubbed',projects,'tasksScrubbed',tasks,'programsScrubbed',programs,
  'assigneesDeleted',assignees,'notesDeleted',notes,'linksDeleted',links,'overviewsDeleted',overviews,'activityPayloadsScrubbed',events,
  'trackerBatchesScrubbed',batches,'trackerRecordsScrubbed',records,'notificationPayloadsScrubbed',notifications,
  'financialSigningAndPhysicalBindingsRetained',true,'captureComplete',false,'releaseQualified',false);
 update public.organization_closure_project_cleanups set state='complete',result=cleanup_result,completed_at=clock_timestamp()
  where org_id=p_org_id and closure_request_id=p_closure_request_id and operation_id=p_operation_id;
 return cleanup_result;
end $$;
revoke all on function public.purge_expired_organization_project_content(uuid,uuid,integer,uuid) from public,anon,authenticated,service_role;
comment on function public.purge_expired_organization_project_content(uuid,uuid,integer,uuid) is
 'Private exact expired-closure project/task/program payload retirement. Retains minimal parent identities, financial/signing evidence and mixed physical asset bindings; personal/unresolved tracker ownership blocks atomically. No ordinary API grant, account deletion, organization-complete or hosted acceptance claim.';
commit;
