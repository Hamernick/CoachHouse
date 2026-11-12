begin;

-- One bounded server request for the map/profile candidate set; each organization
-- retains the existing fresh public/closure admission and document veto.
create function public.read_public_document_audiences(
  p_org_ids uuid[], p_section_ids text[], p_audience text default 'profile'
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare org_id uuid; audience jsonb; result jsonb := '[]'::jsonb;
begin
  if auth.role() is distinct from 'service_role' then
    raise insufficient_privilege using message = 'Public document reader requires service access.';
  end if;
  if p_org_ids is null or cardinality(p_org_ids) > 500 or array_position(p_org_ids, null) is not null
     or p_section_ids is null or cardinality(p_section_ids) > 500
     or exists(select 1 from unnest(p_section_ids) id where id is null or id !~ '^[A-Za-z0-9_:-]{1,120}$')
     or p_audience is null or p_audience not in ('profile', 'roadmap') then
    raise invalid_parameter_value using message = 'Invalid public document audience request.';
  end if;
  for org_id in select distinct id from unnest(p_org_ids) id order by id loop
    audience := public.read_public_document_audience(org_id, p_section_ids, p_audience);
    if audience is not null then
      result := result || jsonb_build_array(audience || jsonb_build_object('organizationId', org_id));
    end if;
  end loop;
  return result;
end;
$$;
revoke all on function public.read_public_document_audiences(uuid[],text[],text) from public, anon, authenticated;
grant execute on function public.read_public_document_audiences(uuid[],text[],text) to service_role;

-- The search view is private. Evaluate document authority before producing its
-- narrative tsvector, so hidden text cannot affect matching or ranking. Invoker
-- privileges are supplied only by the existing authenticated search definer.
create function public.public_organization_search_narrative(
  p_org_id uuid, p_profile jsonb, p_section_id text, p_legacy_key text
) returns text language plpgsql stable set search_path = '' as $$
begin
  if exists(select 1 from public.core_document_folder_authorities a
      where a.org_id = p_org_id and a.section_id = p_section_id)
     or (public.inspect_document_copy_lineage(p_org_id, array[p_section_id])->'blockedSectionIds') ? p_section_id then
    return '';
  end if;
  return public.public_organization_narrative_plain_text(p_profile, p_section_id, p_legacy_key);
end;
$$;
revoke all on function public.public_organization_search_narrative(uuid,jsonb,text,text) from public, anon, authenticated, service_role;

do $$ declare definition text; needle text := 'public_organization_narrative_plain_text(o.profile,'; begin
  definition := pg_get_viewdef('public.search_index'::regclass, true);
  if position(needle in definition) = 0 or position('public_organization_search_narrative(' in definition) > 0 then
    raise exception 'Unexpected public search narrative definition';
  end if;
  execute 'create or replace view public.search_index as ' || replace(definition, needle,
    'public_organization_search_narrative(o.user_id, o.profile,');
end $$;
-- CREATE OR REPLACE preserves view identity/options. Reassert its private ACL.
revoke all on public.search_index from public, anon, authenticated;
commit;
