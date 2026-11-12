-- New disclosure requires current native-file authority, including retained AI
-- origins. Existing reviewed copies retain their explicit page audience.
begin;
create or replace function public.commit_workspace_page(
 p_actor_id uuid,p_org_id uuid,p_page_id uuid,p_operation_id uuid,p_operation_hash text,
 p_expected_revision integer,p_intent text,p_draft jsonb,p_snapshot jsonb,p_expected_graph jsonb,
 p_expected_org_updated_at timestamptz,p_expected_drive_sources jsonb default '[]',
 p_expected_profile jsonb default null,p_canvas_id uuid default null,p_image_assets jsonb default '[]',
 p_document_assets jsonb default '[]',p_form_versions jsonb default '[]'
) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; board_state jsonb; file uuid;
begin
 if auth.role() is distinct from 'service_role' or p_actor_id is null
  or p_actor_id is distinct from public.organization_activity_actor_id() then
  raise exception 'Verified page actor required.' using errcode='42501';end if;
 if current_setting('transaction_isolation')<>'read committed' then
  raise exception 'Page source permission changed; retry.' using errcode='40001';end if;
 -- Preserve the existing organization -> member -> page -> board lock order,
 -- canonical graph CAS, closure/form/asset checks and exact replay receipts.
 perform 1 from public.organizations where user_id=p_org_id for update;
 perform public.guard_organization_closure(p_org_id);
 result:=public.commit_workspace_page_before_closure(p_actor_id,p_org_id,p_page_id,p_operation_id,p_operation_hash,
   p_expected_revision,p_intent,p_draft,p_snapshot,p_expected_graph,p_expected_org_updated_at,
   p_expected_drive_sources,p_expected_profile,p_canvas_id,p_image_assets,p_document_assets,p_form_versions);
 -- Replay discloses an already-reviewed copy; revocation must not require the
 -- survival of its sources. The inner writer still rechecks current editor role.
 if (result->>'replayed')::boolean or p_intent='make_private' then return result;end if;
 -- The inner writer holds the canonical board lock. Check the complete board's
 -- dependency relation: a selected record can reference another canvas or an
 -- immutable AI origin whose current file reference has been removed.
 select state into board_state from public.organization_workspace_boards where org_id=p_org_id;
 if not found then raise exception 'Board changed; review again' using errcode='40001';end if;
 for file in select distinct file_id from public.workspace_particle_board_files(p_org_id,board_state)
  where record_id in (select 'particle:'||value from jsonb_array_elements_text(p_draft->'particleIds'))
  order by file_id
 loop perform public.assert_workspace_particle_source_view(p_org_id,file,p_actor_id);end loop;
 -- A failed check rolls back page, asset and form mutations in this transaction.
 return result;
end; $$;
revoke all on function public.commit_workspace_page(uuid,uuid,uuid,uuid,text,integer,text,jsonb,jsonb,jsonb,timestamptz,jsonb,jsonb,uuid,jsonb,jsonb,jsonb)
 from public,anon,authenticated;
grant execute on function public.commit_workspace_page(uuid,uuid,uuid,uuid,text,integer,text,jsonb,jsonb,jsonb,timestamptz,jsonb,jsonb,uuid,jsonb,jsonb,jsonb) to service_role;
commit;
