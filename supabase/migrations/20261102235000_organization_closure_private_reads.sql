-- Fixed export-window restrictions intersect existing authority; no new read grants.
begin;
do $$ declare relation text; begin
 foreach relation in array array[
  'organization_workspace_boards','organization_workspace_pages','organization_brand_kits',
  'organization_people_tags','organization_people_segments','organization_finance_access',
  'organization_finance_records','organization_finance_record_evidence','organization_finance_record_events',
  'organization_finance_record_corrections','organization_finance_record_provider_evidence',
  'organization_finance_opportunities','organization_finance_engagement_events','finance_opportunity_scan_runs',
  'organization_resource_opportunity_matches','organization_document_files','document_collaboration_rooms',
  'document_file_versions','document_version_operations','organization_core_document_versions',
  'organization_core_document_sessions','organization_core_document_presence','organization_projects',
  'organization_tasks','organization_task_assignees','organization_project_notes','organization_project_quick_links',
  'organization_project_assets','organization_project_overview_documents','organization_project_activity_events',
  'organization_workspace_starter_state','task_tracker_import_batches','organization_memberships',
  'organization_access_settings','organization_invites','organization_access_requests',
  'fiscal_sponsorship_applications','fiscal_sponsorship_reviews','fiscal_sponsorship_documents',
  'fiscal_sponsorship_signature_packets','fiscal_sponsorship_signatures','fiscal_sponsorship_signing_drafts',
  'fiscal_sponsorship_events','organization_workspace_objectives','organization_workspace_objective_groups','organization_workspace_objective_steps',
  'organization_workspace_objective_assignees','organization_workspace_objective_links','organization_workspace_objective_activity',
  'workspace_objective_plans','workspace_objective_plan_steps','workspace_objective_plan_edges'
 ] loop
  execute format('create policy organization_closure_read on public.%I as restrictive for select to anon,authenticated using(public.organization_closure_read_window(org_id))',relation);
 end loop;
end $$;

create function public.organization_closure_parent_read(p_kind text,p_id uuid) returns boolean
 language plpgsql security definer set search_path='' as $$
declare org uuid;
begin
 case p_kind
 when 'tag' then select org_id into org from public.organization_people_tags where id=p_id;
 when 'segment' then select org_id into org from public.organization_people_segments where id=p_id;
 when 'room' then select org_id into org from public.document_collaboration_rooms where id=p_id;
 when 'import' then select org_id into org from public.task_tracker_import_batches where id=p_id;
 else return false;
 end case;
 return org is not null and public.organization_closure_read_window(org);
end $$;
revoke all on function public.organization_closure_parent_read(text,uuid) from public,anon,authenticated,service_role;
grant execute on function public.organization_closure_parent_read(text,uuid) to anon,authenticated;
create policy organization_closure_read on public.organization_people_tag_members as restrictive for select to anon,authenticated
 using(public.organization_closure_parent_read('tag',tag_id));
create policy organization_closure_read on public.organization_people_segment_members as restrictive for select to anon,authenticated
 using(public.organization_closure_parent_read('segment',segment_id));
create policy organization_closure_read on public.document_collaboration_updates as restrictive for select to anon,authenticated
 using(public.organization_closure_parent_read('room',room_id));
create policy organization_closure_read on public.task_tracker_import_records as restrictive for select to anon,authenticated
 using(public.organization_closure_parent_read('import',batch_id));

create function public.program_closure_read_window(p_owner uuid) returns boolean
 language plpgsql security definer set search_path='' as $$
begin
 if current_setting('transaction_isolation')<>'read committed' then return false; end if;
 if exists(select 1 from public.organizations where user_id=p_owner) then
  return public.organization_closure_read_window(p_owner);
 end if;
 -- A personal Auth-owned program is not implicitly an organization. Original
 -- program policies still control whether this caller may see it.
 return exists(select 1 from auth.users where id=p_owner);
end $$;
revoke all on function public.program_closure_read_window(uuid) from public,anon,authenticated,service_role;
grant execute on function public.program_closure_read_window(uuid) to anon,authenticated;
create policy organization_closure_read on public.programs as restrictive for select to anon,authenticated
 using(public.program_closure_read_window(user_id));

-- Private service fiscal readers bypass table RLS. Join their existing authority
-- helpers to the actual host application organization, never the linked applicant.
create function public.fiscal_submission_read_window(p_reference uuid) returns boolean
 language plpgsql security definer set search_path='' as $$
declare org uuid;
begin
 select a.org_id into org from public.fiscal_guest_submissions s join public.fiscal_sponsorship_applications a on a.id=s.application_id where s.id=p_reference;
 return org is not null and public.organization_closure_read_window(org);
end $$;
revoke all on function public.fiscal_submission_read_window(uuid) from public,anon,authenticated,service_role;
alter function public.fiscal_linked_applicant_access(uuid) rename to fiscal_linked_applicant_access_before_read_closure;
create function public.fiscal_linked_applicant_access(p_reference uuid) returns boolean
 language plpgsql security definer set search_path='' as $$
begin
 return public.fiscal_submission_read_window(p_reference) and public.fiscal_linked_applicant_access_before_read_closure(p_reference);
end $$;
revoke all on function public.fiscal_linked_applicant_access(uuid),public.fiscal_linked_applicant_access_before_read_closure(uuid) from public,anon,authenticated,service_role;
alter function public.fiscal_guest_application_access(uuid,text) rename to fiscal_guest_application_access_before_read_closure;
create function public.fiscal_guest_application_access(p_reference uuid,p_key_hash text) returns boolean
 language plpgsql security definer set search_path='' as $$
begin
 return public.fiscal_submission_read_window(p_reference) and public.fiscal_guest_application_access_before_read_closure(p_reference,p_key_hash);
end $$;
revoke all on function public.fiscal_guest_application_access(uuid,text),public.fiscal_guest_application_access_before_read_closure(uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.fiscal_guest_application_access(uuid,text) to service_role;

alter function public.fiscal_guest_project_reviewer_access(uuid,uuid) rename to fiscal_guest_project_reviewer_access_before_read_closure;
create function public.fiscal_guest_project_reviewer_access(p_project_id uuid,p_user_id uuid) returns boolean
 language plpgsql security definer set search_path='' as $$
declare allowed boolean; org uuid;
begin
 allowed:=public.fiscal_guest_project_reviewer_access_before_read_closure(p_project_id,p_user_id);
 if allowed is distinct from true then return allowed; end if;
 select org_id into org from public.organization_projects where id=p_project_id;
 return org is not null and public.organization_closure_read_window(org);
end $$;
revoke all on function public.fiscal_guest_project_reviewer_access(uuid,uuid),public.fiscal_guest_project_reviewer_access_before_read_closure(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.fiscal_guest_project_reviewer_access(uuid,uuid) to authenticated,service_role;

alter function public.get_fiscal_guest_receipt(text) rename to get_fiscal_guest_receipt_before_read_closure;
create function public.get_fiscal_guest_receipt(p_key_hash text) returns jsonb
 language plpgsql security definer set search_path='' as $$
declare reference uuid;
begin
 select id into reference from public.fiscal_guest_submissions where submission_key_hash=p_key_hash;
 if reference is null or not public.fiscal_submission_read_window(reference) then return null; end if;
 return public.get_fiscal_guest_receipt_before_read_closure(p_key_hash);
end $$;
revoke all on function public.get_fiscal_guest_receipt(text),public.get_fiscal_guest_receipt_before_read_closure(text) from public,anon,authenticated,service_role;
grant execute on function public.get_fiscal_guest_receipt(text) to service_role;

-- Ordinary editing remains unavailable during closure, even when read/export is
-- still permitted. The original document permission remains authoritative.
alter function public.can_edit_uploaded_document(uuid) rename to can_edit_uploaded_document_before_read_closure;
create function public.can_edit_uploaded_document(p_file_id uuid) returns boolean
 language plpgsql security definer set search_path='' as $$
declare org uuid;
begin
 select org_id into org from public.organization_document_files where id=p_file_id;
 if org is null then return false; end if;
 perform public.guard_uploaded_document_organization(org);
 return public.can_edit_uploaded_document_before_read_closure(p_file_id);
exception when insufficient_privilege or serialization_failure then return false;
end $$;
revoke all on function public.can_edit_uploaded_document(uuid),public.can_edit_uploaded_document_before_read_closure(uuid) from public,anon,authenticated,service_role;
grant execute on function public.can_edit_uploaded_document(uuid) to authenticated;

create function public.can_read_workspace_ai(p_org_id uuid,p_actor_id uuid) returns boolean
 language plpgsql security definer set search_path='' as $$
begin
 return public.organization_closure_read_window(p_org_id) and public.can_use_workspace_ai(p_org_id,p_actor_id);
end $$;
revoke all on function public.can_read_workspace_ai(uuid,uuid) from public,anon,authenticated,service_role;
-- Change only the read authority call in these actual service-owned projections.
-- Keep can_use_workspace_ai itself and cost/payment/refund reconciliation intact.
do $$ declare signature text; definition text; begin
 foreach signature in array array[
  'read_workspace_ai_account(uuid,uuid)','read_workspace_ai_run(uuid,uuid,uuid)',
  'read_workspace_ai_usage(uuid,uuid,uuid,text,timestamptz,uuid)',
  'read_workspace_ai_plan_baseline(uuid,uuid)','read_workspace_ai_plan_application(uuid,uuid)',
  'list_workspace_research_runs(uuid,uuid,uuid,text,uuid)',
  'read_ai_credit_allowance_setup(uuid,uuid,text)','read_ai_credit_limits(uuid,uuid)',
  'read_ai_credit_purchases(uuid,uuid,text)','read_ai_credit_refill(jsonb)'
 ] loop
  definition:=pg_get_functiondef(('public.'||signature)::regprocedure);
  if strpos(definition,'public.can_use_workspace_ai(')=0 then raise exception 'Unexpected private AI reader %',signature; end if;
  execute replace(definition,'public.can_use_workspace_ai(','public.can_read_workspace_ai(');
 end loop;
end $$;
-- The draft RPC serves reads and writes; preserve its current revision/retry
-- contract while separating export from new draft admission.
alter function public.access_workspace_research_draft(uuid,uuid,uuid,text,uuid,integer,jsonb,boolean) rename to access_workspace_research_draft_before_read_closure;
create function public.access_workspace_research_draft(p_run_id uuid,p_org_id uuid,p_actor_id uuid,p_base text,p_edit_id uuid,p_revision integer,p_draft jsonb,p_attempted boolean)
 returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if p_edit_id is null then
  if not public.organization_closure_read_window(p_org_id) then raise exception 'Draft access denied' using errcode='42501'; end if;
 else perform public.guard_uploaded_document_organization(p_org_id); end if;
 return public.access_workspace_research_draft_before_read_closure(p_run_id,p_org_id,p_actor_id,p_base,p_edit_id,p_revision,p_draft,p_attempted);
end $$;
revoke all on function public.access_workspace_research_draft(uuid,uuid,uuid,text,uuid,integer,jsonb,boolean),public.access_workspace_research_draft_before_read_closure(uuid,uuid,uuid,text,uuid,integer,jsonb,boolean) from public,anon,authenticated,service_role;
grant execute on function public.access_workspace_research_draft(uuid,uuid,uuid,text,uuid,integer,jsonb,boolean) to service_role;
-- Legacy plan readers are SECURITY DEFINER and therefore need explicit guards.
alter function public.read_workspace_objective_plans(uuid) rename to read_workspace_objective_plans_before_read_closure;
create function public.read_workspace_objective_plans(p_org_id uuid) returns jsonb
 language plpgsql security definer set search_path='' as $$
begin
 if not public.organization_closure_read_window(p_org_id) then raise exception 'Workspace unavailable' using errcode='42501'; end if;
 return public.read_workspace_objective_plans_before_read_closure(p_org_id);
end $$;
revoke all on function public.read_workspace_objective_plans(uuid),public.read_workspace_objective_plans_before_read_closure(uuid) from public,anon,authenticated,service_role;
grant execute on function public.read_workspace_objective_plans(uuid) to authenticated;
-- The v2 reader calls the guarded original before accessing its decision rows.

create function public.organization_storage_read_window(p_bucket text,p_name text) returns boolean
 language plpgsql security definer set search_path='' as $$
declare owner_text text; org uuid;
begin
 if p_bucket not in ('org-documents','project-assets','fiscal-signing','roadmap-media') then return true; end if;
 if current_setting('transaction_isolation')<>'read committed' then return false; end if;
 owner_text:=split_part(p_name,'/',1);
 if owner_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
  return public.program_closure_read_window(owner_text::uuid);
 end if;
 -- Historical fiscal paths use canonical host associations when no UUID owner
 -- prefix exists. An unknown legacy path retains existing Storage authority.
 for org in select distinct org_id from public.fiscal_sponsorship_documents where storage_bucket=p_bucket and storage_path=p_name
  union select org_id from public.organization_project_assets where p_bucket='project-assets' and storage_path=p_name loop
  if not public.organization_closure_read_window(org) then return false; end if;
 end loop;
 return true;
end $$;
revoke all on function public.organization_storage_read_window(text,text) from public,anon,authenticated,service_role;
grant execute on function public.organization_storage_read_window(text,text) to anon,authenticated;
create policy organization_closure_private_read on storage.objects as restrictive for select to anon,authenticated
 using(public.organization_storage_read_window(bucket_id,name));
comment on function public.organization_storage_read_window(text,text) is
 'Intersects existing private Storage SELECT only. No deletion or public-bucket retirement. Existing signed URLs expire independently; unassociated legacy paths require separate ownership reconciliation.';
-- Server-only deadline metadata, not resource authority. Callers retain the
-- original current actor/file check and verify the provider token before release.
create function public.organization_storage_link_deadline(p_org uuid,p_ttl integer) returns jsonb
 language plpgsql security definer set search_path='' as $$
declare deadline timestamptz; at_time timestamptz;
begin
 if p_ttl is null or p_ttl<1 or p_ttl>2592000 or not public.organization_closure_read_window(p_org) then return null; end if;
 at_time:=clock_timestamp();
 select export_until into deadline from public.organization_closures where org_id=p_org and state='closing';
 deadline:=least(coalesce(deadline,at_time+make_interval(secs=>p_ttl)),at_time+make_interval(secs=>p_ttl));
 if deadline<=at_time then return null; end if;
 return jsonb_build_object('serverNow',at_time,'expiresAt',deadline);
end $$;
revoke all on function public.organization_storage_link_deadline(uuid,integer) from public,anon,authenticated;
grant execute on function public.organization_storage_link_deadline(uuid,integer) to service_role;
commit;
