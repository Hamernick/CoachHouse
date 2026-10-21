-- Service-only commit. The server builds/validates public JSON; clients cannot
-- submit snapshots or actor IDs directly to this function.
alter table public.organization_workspace_pages
  add column last_operation_id uuid,
  add column last_operation_actor uuid,
  add column last_operation_hash text,
  add constraint organization_workspace_pages_operation_receipt check (
    (last_operation_id is null and last_operation_actor is null and last_operation_hash is null)
    or (last_operation_id is not null and last_operation_actor is not null and last_operation_hash is not null
      and last_operation_hash ~ '^[a-f0-9]{64}$')
  );

create function public.commit_workspace_page(
  p_actor_id uuid, p_org_id uuid, p_page_id uuid, p_operation_id uuid,
  p_operation_hash text, p_expected_revision integer, p_intent text,
  p_draft jsonb, p_snapshot jsonb, p_expected_graph jsonb,
  p_expected_org_updated_at timestamptz,
  p_expected_drive_sources jsonb default '[]', p_expected_profile jsonb default null
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  organization public.organizations%rowtype;
  page public.organization_workspace_pages%rowtype;
  board_graph jsonb;
  selected_ids uuid[];
  member_role text;
  stamp timestamptz;
  source_check jsonb;
  drive_file public.organization_external_documents%rowtype;
begin
  if p_actor_id is null or p_org_id is null or p_page_id is null or p_operation_id is null
    or p_operation_hash is null or p_operation_hash !~ '^[a-f0-9]{64}$'
    or p_expected_revision is null or p_expected_revision < 0 or p_expected_revision >= 2147483647
    or p_intent is null or p_intent not in ('save_draft','publish','make_private') then
    raise exception 'Invalid page command' using errcode = '22023';
  end if;

  -- Lock organization and current membership before page/source state. Role
  -- removal or downgrade racing this transaction cannot authorize a later write.
  select * into organization from public.organizations where user_id=p_org_id for update;
  if not found then raise exception 'Organization unavailable' using errcode='42501'; end if;
  if p_actor_id <> p_org_id then
    select role into member_role from public.organization_memberships
      where org_id=p_org_id and member_id=p_actor_id for update;
    if not found or member_role is null or member_role not in ('owner','admin','staff') then
      raise exception 'Organization editor required' using errcode='42501';
    end if;
  end if;

  select * into page from public.organization_workspace_pages where id=p_page_id for update;
  if found then
    if page.org_id <> p_org_id then raise exception 'Page unavailable' using errcode='42501'; end if;
    if page.last_operation_id=p_operation_id then
      if page.last_operation_actor is distinct from p_actor_id or page.last_operation_hash is distinct from p_operation_hash then
        raise exception 'Operation identity reused' using errcode='22023';
      end if;
      return jsonb_build_object('page',to_jsonb(page),'replayed',true);
    end if;
    if page.revision <> p_expected_revision then
      raise exception 'Page changed; review again' using errcode='40001';
    end if;
  elsif p_expected_revision <> 0 or p_intent='make_private' then
    raise exception 'Page changed; review again' using errcode='40001';
  end if;

  -- Revocation must remain possible when a source has been deleted or changed.
  if p_intent <> 'make_private' then
    if jsonb_typeof(p_draft) is distinct from 'object'
      or jsonb_typeof(p_draft->'particleIds') is distinct from 'array'
      or jsonb_typeof(p_draft->'title') is distinct from 'string'
      or jsonb_typeof(p_draft->'description') is distinct from 'string' then
      raise exception 'Invalid page draft' using errcode='22023';
    end if;
    select array_agg(value::uuid order by ordinal) into selected_ids
      from jsonb_array_elements_text(p_draft->'particleIds') with ordinality as ids(value,ordinal);
    if not public.workspace_page_membership_valid(selected_ids) then
      raise exception 'Invalid page selection' using errcode='22023';
    end if;
    select state->'particleGraph' into board_graph from public.organization_workspace_boards
      where org_id=p_org_id for update;
    if not found or board_graph is distinct from p_expected_graph
      or board_graph->>'workspaceId' is distinct from p_org_id::text then
      raise exception 'Board changed; review again' using errcode='40001';
    end if;
    if exists(select 1 from unnest(selected_ids) as selected(id) where not exists (
      select 1 from jsonb_array_elements(board_graph->'particles') as particles(item) where item->>'id'=selected.id::text
    )) then raise exception 'Selected Particle unavailable' using errcode='40001'; end if;
  end if;

  if p_intent='publish' then
    if organization.updated_at is distinct from p_expected_org_updated_at then
      raise exception 'Organization changed; review again' using errcode='40001';
    end if;
    perform 1 from public.public_handles where handle=organization.public_slug
      and owner_type='organization' and organization_id=p_org_id for update;
    if not found or exists(select 1 from public.public_handle_reservations where handle=organization.public_slug) then
      raise exception 'Choose an available organization public URL first' using errcode='22023';
    end if;
    if p_expected_profile is not null and organization.profile is distinct from p_expected_profile then
      raise exception 'Organization sources changed; review again' using errcode='40001';
    end if;
    if jsonb_typeof(p_expected_drive_sources) is distinct from 'array'
      or jsonb_array_length(p_expected_drive_sources)>50 then
      raise exception 'Invalid Drive source checks' using errcode='22023';
    end if;
    -- No provider work while holding locks. Compare actor-readable canonical
    -- metadata prepared by the server, in stable order to avoid lock inversions.
    for source_check in select value from jsonb_array_elements(p_expected_drive_sources) order by value->>'id' loop
      select * into drive_file from public.organization_external_documents
        where id=(source_check->>'id')::uuid and org_id=p_org_id for update;
      if not found or drive_file.provider is distinct from 'google_drive' or drive_file.status is distinct from 'available'
        or drive_file.provider_file_id is distinct from source_check->>'provider_file_id'
        or drive_file.web_view_link is distinct from source_check->>'web_view_link'
        or drive_file.updated_at is distinct from (source_check->>'updated_at')::timestamptz then
        raise exception 'Drive source changed; review again' using errcode='40001';
      end if;
    end loop;
    if jsonb_typeof(p_snapshot) is distinct from 'object'
      or p_snapshot#>>'{brand,organizationSlug}' is distinct from organization.public_slug
      or p_snapshot#>>'{brand,name}' is distinct from btrim(organization.profile->>'name')
      or p_snapshot->>'title' is distinct from p_draft->>'title'
      or p_snapshot->>'description' is distinct from p_draft->>'description'
      or p_snapshot->>'version' is distinct from '1'
      or jsonb_typeof(p_snapshot->'items') is distinct from 'array' then
      raise exception 'Invalid publication' using errcode='22023';
    end if;
    if (select array_agg(item->>'id' order by ordinal) from jsonb_array_elements(p_snapshot->'items')
      with ordinality as published(item,ordinal)) is distinct from selected_ids::text[] then
      raise exception 'Publication selection mismatch' using errcode='22023';
    end if;
  end if;

  stamp := clock_timestamp();
  if page.id is null then
    insert into public.organization_workspace_pages(id,org_id,link_id,title,description,particle_ids)
      values(p_page_id,p_org_id,p_page_id,p_draft->>'title',p_draft->>'description',selected_ids)
      returning * into page;
  end if;
  update public.organization_workspace_pages set
    title=case when p_intent='make_private' then title else p_draft->>'title' end,
    description=case when p_intent='make_private' then description else p_draft->>'description' end,
    particle_ids=case when p_intent='make_private' then particle_ids else selected_ids end,
    visibility=case when p_intent='publish' then 'public' when p_intent='make_private' then 'private' else visibility end,
    published_snapshot=case when p_intent='publish' then p_snapshot else published_snapshot end,
    published_at=case when p_intent='publish' then stamp else published_at end,
    revision=case when p_expected_revision=0 then 1 else revision+1 end,
    updated_at=stamp, last_operation_id=p_operation_id,
    last_operation_actor=p_actor_id, last_operation_hash=p_operation_hash
    where id=p_page_id returning * into page;
  return jsonb_build_object('page',to_jsonb(page),'replayed',false);
end;
$$;
revoke all on function public.commit_workspace_page(uuid,uuid,uuid,uuid,text,integer,text,jsonb,jsonb,jsonb,timestamptz,jsonb,jsonb)
  from public, anon, authenticated;
grant execute on function public.commit_workspace_page(uuid,uuid,uuid,uuid,text,integer,text,jsonb,jsonb,jsonb,timestamptz,jsonb,jsonb) to service_role;
