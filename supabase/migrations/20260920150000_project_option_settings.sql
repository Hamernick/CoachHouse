-- Project-local tag/type names, deleted choices and colors. Existing project RLS applies.
alter table public.organization_projects add column if not exists option_settings jsonb;
alter table public.organization_projects add constraint organization_project_option_settings_object
check (option_settings is null or (
  jsonb_typeof(option_settings) = 'object'
  and option_settings ? 'tags' and option_settings ? 'sprintTypes'
  and jsonb_typeof(option_settings->'tags') = 'array'
  and jsonb_typeof(option_settings->'sprintTypes') = 'array'
  and octet_length(option_settings::text) <= 65536
));

create or replace function public.create_organization_project_with_options(
  p_actor_id uuid, p_org_id uuid, p_project jsonb,
  p_has_overview_document boolean, p_overview_document_html text, p_overview_document_text text
) returns jsonb language plpgsql security definer set search_path = '' set row_security = off as $$
declare v_result jsonb;
begin
  v_result := public.create_organization_project_transition(p_actor_id, p_org_id, p_project,
    p_has_overview_document, p_overview_document_html, p_overview_document_text);
  if (v_result->>'ok')::boolean then
    update public.organization_projects set option_settings = p_project->'option_settings'
    where id = (v_result->>'projectId')::uuid and org_id = p_org_id;
  end if;
  return v_result;
end;
$$;

create or replace function public.update_organization_project_with_options(
  p_project_id uuid, p_actor_id uuid, p_expected_org_id uuid, p_expected_updated_at timestamptz,
  p_project jsonb, p_has_overview_document boolean, p_overview_document_html text, p_overview_document_text text
) returns jsonb language plpgsql security definer set search_path = '' set row_security = off as $$
declare v_result jsonb; v_updated_at timestamptz;
begin
  v_result := public.update_organization_project_transition(p_project_id, p_actor_id, p_expected_org_id,
    p_expected_updated_at, p_project, p_has_overview_document, p_overview_document_html, p_overview_document_text);
  if (v_result->>'ok')::boolean then
    update public.organization_projects set option_settings = p_project->'option_settings'
    where id = p_project_id and org_id = p_expected_org_id returning updated_at into v_updated_at;
    v_result := jsonb_set(v_result, '{updatedAt}', to_jsonb(v_updated_at));
  end if;
  return v_result;
end;
$$;

revoke all on function public.create_organization_project_with_options(uuid,uuid,jsonb,boolean,text,text) from public, anon, authenticated;
revoke all on function public.update_organization_project_with_options(uuid,uuid,uuid,timestamptz,jsonb,boolean,text,text) from public, anon, authenticated;
grant execute on function public.create_organization_project_with_options(uuid,uuid,jsonb,boolean,text,text) to service_role;
grant execute on function public.update_organization_project_with_options(uuid,uuid,uuid,timestamptz,jsonb,boolean,text,text) to service_role;
-- Rollback: drop the two *_with_options functions, then drop option_settings (loses saved choices/colors).
