-- Source-owned operating content only. No external provider cancellation,
-- financial evidence deletion, identity deletion or closure activation.
begin;
create function public.project_retired_operating_profile(p_profile jsonb) returns jsonb
language plpgsql immutable set search_path='' as $$
begin
 if p_profile is null or jsonb_typeof(p_profile)<>'object' then raise exception 'Operating profile ownership requires reconciliation' using errcode='42501';end if;
 return p_profile-array['org_people','people_roles','people_import_history'];
end $$;
revoke all on function public.project_retired_operating_profile(jsonb) from public,anon,authenticated,service_role;

create table public.organization_closure_operating_cleanups (
 org_id uuid not null,closure_request_id uuid not null,operation_id uuid not null,
 closure_revision integer not null check(closure_revision>0),operator_role text not null,
 transaction_id bigint not null,state text not null check(state in('running','complete')),
 result jsonb,created_at timestamptz not null default clock_timestamp(),completed_at timestamptz,
 primary key(org_id,closure_request_id,operation_id),
 check((state='complete')=(result is not null and completed_at is not null))
);
alter table public.organization_closure_operating_cleanups enable row level security;
revoke all on public.organization_closure_operating_cleanups from public,anon,authenticated,service_role;
create function public.guard_closure_operating_cleanup_receipt() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if tg_op<>'UPDATE' then raise exception 'Operating cleanup receipts are retained' using errcode='42501';end if;
 if (to_jsonb(new)-array['state','result','completed_at']) is distinct from (to_jsonb(old)-array['state','result','completed_at'])
  or old.state<>'running' or new.state<>'complete' or new.result is null or new.completed_at is null then
  raise exception 'Operating cleanup receipt is immutable' using errcode='42501';end if;
 return new;
end $$;
revoke all on function public.guard_closure_operating_cleanup_receipt() from public,anon,authenticated,service_role;
create trigger closure_operating_cleanup_immutable before update or delete on public.organization_closure_operating_cleanups for each row execute function public.guard_closure_operating_cleanup_receipt();
create trigger closure_operating_cleanup_retained before truncate on public.organization_closure_operating_cleanups for each statement execute function public.guard_closure_operating_cleanup_receipt();

create function public.closure_operating_retirement_allowed(p_org uuid) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 if coalesce(nullif(current_setting('role',true),'none'),session_user)<>session_user
  or not exists(select 1 from pg_catalog.pg_roles where rolname=session_user and rolsuper)
  or current_setting('transaction_isolation')<>'read committed' or current_setting('session_replication_role')<>'origin' then return false;end if;
 return exists(select 1 from public.organization_closure_operating_cleanups r
  join public.organization_closures c on c.org_id=r.org_id and c.request_id=r.closure_request_id and c.revision=r.closure_revision
  where r.org_id=p_org and r.operator_role=session_user and r.transaction_id=txid_current() and r.state='running'
   and c.state='closing' and c.export_until=c.requested_at+interval '720 hours' and clock_timestamp()>=c.export_until);
end $$;
revoke all on function public.closure_operating_retirement_allowed(uuid) from public,anon,authenticated,service_role;
create function public.closure_operating_profile_retirement_allowed(p_old jsonb,p_new jsonb) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 if not public.closure_operating_retirement_allowed((p_old->>'user_id')::uuid) then return false;end if;
 return (p_old-array['profile','updated_at'])=(p_new-array['profile','updated_at'])
  and p_new->'profile'=public.project_retired_operating_profile(p_old->'profile');
end $$;
revoke all on function public.closure_operating_profile_retirement_allowed(jsonb,jsonb) from public,anon,authenticated,service_role;

-- Required starts_at uses an explicit content-retirement sentinel, not a real
-- event time. Keep original status/id/org so no provider cancellation is implied.
create function public.project_retired_local_calendar_event(p_row jsonb) returns jsonb
language sql stable set search_path='' as $$
 select p_row||jsonb_build_object('title','','description',null,'starts_at','1970-01-01 00:00:00+00'::timestamptz,
  'ends_at',null,'all_day',false,'recurrence',null,'assigned_roles','[]'::jsonb,'event_type','other')
$$;
revoke all on function public.project_retired_local_calendar_event(jsonb) from public,anon,authenticated,service_role;

-- Append to350's exact profile boundary; never replace its projection/guards.
do $migration$
declare definition text;needle text;replacement text;target text;
begin
 foreach target in array array['guard_organization_row_closure','guard_free_workspace_documents','capture_core_document_versions','record_organization_document_activity'] loop
  definition:=pg_get_functiondef(('public.'||target||'()')::regprocedure);
  if strpos(definition,'closure_core_profile_retirement_allowed')=0 then raise exception 'Core cleanup predecessor required: %',target;end if;
  needle:='begin'||chr(10);
  replacement:=needle||' if tg_op=''UPDATE'' and public.closure_operating_profile_retirement_allowed(to_jsonb(old),to_jsonb(new)) then return new;end if;'||chr(10);
  if (length(definition)-length(replace(definition,needle,'')))/length(needle)<>1 then raise exception 'Unexpected operating profile predecessor: %',target;end if;
  execute replace(definition,needle,replacement);
 end loop;
 foreach target in array array['guard_organization_people_closure','guard_organization_opportunity_closure'] loop
  definition:=pg_get_functiondef(('public.'||target||'()')::regprocedure);
  needle:=' perform public.guard_organization_closure(org);';
  replacement:=' if public.closure_operating_retirement_allowed(org) then
   if tg_op=''DELETE'' then return old;end if;
   if tg_table_name=''finance_opportunity_scan_runs'' and tg_op=''UPDATE''
    and old.status in(''succeeded'',''failed'') and new.error_message is null
    and new.error_code is not distinct from (case when old.status=''failed'' then ''closure_content_retired'' end)
    and (to_jsonb(old)-array[''error_code'',''error_message'',''updated_at''])=(to_jsonb(new)-array[''error_code'',''error_message'',''updated_at'']) then return new;end if;
  end if;'||chr(10)||needle;
  -- People rows do not contain scan fields: use JSON to keep shared trigger
  -- record planning independent of the selected table.
  replacement:=replace(replace(replace(replacement,'old.status','(to_jsonb(old)->>''status'')'),'new.error_message','(to_jsonb(new)->>''error_message'')'),'new.error_code','(to_jsonb(new)->>''error_code'')');
  if (length(definition)-length(replace(definition,needle,'')))/length(needle)<>1 then raise exception 'Unexpected operating source predecessor: %',target;end if;
  execute replace(definition,needle,replacement);
 end loop;
 definition:=pg_get_functiondef('public.guard_brand_kit_closure()'::regprocedure);
 needle:=' perform public.guard_uploaded_document_organization(org);';
 replacement:=' if tg_op=''DELETE'' and public.closure_operating_retirement_allowed(org) then return old;end if;'||chr(10)||needle;
 if (length(definition)-length(replace(definition,needle,'')))/length(needle)<>1 then raise exception 'Unexpected brand predecessor';end if;
 execute replace(definition,needle,replacement);
 definition:=pg_get_functiondef('public.guard_organization_calendar_closure()'::regprocedure);
 needle:=' perform public.guard_organization_closure(org);';
 replacement:=' if tg_op=''UPDATE'' and tg_table_name in(''roadmap_calendar_public_events'',''roadmap_calendar_internal_events'')
  and public.closure_operating_retirement_allowed(org)
  and (to_jsonb(new)-''updated_at'')=(public.project_retired_local_calendar_event(to_jsonb(old))-''updated_at'') then return new;end if;'||chr(10)||needle;
 if (length(definition)-length(replace(definition,needle,'')))/length(needle)<>1 then raise exception 'Unexpected calendar predecessor';end if;
 execute replace(definition,needle,replacement);
end $migration$;

create function public.purge_expired_organization_operating_content(p_org_id uuid,p_closure_request_id uuid,p_expected_closure_revision integer,p_operation_id uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare closure public.organization_closures;prior public.organization_closure_operating_cleanups;
 old_profile jsonb;next_profile jsonb;before_capture jsonb;cleanup_result jsonb;
 tags integer;segments integer;tag_links integer;segment_links integer;brands integer;public_events integer;internal_events integer;matches integer;opportunities integer;engagement integer;scans integer;
begin
 if session_user<>current_user or not exists(select 1 from pg_catalog.pg_roles where rolname=current_user and rolsuper)
  or current_setting('transaction_isolation')<>'read committed' or current_setting('session_replication_role')<>'origin' then
  raise exception 'Actual operating cleanup operator required' using errcode='42501';end if;
 if p_org_id is null or p_closure_request_id is null or p_operation_id is null or p_expected_closure_revision is null or p_expected_closure_revision<1 then raise exception 'Exact operating cleanup identity required' using errcode='22023';end if;
 select profile into old_profile from public.organizations where user_id=p_org_id for update;
 if not found then raise exception 'Organization unavailable' using errcode='42501';end if;
 select * into closure from public.organization_closures where org_id=p_org_id;
 if not found or closure.state<>'closing' or closure.request_id is distinct from p_closure_request_id or closure.revision is distinct from p_expected_closure_revision
  or closure.export_until is null or closure.requested_at is null or closure.export_until<>closure.requested_at+interval '720 hours' or clock_timestamp()<closure.export_until then raise exception 'Expired current closure required' using errcode='42501';end if;
 select * into prior from public.organization_closure_operating_cleanups where org_id=p_org_id and closure_request_id=p_closure_request_id and operation_id=p_operation_id;
 if found then
  if prior.closure_revision<>p_expected_closure_revision or prior.state<>'complete' then raise exception 'Operating cleanup retry changed' using errcode='23505';end if;
  return prior.result;
 end if;
 if exists(select 1 from public.finance_opportunity_scan_runs where org_id=p_org_id and status in('queued','running')) then raise exception 'Opportunity scan effects require reconciliation' using errcode='42501';end if;
 if exists(select 1 from public.roadmap_calendar_public_feeds where org_id=p_org_id) or exists(select 1 from public.roadmap_calendar_internal_feeds where org_id=p_org_id)
  or exists(select 1 from public.roadmap_calendar_public_events e where e.org_id=p_org_id and not exists(select 1 from public.organization_calendar_publication_revocations r where r.event_id=e.id and r.org_id=p_org_id)) then raise exception 'Calendar publication shutdown requires reconciliation' using errcode='42501';end if;
 -- Unknown future payload fields require an owner decision, not silent retention.
 if exists(select 1 from pg_catalog.pg_attribute where attrelid='public.finance_opportunity_scan_runs'::regclass and attnum>0 and not attisdropped and attname<>all(array['id','source_id','org_id','status','started_at','finished_at','items_seen','items_created','items_updated','items_matched','error_code','error_message','retry_count','trace_id','created_at','updated_at'])) then raise exception 'Scan payload schema requires reconciliation' using errcode='42501';end if;
 if exists(select 1 from pg_catalog.pg_attribute where attrelid in('public.roadmap_calendar_public_events'::regclass,'public.roadmap_calendar_internal_events'::regclass) and attnum>0 and not attisdropped and attname<>all(array['id','org_id','title','description','starts_at','ends_at','all_day','recurrence','status','assigned_roles','created_at','updated_at','event_type'])) then raise exception 'Calendar payload schema requires reconciliation' using errcode='42501';end if;
 next_profile:=public.project_retired_operating_profile(old_profile);
 before_capture:=public.read_organization_suppression_events();
 perform 1 from public.organization_people_tags where org_id=p_org_id order by id for update nowait;
 perform 1 from public.organization_people_segments where org_id=p_org_id order by id for update nowait;
 perform 1 from public.organization_people_tag_members m join public.organization_people_tags t on t.id=m.tag_id where t.org_id=p_org_id order by m.tag_id,m.person_id for update of m nowait;
 perform 1 from public.organization_people_segment_members m join public.organization_people_segments s on s.id=m.segment_id where s.org_id=p_org_id order by m.segment_id,m.person_id for update of m nowait;
 perform 1 from public.organization_brand_kits where org_id=p_org_id for update nowait;
 perform 1 from public.roadmap_calendar_public_events where org_id=p_org_id order by id for update nowait;
 perform 1 from public.roadmap_calendar_internal_events where org_id=p_org_id order by id for update nowait;
 perform 1 from public.organization_resource_opportunity_matches where org_id=p_org_id order by id for update nowait;
 perform 1 from public.organization_finance_opportunities where org_id=p_org_id order by id for update nowait;
 perform 1 from public.organization_finance_engagement_events where org_id=p_org_id order by id for update nowait;
 perform 1 from public.finance_opportunity_scan_runs where org_id=p_org_id order by id for update nowait;
 -- Parent tuple locks also exclude concurrent FK attachment from another org.
 -- Recheck with a fresh READ COMMITTED snapshot after obtaining those locks.
 if exists(select 1 from public.organization_resource_opportunity_matches m join public.organization_finance_opportunities o on o.id=m.opportunity_id where (m.org_id=p_org_id or o.org_id=p_org_id) and m.org_id<>o.org_id) then raise exception 'Independent opportunity references require reconciliation' using errcode='42501';end if;
 insert into public.organization_closure_operating_cleanups(org_id,closure_request_id,operation_id,closure_revision,operator_role,transaction_id,state)
 values(p_org_id,p_closure_request_id,p_operation_id,p_expected_closure_revision,session_user,txid_current(),'running');
 if old_profile is distinct from next_profile then update public.organizations set profile=next_profile where user_id=p_org_id;end if;
 delete from public.organization_people_tag_members m using public.organization_people_tags t where m.tag_id=t.id and t.org_id=p_org_id;get diagnostics tag_links=row_count;
 delete from public.organization_people_segment_members m using public.organization_people_segments s where m.segment_id=s.id and s.org_id=p_org_id;get diagnostics segment_links=row_count;
 delete from public.organization_people_tags where org_id=p_org_id;get diagnostics tags=row_count;
 delete from public.organization_people_segments where org_id=p_org_id;get diagnostics segments=row_count;
 delete from public.organization_brand_kits where org_id=p_org_id;get diagnostics brands=row_count;
 update public.roadmap_calendar_public_events set title='',description=null,starts_at='1970-01-01 00:00:00+00',ends_at=null,all_day=false,recurrence=null,assigned_roles='{}',event_type='other' where org_id=p_org_id and (to_jsonb(roadmap_calendar_public_events)-'updated_at') is distinct from (public.project_retired_local_calendar_event(to_jsonb(roadmap_calendar_public_events))-'updated_at');get diagnostics public_events=row_count;
 update public.roadmap_calendar_internal_events set title='',description=null,starts_at='1970-01-01 00:00:00+00',ends_at=null,all_day=false,recurrence=null,assigned_roles='{}',event_type='other' where org_id=p_org_id and (to_jsonb(roadmap_calendar_internal_events)-'updated_at') is distinct from (public.project_retired_local_calendar_event(to_jsonb(roadmap_calendar_internal_events))-'updated_at');get diagnostics internal_events=row_count;
 delete from public.organization_resource_opportunity_matches where org_id=p_org_id;get diagnostics matches=row_count;
 delete from public.organization_finance_opportunities where org_id=p_org_id;get diagnostics opportunities=row_count;
 delete from public.organization_finance_engagement_events where org_id=p_org_id;get diagnostics engagement=row_count;
 update public.finance_opportunity_scan_runs set error_message=null,error_code=case when status='failed' then 'closure_content_retired' end where org_id=p_org_id and (error_message is not null or error_code is distinct from case when status='failed' then 'closure_content_retired' end);get diagnostics scans=row_count;
 if public.read_organization_suppression_events() is distinct from before_capture then raise exception 'Operating cleanup changed suppression history' using errcode='42501';end if;
 cleanup_result:=jsonb_build_object('scope','organization_operating_content','profileChanged',old_profile is distinct from next_profile,'tagsDeleted',tags,'segmentsDeleted',segments,'tagLinksDeleted',tag_links,'segmentLinksDeleted',segment_links,'brandKitsDeleted',brands,'publicEventsRetired',public_events,'internalEventsRetired',internal_events,'resourceMatchesDeleted',matches,'opportunitiesDeleted',opportunities,'engagementDeleted',engagement,'scanDiagnosticsRetired',scans,'providerCancellationClaimed',false,'releaseQualified',false);
 update public.organization_closure_operating_cleanups set state='complete',result=cleanup_result,completed_at=clock_timestamp() where org_id=p_org_id and closure_request_id=p_closure_request_id and operation_id=p_operation_id;
 return cleanup_result;
end $$;
revoke all on function public.purge_expired_organization_operating_content(uuid,uuid,integer,uuid) from public,anon,authenticated,service_role;
comment on function public.purge_expired_organization_operating_content(uuid,uuid,integer,uuid) is
 'Private expired-closure operating payload retirement. Removes contacts including undo values, taxonomy, private brand and opportunity projections; retires local calendar payloads using explicit empty/epoch sentinels while preserving event/status/revocation/provider identities. Terminal scan diagnostics use closure_content_retired sentinel where failed status requires a code. No external cancellation, independent financial/security deletion, identity deletion or whole-organization completion.';
commit;
