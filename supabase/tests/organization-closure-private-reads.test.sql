\set ON_ERROR_STOP on
begin;
set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000001';
select public.fixture_closure_private_reads();
set local role authenticated;
do $$ begin
 if exists(select 1 from jsonb_each_text(public.fixture_private_read_counts()) where value::integer<1) then raise exception 'Active private read missing'; end if;
 if not public.can_edit_uploaded_document(public.fixture_form_id(1001)) then raise exception 'Active document cannot edit'; end if;
end $$;
reset role;
select public.fixture_closure('request',600,0);
set local role authenticated;
do $$ begin
 if exists(select 1 from jsonb_each_text(public.fixture_private_read_counts()) where value::integer<1) then raise exception 'Authorized window read missing'; end if;
 if public.can_edit_uploaded_document(public.fixture_form_id(1001)) then raise exception 'Closing document remained editable'; end if;
end $$;
set local role service_role;
do $$ begin
 if public.organization_storage_link_deadline(public.fixture_form_id(1),900) is null then raise exception 'Authorized download deadline missing'; end if;
 if has_function_privilege('authenticated','public.organization_storage_link_deadline(uuid,integer)','execute') then raise exception 'Deadline bypass API exposed'; end if;
 if public.read_workspace_ai_run(public.fixture_form_id(1801),public.fixture_form_id(1),public.fixture_form_id(1)) is null then raise exception 'Settled AI read missing'; end if;
 if public.read_fiscal_guest_application(public.fixture_form_id(2101),repeat('9',64)) is null then raise exception 'Verified guest window unavailable'; end if;
 if public.read_fiscal_guest_application(public.fixture_form_id(2101),repeat('8',64)) is not null then raise exception 'Unverified guest read'; end if;
 if public.access_workspace_research_draft(public.fixture_form_id(1810),public.fixture_form_id(1),public.fixture_form_id(1),repeat('a',64),null,null,null,null)->'draft' is null then raise exception 'Private draft read missing'; end if;
 begin
 perform public.access_workspace_research_draft(public.fixture_form_id(1810),public.fixture_form_id(1),public.fixture_form_id(1),repeat('a',64),public.fixture_form_id(2402),1,'{}',false);
 raise exception 'Closing draft write admitted'; exception when insufficient_privilege then null; end;
end $$;
reset role;
update public.organization_closures set requested_at=now()-interval '721 hours',export_until=now()-interval '1 hour' where org_id=public.fixture_form_id(1);
set local role authenticated;
do $$ begin
 if exists(select 1 from jsonb_each_text(public.fixture_private_read_counts()) where value::integer<>0) then raise exception 'Expired private read returned'; end if;
 if exists(select 1 from public.organization_people_tag_members) or exists(select 1 from public.organization_people_segment_members) or exists(select 1 from public.document_collaboration_updates) then raise exception 'Expired parent-owned child read'; end if;
 if exists(select 1 from storage.objects where bucket_id='org-documents' and name like public.fixture_form_id(1)::text||'/%') then raise exception 'Expired private Storage read'; end if;
 begin perform public.read_workspace_objective_plans_v2(public.fixture_form_id(1)); raise exception 'Expired legacy plan read'; exception when insufficient_privilege then null; end;
 if has_function_privilege('authenticated','public.read_workspace_objective_plans_before_read_closure(uuid)','execute') then raise exception 'Legacy reader bypass'; end if;
end $$;
set local role service_role;
do $$ begin
 if public.organization_storage_link_deadline(public.fixture_form_id(1),900) is not null then raise exception 'Expired download admitted'; end if;
 if public.read_workspace_ai_run(public.fixture_form_id(1801),public.fixture_form_id(1),public.fixture_form_id(1)) is not null then raise exception 'Expired AI run returned'; end if;
 if public.read_fiscal_guest_application(public.fixture_form_id(2101),repeat('9',64)) is not null or public.get_fiscal_guest_receipt(repeat('1',64)) is not null then raise exception 'Expired fiscal return'; end if;
 if public.get_fiscal_guest_project_summary(public.fixture_form_id(1401),public.fixture_form_id(1)) is not null then raise exception 'Expired reviewer summary'; end if;
 begin perform public.list_workspace_research_runs(public.fixture_form_id(1),public.fixture_form_id(1),null,null,null); raise exception 'Expired AI discovery'; exception when insufficient_privilege then null; end;
 begin perform public.access_workspace_research_draft(public.fixture_form_id(1810),public.fixture_form_id(1),public.fixture_form_id(1),repeat('a',64),null,null,null,null); raise exception 'Expired private draft'; exception when insufficient_privilege then null; end;
 if has_function_privilege('service_role','public.fiscal_guest_application_access_before_read_closure(uuid,text)','execute') or has_function_privilege('service_role','public.get_fiscal_guest_receipt_before_read_closure(text)','execute') then raise exception 'Private reader bypass'; end if;
 -- Reconciliation remains separate from private projection expiry.
 perform public.recover_workspace_ai_runs(public.fixture_form_id(1));
end $$;
reset role;
do $$ begin
 if (select proposal from public.workspace_ai_runs where id=public.fixture_form_id(1801)) is null then raise exception 'Private evidence erased'; end if;
 if (select count(*) from public.organization_document_files where org_id=public.fixture_form_id(1))<>1 then raise exception 'File erased'; end if;
end $$;
-- Real shared identity deletion remains independent and preserves other orgs.
delete from auth.users where id=public.fixture_form_id(13);
do $$ begin
 if not exists(select 1 from public.organizations where user_id=public.fixture_form_id(2)) then raise exception 'Other organization removed'; end if;
 if not exists(select 1 from public.organization_core_document_versions where org_id=public.fixture_form_id(1) and actor_id is null) then raise exception 'Attribution cleanup failed'; end if;
end $$;
rollback;
