-- Private finite-source cleanup control. No owner/API activation, provider
-- effects or whole-organization erasure attestation is introduced here.
begin;
create function public.organization_closure_cleanup_due(p_org uuid,p_request uuid,p_revision integer) returns boolean
 language sql volatile security definer set search_path='' as $$
 select exists(select 1 from public.organization_closures c where c.org_id=p_org and c.state='closing'
  and c.request_id=p_request and c.revision=p_revision and c.export_until=c.requested_at+interval '720 hours'
  and clock_timestamp()>=c.export_until)
$$;
revoke all on function public.organization_closure_cleanup_due(uuid,uuid,integer) from public,anon,authenticated,service_role;
comment on function public.organization_closure_cleanup_due(uuid,uuid,integer) is
 'Exact fixed-deadline cleanup eligibility. A later early-deletion extension must require captured immutable confirmation; no caller flag can shorten or extend export_until.';

create table public.organization_closure_cleanup_attempts(
 org_id uuid not null,closure_request_id uuid not null,closure_revision integer not null check(closure_revision>0),attempt_id uuid not null,
 operator_role text not null,claimed_at timestamptz not null,lease_until timestamptz not null,
 phase text not null check(phase in('claimed','finished')),source_outcomes jsonb,result jsonb,finished_at timestamptz,
 primary key(org_id,closure_request_id,attempt_id),check(lease_until=claimed_at+interval '5 minutes'),
 check((phase='finished')=(result is not null and finished_at is not null))
);
alter table public.organization_closure_cleanup_attempts enable row level security;
revoke all on public.organization_closure_cleanup_attempts from public,anon,authenticated,service_role;
create function public.guard_closure_cleanup_attempt() returns trigger
 language plpgsql security invoker set search_path='' as $$
begin
 if tg_op<>'UPDATE' then raise exception 'Cleanup attempt receipts are retained' using errcode='42501';end if;
 if old.phase='finished' or (to_jsonb(old)-array['phase','source_outcomes','result','finished_at']) is distinct from (to_jsonb(new)-array['phase','source_outcomes','result','finished_at'])
  or old.source_outcomes is not null and new.source_outcomes is distinct from old.source_outcomes
  or new.phase='claimed' and (new.result is not null or new.finished_at is not null)
  or new.phase='finished' and (new.result is null or new.finished_at is null) then raise exception 'Cleanup attempt identity/outcome is immutable' using errcode='42501';end if;
 return new;
end $$;
revoke all on function public.guard_closure_cleanup_attempt() from public,anon,authenticated,service_role;
create trigger closure_cleanup_attempt_immutable before update or delete on public.organization_closure_cleanup_attempts for each row execute function public.guard_closure_cleanup_attempt();
create trigger closure_cleanup_attempt_retained before truncate on public.organization_closure_cleanup_attempts for each statement execute function public.guard_closure_cleanup_attempt();

create function public.organization_closure_cleanup_assessment(p_org uuid) returns jsonb
 language plpgsql security definer set search_path='' as $$
declare counts jsonb;profile jsonb;remaining bigint;unknown_profile bigint;
begin
 select o.profile into profile from public.organizations o where user_id=p_org;
 if not found then raise exception 'Organization unavailable' using errcode='42501';end if;
 if jsonb_typeof(profile) is distinct from 'object' then return jsonb_build_object('assessmentAvailable',false,'code','profile_shape_unreconciled','localContentComplete',false,'wholeCleanupComplete',false);end if;
 counts:=jsonb_build_object(
  'nativeResponses',(select count(*) from public.organization_form_responses r join public.organization_form_versions v on v.id=r.version_id where v.org_id=p_org),
  'researchDrafts',(select count(*) from public.workspace_research_drafts d join public.workspace_ai_runs r on r.id=d.run_id where r.org_id=p_org),
  'workspaceBoards',(select count(*) from public.organization_workspace_boards where org_id=p_org),
  'workspacePagePayloads',(select count(*) from public.organization_workspace_pages where org_id=p_org and (title<>'' or description is distinct from '' or published_snapshot is not null or guest_snapshot is not null or published_at is not null)),
  'formVersionPayloads',(select count(*) from public.organization_form_versions where org_id=p_org and version<>'{}'),
  'dataTables',(select count(*) from public.organization_data_tables where org_id=p_org),
  'dataRows',(select count(*) from public.organization_data_rows where org_id=p_org),
  'dataViews',(select count(*) from public.organization_data_views where org_id=p_org),
  'dataReceiptPayloads',(select count(*) from public.organization_data_view_receipts where org_id=p_org and (command<>'{}' or result<>'{}')),
  'coreVersions',(select count(*) from public.organization_core_document_versions where org_id=p_org),
  'coreSessions',(select count(*) from public.organization_core_document_sessions where org_id=p_org),
  'corePresence',(select count(*) from public.organization_core_document_presence where org_id=p_org),
  'peopleTags',(select count(*) from public.organization_people_tags where org_id=p_org),
  'peopleSegments',(select count(*) from public.organization_people_segments where org_id=p_org),
  'brandKits',(select count(*) from public.organization_brand_kits where org_id=p_org),
  'opportunities',(select count(*) from public.organization_finance_opportunities where org_id=p_org),
  'resourceMatches',(select count(*) from public.organization_resource_opportunity_matches where org_id=p_org),
  'engagementProjections',(select count(*) from public.organization_finance_engagement_events where org_id=p_org),
  'scanWorkOrDiagnostics',(select count(*) from public.finance_opportunity_scan_runs where org_id=p_org and (status in('queued','running') or error_message is not null or error_code is distinct from case when status='failed' then 'closure_content_retired' end)),
  'publicEventPayloads',(select count(*) from public.roadmap_calendar_public_events e where org_id=p_org and (to_jsonb(e)-'updated_at') is distinct from (public.project_retired_local_calendar_event(to_jsonb(e))-'updated_at')),
  'internalEventPayloads',(select count(*) from public.roadmap_calendar_internal_events e where org_id=p_org and (to_jsonb(e)-'updated_at') is distinct from (public.project_retired_local_calendar_event(to_jsonb(e))-'updated_at')),
  'projectPayloads',(select count(*) from public.organization_projects p where org_id=p_org and (to_jsonb(p)-'updated_at') is distinct from (public.project_retired_project_content('organization_projects',to_jsonb(p))-'updated_at')),
  'taskPayloads',(select count(*) from public.organization_tasks t where org_id=p_org and (to_jsonb(t)-'updated_at') is distinct from (public.project_retired_project_content('organization_tasks',to_jsonb(t))-'updated_at')),
  'programPayloads',(select count(*) from public.programs p where user_id=p_org and (to_jsonb(p)-'updated_at') is distinct from (public.project_retired_project_content('programs',to_jsonb(p))-'updated_at')),
  'projectNotes',(select count(*) from public.organization_project_notes where org_id=p_org),
  'projectLinks',(select count(*) from public.organization_project_quick_links where org_id=p_org),
  'projectOverviews',(select count(*) from public.organization_project_overview_documents where org_id=p_org),
  'taskAssignees',(select count(*) from public.organization_task_assignees where org_id=p_org),
  'projectActivityPayloads',(select count(*) from public.organization_project_activity_events e where org_id=p_org and entity_type in('project','task','program') and to_jsonb(e) is distinct from public.project_retired_project_content('organization_project_activity_events',to_jsonb(e))),
  'trackerBatchPayloads',(select count(*) from public.task_tracker_import_batches where org_id=p_org and (manifest<>'{}' or result<>'{}')),
  'trackerRecordPayloads',(select count(*) from public.task_tracker_import_records r join public.task_tracker_import_batches b on b.id=r.batch_id where b.org_id=p_org and (r.source_payload<>'{}' or r.reason is not null)),
  'taskNotificationPayloads',(select count(*) from public.notifications where org_id=p_org and type in('task_assigned','task_assignment_confirmed') and (title<>'Retired content' or description<>'')),
  'aiRunPayloads',(select count(*) from public.workspace_ai_runs where org_id=p_org and content_retired_at is null),
  'externalDocumentReferences',(select count(*) from public.organization_external_documents where org_id=p_org),
  'driveOAuthIntents',(select count(*) from public.google_drive_oauth_intents where org_id=p_org),
  'externalFileActivityPayloads',(select count(*) from public.organization_project_activity_events e where org_id=p_org and entity_type='file' and metadata->>'source'='organization_external_documents' and to_jsonb(e) is distinct from public.project_retired_external_activity(to_jsonb(e))),
  'documentFiles',(select count(*) from public.organization_document_files where org_id=p_org),
  'controlledStorageObjects',(select count(*) from storage.objects where bucket_id in('org-documents','org-media','program-media','roadmap-media','workspace-page-assets') and starts_with(name,p_org::text||'/')),
  'projectAssetBindingsPending450',(select count(*) from public.organization_project_assets where org_id=p_org),
  'fileDocumentActivityPending450',(select count(*) from public.organization_project_activity_events where org_id=p_org and (entity_type='document' or entity_type='file' and metadata->>'source' in('organization_document_files','organization_project_assets'))),
  'derivedCoordinates',(select case when location_lat is not null or location_lng is not null then 1 else 0 end from public.organizations where user_id=p_org)
 );
 select count(*) into unknown_profile from jsonb_each(profile) where value not in('null'::jsonb,'{}'::jsonb,'[]'::jsonb,'""'::jsonb)
  and not(key='roadmap' and value in('{"sections":[]}'::jsonb,'{"sections":{}}'::jsonb));
 counts:=counts||jsonb_build_object('profileFieldsRequiringDisposition',unknown_profile);
 select coalesce(sum(value::bigint),0) into remaining from jsonb_each_text(counts);
 return jsonb_build_object('assessmentAvailable',true,'remaining',counts,'remainingCount',remaining,
  'unqualifiedLocalOwners',jsonb_build_array('project_assets_and_document_activity_450'),
  'requiredExternalQualification',jsonb_build_array('current_restore_authority','independent_suppression_durability','provider_effect_reconciliation','retained_store_horizons','independent_record_disposition','refund_qualification','hosted_worker_and_physical_absence'),
  'localContentComplete',false,'wholeCleanupComplete',false);
exception when others then
 -- A changed owner/schema cannot turn missing assessment into completion.
 return jsonb_build_object('assessmentAvailable',false,'code','assessment_unavailable','localContentComplete',false,'wholeCleanupComplete',false);
end $$;
revoke all on function public.organization_closure_cleanup_assessment(uuid) from public,anon,authenticated,service_role;

create function public.organization_closure_cleanup_status(p_org uuid) returns jsonb
 language plpgsql security invoker set search_path='' as $$
declare closure public.organization_closures;attempt public.organization_closure_cleanup_attempts;assessment jsonb;status text;
begin
 if session_user<>current_user or not exists(select 1 from pg_catalog.pg_roles where rolname=current_user and rolsuper) then raise exception 'Actual cleanup operator required' using errcode='42501';end if;
 perform 1 from public.organizations where user_id=p_org for share nowait;
 if not found then raise exception 'Organization unavailable' using errcode='42501';end if;
 select * into closure from public.organization_closures where org_id=p_org;
 if not found or closure.state='active' then return jsonb_build_object('status','not_requested','wholeCleanupComplete',false);end if;
 select * into attempt from public.organization_closure_cleanup_attempts where org_id=p_org and closure_request_id=closure.request_id and closure_revision=closure.revision order by claimed_at desc,attempt_id desc limit 1;
 assessment:=public.organization_closure_cleanup_assessment(p_org);
 status:=case when not public.organization_closure_cleanup_due(p_org,closure.request_id,closure.revision) then 'pending'
  when attempt.phase='claimed' and clock_timestamp()<attempt.lease_until then 'running'
  when attempt.phase='claimed' then 'failed'
  when attempt.result->>'status'='failed' then 'failed'
  when coalesce((assessment->>'remainingCount')::bigint,0)>0 then 'pending' else 'blocked' end;
 return jsonb_build_object('organizationId',p_org,'requestId',closure.request_id,'closureRevision',closure.revision,'exportUntil',closure.export_until,
  'status',status,'attemptId',attempt.attempt_id,'leaseUntil',attempt.lease_until,'code',case when attempt.phase='claimed' and clock_timestamp()>=attempt.lease_until then 'lease_expired' else attempt.result->>'code' end,
  'sourceOutcomes',attempt.source_outcomes,'assessment',assessment,'wholeCleanupComplete',false);
end $$;
revoke all on function public.organization_closure_cleanup_status(uuid) from public,anon,authenticated,service_role;

create function public.claim_organization_closure_cleanup(p_org uuid,p_request uuid,p_revision integer,p_attempt uuid) returns jsonb
 language plpgsql security invoker set search_path='' as $$
declare attempt public.organization_closure_cleanup_attempts;stamp timestamptz;
begin
 if session_user<>current_user or not exists(select 1 from pg_catalog.pg_roles where rolname=current_user and rolsuper) or current_setting('transaction_isolation')<>'read committed' or current_setting('session_replication_role')<>'origin' then raise exception 'Actual cleanup operator required' using errcode='42501';end if;
 if p_attempt is null then raise exception 'Exact cleanup attempt required' using errcode='22023';end if;
 perform 1 from public.organizations where user_id=p_org for update;
 if not found or not public.organization_closure_cleanup_due(p_org,p_request,p_revision) then raise exception 'Current cleanup eligibility required' using errcode='42501';end if;
 select * into attempt from public.organization_closure_cleanup_attempts where org_id=p_org and closure_request_id=p_request and attempt_id=p_attempt;
 if found then
  if attempt.closure_revision<>p_revision or attempt.operator_role<>session_user then raise exception 'Cleanup attempt identity changed' using errcode='23505';end if;
  return jsonb_build_object('attemptId',p_attempt,'phase',attempt.phase,'claimedAt',attempt.claimed_at,'leaseUntil',attempt.lease_until,'sourceOutcomes',attempt.source_outcomes,'result',attempt.result);
 end if;
 if exists(select 1 from public.organization_closure_cleanup_attempts where org_id=p_org and closure_request_id=p_request and closure_revision=p_revision and phase='claimed' and lease_until>clock_timestamp()) then raise exception 'Cleanup already claimed' using errcode='PT409';end if;
 stamp:=clock_timestamp();
 insert into public.organization_closure_cleanup_attempts(org_id,closure_request_id,closure_revision,attempt_id,operator_role,claimed_at,lease_until,phase)
 values(p_org,p_request,p_revision,p_attempt,session_user,stamp,stamp+interval '5 minutes','claimed') returning * into attempt;
 return jsonb_build_object('attemptId',p_attempt,'phase',attempt.phase,'claimedAt',attempt.claimed_at,'leaseUntil',attempt.lease_until,'sourceOutcomes',null,'result',null);
end $$;
revoke all on function public.claim_organization_closure_cleanup(uuid,uuid,integer,uuid) from public,anon,authenticated,service_role;

create function public.run_organization_closure_sql_cleanup(p_org uuid,p_request uuid,p_revision integer,p_attempt uuid) returns jsonb
 language plpgsql security invoker set search_path='' as $$
declare attempt public.organization_closure_cleanup_attempts;source text;result jsonb;outcomes jsonb:='{}';code text;
begin
 if session_user<>current_user or not exists(select 1 from pg_catalog.pg_roles where rolname=current_user and rolsuper) or current_setting('transaction_isolation')<>'read committed' or current_setting('session_replication_role')<>'origin' then raise exception 'Actual cleanup operator required' using errcode='42501';end if;
 perform 1 from public.organizations where user_id=p_org for update;
 if not found or not public.organization_closure_cleanup_due(p_org,p_request,p_revision) then raise exception 'Current cleanup eligibility required' using errcode='42501';end if;
 select * into attempt from public.organization_closure_cleanup_attempts where org_id=p_org and closure_request_id=p_request and attempt_id=p_attempt for update;
 if not found or attempt.closure_revision<>p_revision or attempt.operator_role<>session_user then raise exception 'Exact cleanup claim required' using errcode='42501';end if;
 if attempt.source_outcomes is not null then return attempt.source_outcomes;end if;
 if attempt.phase<>'claimed' or clock_timestamp()>=attempt.lease_until then raise exception 'Cleanup claim expired or finished' using errcode='42501';end if;
 foreach source in array array['native_responses','research_drafts','workspace_content','core_content','operating_content','project_content','ai_content','external_documents','profile_metadata'] loop
  code:=null;result:=null;
  begin
   case source
    when 'native_responses' then result:=public.purge_expired_organization_form_responses(p_org,p_request,p_revision,p_attempt);
    when 'research_drafts' then result:=public.purge_expired_organization_research_drafts(p_org,p_request,p_revision,p_attempt);
    when 'workspace_content' then result:=public.purge_expired_organization_workspace_content(p_org,p_request,p_revision,p_attempt);
    when 'core_content' then result:=public.purge_expired_organization_core_content(p_org,p_request,p_revision,p_attempt);
    when 'operating_content' then result:=public.purge_expired_organization_operating_content(p_org,p_request,p_revision,p_attempt);
    when 'project_content' then result:=public.purge_expired_organization_project_content(p_org,p_request,p_revision,p_attempt);
    when 'ai_content' then result:=public.purge_expired_organization_ai_content(p_org,p_request,p_revision,p_attempt);
    when 'external_documents' then result:=public.purge_expired_organization_external_documents(p_org,p_request,p_revision,p_attempt);
    when 'profile_metadata' then result:=public.purge_expired_organization_profile_metadata(p_org,p_request,p_revision,p_attempt);
   end case;
  exception
   when lock_not_available or serialization_failure or deadlock_detected then code:='busy';
   when program_limit_exceeded then code:='capacity';
   when insufficient_privilege then code:='reconciliation_required';
   when unique_violation or sqlstate 'PT409' then code:='conflict';
   when query_canceled then code:='timeout';
   when others then code:='source_failed';
  end;
  outcomes:=outcomes||jsonb_build_object(source,case when code is not null then jsonb_build_object('state','failed','code',code,'operationId',p_attempt)
   else jsonb_build_object('state',case when coalesce((result->>'moreRemainingAtCommit')::boolean,false) then 'more_pending' else 'batch_complete' end,
    'operationId',p_attempt,'resultSha256',encode(sha256(convert_to(result::text,'UTF8')),'hex')) end);
 end loop;
 update public.organization_closure_cleanup_attempts set source_outcomes=outcomes where org_id=p_org and closure_request_id=p_request and attempt_id=p_attempt;
 return outcomes;
end $$;
revoke all on function public.run_organization_closure_sql_cleanup(uuid,uuid,integer,uuid) from public,anon,authenticated,service_role;

create function public.finish_organization_closure_cleanup(p_org uuid,p_request uuid,p_revision integer,p_attempt uuid,p_failure_code text default null,p_failure_source text default null) returns jsonb
 language plpgsql security invoker set search_path='' as $$
declare attempt public.organization_closure_cleanup_attempts;assessment jsonb;cleanup_result jsonb;failed boolean;
begin
 if session_user<>current_user or not exists(select 1 from pg_catalog.pg_roles where rolname=current_user and rolsuper) or current_setting('transaction_isolation')<>'read committed' or current_setting('session_replication_role')<>'origin' then raise exception 'Actual cleanup operator required' using errcode='42501';end if;
 if (p_failure_code is null)<>(p_failure_source is null) or p_failure_code is not null and (p_failure_code not in('busy','capacity','reconciliation_required','conflict','source_failed','timeout','storage_failed','storage_outcome_unknown','worker_failed') or p_failure_source not in('library_objects','direct_assets','page_copies','worker')) then raise exception 'Fixed cleanup failure classification required' using errcode='22023';end if;
 perform 1 from public.organizations where user_id=p_org for update;
 if not found or not public.organization_closure_cleanup_due(p_org,p_request,p_revision) then raise exception 'Current cleanup eligibility required' using errcode='42501';end if;
 select * into attempt from public.organization_closure_cleanup_attempts where org_id=p_org and closure_request_id=p_request and attempt_id=p_attempt for update;
 if not found or attempt.closure_revision<>p_revision or attempt.operator_role<>session_user then raise exception 'Exact cleanup claim required' using errcode='42501';end if;
 if attempt.phase='finished' then
  if attempt.result->>'reportedFailureCode' is distinct from p_failure_code or attempt.result->>'reportedFailureSource' is distinct from p_failure_source then raise exception 'Cleanup outcome retry changed' using errcode='23505';end if;return attempt.result;
 end if;
 if clock_timestamp()>=attempt.lease_until then raise exception 'Cleanup claim expired' using errcode='42501';end if;
 assessment:=public.organization_closure_cleanup_assessment(p_org);
 failed:=p_failure_code is not null or exists(select 1 from jsonb_each(coalesce(attempt.source_outcomes,'{}')) where value->>'state'='failed');
 cleanup_result:=jsonb_build_object('status',case when failed then 'failed' when coalesce((assessment->>'remainingCount')::bigint,0)>0 then 'pending' else 'blocked' end,
  'code',case when failed then coalesce(p_failure_code,'source_failed') else 'qualification_required' end,
  'reportedFailureCode',p_failure_code,'reportedFailureSource',p_failure_source,'assessment',assessment,'wholeCleanupComplete',false);
 update public.organization_closure_cleanup_attempts set phase='finished',result=cleanup_result,finished_at=clock_timestamp() where org_id=p_org and closure_request_id=p_request and attempt_id=p_attempt;
 return cleanup_result;
end $$;
revoke all on function public.finish_organization_closure_cleanup(uuid,uuid,integer,uuid,text,text) from public,anon,authenticated,service_role;
comment on table public.organization_closure_cleanup_attempts is
 'Private finite-source worker claim/result receipts. Fixed leases never extend the lifecycle export deadline. Source-specific receipts remain effect authority; failures use fixed codes and no raw errors. Finished attempts are immutable; current pending physical450 and external qualifications prevent whole-cleanup completion.';
commit;
