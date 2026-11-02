-- Authenticated, resource-scoped page collaboration. No organization membership.
begin;
alter table public.organization_workspace_pages add column guest_snapshot jsonb;
create or replace function public.commit_workspace_page(
  p_actor_id uuid, p_org_id uuid, p_page_id uuid, p_operation_id uuid,
  p_operation_hash text, p_expected_revision integer, p_intent text,
  p_draft jsonb, p_snapshot jsonb, p_expected_graph jsonb,
  p_expected_org_updated_at timestamptz,
  p_expected_drive_sources jsonb default '[]', p_expected_profile jsonb default null,
  p_canvas_id uuid default null
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  organization public.organizations%rowtype;
  page public.organization_workspace_pages%rowtype;
  board_graph jsonb;
  board_state jsonb;
  canvas_matches integer;
  selected_ids uuid[];
  member_role text;
  stamp timestamptz;
  source_check jsonb;
  drive_file public.organization_external_documents%rowtype;
begin
  if p_actor_id is null or p_org_id is null or p_page_id is null or p_operation_id is null
    or p_operation_hash is null or p_operation_hash !~ '^[a-f0-9]{64}$'
    or p_expected_revision is null or p_expected_revision < 0 or p_expected_revision >= 2147483647
    or p_intent is null or p_intent not in ('save_draft','publish','make_private','share_with_guests') then
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
    if page.canvas_id is distinct from p_canvas_id then
      raise exception 'Page belongs to another canvas' using errcode='42501';
    end if;
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
    select state into board_state from public.organization_workspace_boards
      where org_id=p_org_id for update;
    if not found then raise exception 'Board unavailable' using errcode='40001'; end if;
    if p_canvas_id is null then
      if coalesce((board_state#>>'{workspaceCatalog,defaultDeleted}')::boolean,false) then
        raise exception 'Canvas unavailable' using errcode='40001';
      end if;
      board_graph := board_state->'particleGraph';
    else
      select count(*) into canvas_matches
        from jsonb_array_elements(coalesce(board_state#>'{workspaceCatalog,entries}','[]')) entry
        where entry->>'id'=p_canvas_id::text;
      if canvas_matches <> 1 then raise exception 'Canvas unavailable' using errcode='40001'; end if;
      select entry#>'{state,particleGraph}' into board_graph
        from jsonb_array_elements(board_state#>'{workspaceCatalog,entries}') entry
        where entry->>'id'=p_canvas_id::text;
    end if;
    if board_graph is null or board_graph is distinct from p_expected_graph
      or board_graph->>'workspaceId' is distinct from p_org_id::text then
      raise exception 'Board changed; review again' using errcode='40001';
    end if;
    if exists(select 1 from unnest(selected_ids) as selected(id) where not exists (
      select 1 from jsonb_array_elements(board_graph->'particles') as particles(item) where item->>'id'=selected.id::text
    )) then raise exception 'Selected Particle unavailable' using errcode='40001'; end if;
  end if;

  if p_intent in ('publish','share_with_guests') then
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
    insert into public.organization_workspace_pages(id,org_id,canvas_id,link_id,title,description,particle_ids)
      values(p_page_id,p_org_id,p_canvas_id,p_page_id,p_draft->>'title',p_draft->>'description',selected_ids)
      returning * into page;
  end if;
  update public.organization_workspace_pages set
    title=case when p_intent='make_private' then title else p_draft->>'title' end,
    description=case when p_intent='make_private' then description else p_draft->>'description' end,
    particle_ids=case when p_intent='make_private' then particle_ids else selected_ids end,
    visibility=case when p_intent='publish' then 'public' when p_intent='make_private' then 'private' else visibility end,
    published_snapshot=case when p_intent='publish' then p_snapshot else published_snapshot end,
    guest_snapshot=case when p_intent='share_with_guests' then p_snapshot else guest_snapshot end,
    published_at=case when p_intent='publish' then stamp else published_at end,
    revision=case when p_expected_revision=0 then 1 else revision+1 end,
    updated_at=stamp, last_operation_id=p_operation_id,
    last_operation_actor=p_actor_id, last_operation_hash=p_operation_hash
    where id=p_page_id returning * into page;
  return jsonb_build_object('page',to_jsonb(page),'replayed',false);
end;
$$;
revoke all on function public.commit_workspace_page(uuid,uuid,uuid,uuid,text,integer,text,jsonb,jsonb,jsonb,timestamptz,jsonb,jsonb,uuid)
  from public, anon, authenticated;
grant execute on function public.commit_workspace_page(uuid,uuid,uuid,uuid,text,integer,text,jsonb,jsonb,jsonb,timestamptz,jsonb,jsonb,uuid) to service_role;

create table public.workspace_page_invitations (
  id uuid primary key,
  page_id uuid not null references public.organization_workspace_pages(id) on delete cascade,
  email text not null check (length(email) between 3 and 254 and email=lower(btrim(email))),
  permission text not null check (permission in ('view','edit','manage')),
  invited_by uuid not null references auth.users(id) on delete cascade,
  parent_id uuid references public.workspace_page_invitations(id) on delete cascade,
  accepted_by uuid references auth.users(id) on delete cascade,
  accepted_at timestamptz,
  expires_at timestamptz not null default (now()+interval '7 days'),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check ((accepted_by is null)=(accepted_at is null))
);
create index workspace_page_invitations_page_idx on public.workspace_page_invitations(page_id);
create index workspace_page_invitations_actor_idx on public.workspace_page_invitations(page_id,accepted_by) where revoked_at is null;
create table public.workspace_page_guest_receipts (
  page_id uuid not null references public.organization_workspace_pages(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete cascade,
  operation_id uuid not null,
  command_hash text not null,
  action text not null check (action in ('invite','revoke','edit')),
  result_revision integer not null,
  changed_fields text[] not null default '{}',
  created_at timestamptz not null default now(),
  primary key(page_id,actor_id,operation_id)
);
alter table public.workspace_page_invitations enable row level security;
alter table public.workspace_page_guest_receipts enable row level security;
revoke all on public.workspace_page_invitations,public.workspace_page_guest_receipts from public,anon,authenticated;
revoke all on public.workspace_page_invitations,public.workspace_page_guest_receipts from service_role;

-- Service-only entry. Actor comes from verified auth.getUser(), never request JSON.
-- Lock order matches the publication writer. Every read/write/replay rechecks access.
create function public.workspace_page_guest_command(p_actor_id uuid,p_page_id uuid,p_command jsonb,p_hash text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  page public.organization_workspace_pages%rowtype;
  invitation public.workspace_page_invitations%rowtype;
  actor_grant public.workspace_page_invitations%rowtype;
  scoped_org_id uuid;
  member_role text;
  permission text;
  is_org_editor boolean := false;
  action text := p_command->>'action';
  operation uuid;
  prior_hash text;
  account_email text;
  confirmed_at timestamptz;
  listing jsonb := '[]';
  replayed boolean := false;
  changed_fields text[] := '{}';
begin
  if p_actor_id is null or p_page_id is null or jsonb_typeof(p_command) is distinct from 'object'
    or action is null or action not in ('read','accept','invite','revoke','edit') then
    raise exception 'Invalid page access command' using errcode='22023';
  end if;
  select p.org_id into scoped_org_id from public.organization_workspace_pages p where p.id=p_page_id;
  if not found then raise exception 'Page unavailable' using errcode='42501'; end if;
  perform 1 from public.organizations where user_id=scoped_org_id for update;
  if p_actor_id=scoped_org_id then is_org_editor:=true;
  else
    select role into member_role from public.organization_memberships m
      where m.org_id=scoped_org_id and member_id=p_actor_id for update;
    is_org_editor:=coalesce(member_role in ('owner','admin','staff'),false);
  end if;
  select * into page from public.organization_workspace_pages where id=p_page_id for update;
  if page.guest_snapshot is null then
    raise exception 'Review and save a guest preview first' using errcode='42501';
  end if;
  if action='accept' then
    select * into invitation from public.workspace_page_invitations
      where id=(p_command->>'invitationId')::uuid and page_id=p_page_id for update;
    if not found or invitation.revoked_at is not null
      or (invitation.accepted_by is null and invitation.expires_at<=clock_timestamp())
      or (invitation.accepted_by is not null and invitation.accepted_by<>p_actor_id)
      or (invitation.parent_id is not null and not exists (
        select 1 from public.workspace_page_invitations parent where parent.id=invitation.parent_id
          and parent.page_id=p_page_id and parent.permission='manage' and parent.revoked_at is null
          and parent.accepted_by=invitation.invited_by and parent.parent_id is null
      )) then raise exception 'Invitation unavailable' using errcode='42501'; end if;
    if invitation.accepted_by is null then
      select lower(btrim(email)),email_confirmed_at into account_email,confirmed_at from auth.users where id=p_actor_id;
      if account_email is distinct from invitation.email or confirmed_at is null then
        raise exception 'Use the verified account invited to this page' using errcode='42501';
      end if;
      update public.workspace_page_invitations set accepted_by=p_actor_id,accepted_at=clock_timestamp() where id=invitation.id;
    end if;
  end if;
  if is_org_editor then permission:='manage';
  else
    select g.* into actor_grant from public.workspace_page_invitations g
      where g.page_id=p_page_id and g.accepted_by=p_actor_id and g.revoked_at is null
      and (g.parent_id is null or exists (
        select 1 from public.workspace_page_invitations parent where parent.id=g.parent_id and parent.page_id=p_page_id
          and parent.permission='manage' and parent.accepted_by=g.invited_by and parent.revoked_at is null and parent.parent_id is null
      ))
      order by case g.permission when 'manage' then 3 when 'edit' then 2 else 1 end desc,g.created_at,g.id limit 1 for update;
    if not found then raise exception 'Page unavailable' using errcode='42501'; end if;
    permission:=actor_grant.permission;
  end if;
  if action in ('invite','revoke') and permission<>'manage' then
    raise exception 'Page management required' using errcode='42501';
  end if;
  if action='edit' and permission not in ('edit','manage') then
    raise exception 'Page editing required' using errcode='42501';
  end if;
  if action in ('invite','revoke','edit') then
    operation:=(p_command->>'operationId')::uuid;
    if operation is null or p_hash is null or p_hash !~ '^[a-f0-9]{64}$' then
      raise exception 'Invalid operation' using errcode='22023';
    end if;
    select command_hash into prior_hash from public.workspace_page_guest_receipts
      where page_id=p_page_id and actor_id=p_actor_id and operation_id=operation;
    if found then
      if prior_hash<>p_hash then raise exception 'Operation reused' using errcode='22023'; end if;
      replayed:=true;
    end if;
  end if;
  if not replayed and action='invite' then
    if p_command->>'permission' not in ('view','edit','manage') or p_command->>'permission' is null
      or (not is_org_editor and p_command->>'permission'='manage')
      or length(p_command->>'email') not between 3 and 254 or p_command->>'email' is null then
      raise exception 'Invalid invitation authority' using errcode='42501';
    end if;
    if (select count(*) from public.workspace_page_invitations where page_id=p_page_id and revoked_at is null
      and (accepted_by is not null or expires_at>clock_timestamp()))>=100 then
      raise exception 'Page invitation limit reached' using errcode='22023';
    end if;
    insert into public.workspace_page_invitations(id,page_id,email,permission,invited_by,parent_id)
      values((p_command->>'invitationId')::uuid,p_page_id,lower(btrim(p_command->>'email')),p_command->>'permission',p_actor_id,
        case when is_org_editor then null else actor_grant.id end);
  elsif not replayed and action='revoke' then
    select * into invitation from public.workspace_page_invitations
      where id=(p_command->>'invitationId')::uuid and page_id=p_page_id for update;
    -- A delegated manager can remove only grants it issued, never its own parent or a peer.
    if not found or (not is_org_editor and invitation.parent_id is distinct from actor_grant.id) then
      raise exception 'Invitation unavailable' using errcode='42501';
    end if;
    update public.workspace_page_invitations set revoked_at=coalesce(revoked_at,clock_timestamp()) where id=invitation.id or parent_id=invitation.id;
  elsif not replayed and action='edit' then
    if jsonb_typeof(p_command->'title') is distinct from 'string' or length(p_command->>'title')>240
      or jsonb_typeof(p_command->'description') is distinct from 'string' or length(p_command->>'description')>2000 then
      raise exception 'Invalid page details' using errcode='22023';
    end if;
    if (p_command->>'expectedRevision')::integer is distinct from page.revision or page.revision>=2147483647 then
      raise exception 'Page changed; reload before saving' using errcode='40001';
    end if;
    changed_fields:=array_remove(array[
      case when page.title is distinct from btrim(p_command->>'title') then 'title' end,
      case when page.description is distinct from p_command->>'description' then 'description' end],null);
    update public.organization_workspace_pages set title=btrim(p_command->>'title'),description=p_command->>'description',
      revision=revision+1,updated_at=clock_timestamp(),last_operation_id=null,last_operation_actor=null,last_operation_hash=null
      where id=p_page_id returning * into page;
    -- No source records, membership, snapshot, publication or audience changes.
  end if;
  if not replayed and action in ('invite','revoke','edit') then
    insert into public.workspace_page_guest_receipts(page_id,actor_id,operation_id,command_hash,action,result_revision,changed_fields)
      values(p_page_id,p_actor_id,operation,p_hash,action,page.revision,changed_fields);
  end if;
  if permission='manage' then
    select coalesce(jsonb_agg(jsonb_build_object('id',g.id,'email',g.email,'permission',g.permission,
      'accepted',g.accepted_by is not null,'revoked',g.revoked_at is not null,
      'expiresAt',g.expires_at) order by g.created_at desc,g.id),'[]') into listing
      from public.workspace_page_invitations g where g.page_id=p_page_id and g.revoked_at is null
        and (g.accepted_by is not null or g.expires_at>clock_timestamp())
        and (is_org_editor or g.parent_id=actor_grant.id);
  end if;
  return jsonb_build_object('pageId',page.id,'permission',permission,'canGrantManage',is_org_editor,
    'snapshot',page.guest_snapshot,'revision',page.revision,
    'draft',case when permission in ('edit','manage') then jsonb_build_object('title',page.title,'description',page.description) else null end,
    'invitations',listing,'replayed',replayed);
end;
$$;
revoke all on function public.workspace_page_guest_command(uuid,uuid,jsonb,text) from public,anon,authenticated;
grant execute on function public.workspace_page_guest_command(uuid,uuid,jsonb,text) to service_role;
commit;
