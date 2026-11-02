-- Reviewed images remain private Storage objects. Only the page's current
-- snapshot grants access; source files and their private ACLs are unchanged.
begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('workspace-page-assets','workspace-page-assets',false,2097152,array['image/webp']);
create policy workspace_page_assets_private on storage.objects as restrictive
for all to anon,authenticated using(bucket_id <> 'workspace-page-assets')
with check(bucket_id <> 'workspace-page-assets');

create table public.workspace_page_image_grants (
  id uuid primary key,
  page_id uuid not null references public.organization_workspace_pages(id) on delete cascade,
  org_id uuid not null references public.organizations(user_id) on delete cascade,
  revision integer not null check(revision>0),
  source_id uuid not null, -- evidence only; deleting a source does not delete its reviewed copy
  storage_path text not null unique,
  sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'),
  size_bytes integer not null check(size_bytes between 1 and 2097152),
  width integer not null check(width between 1 and 2048),
  height integer not null check(height between 1 and 2048),
  created_at timestamptz not null default now()
);
alter table public.workspace_page_image_grants enable row level security;
revoke all on public.workspace_page_image_grants from public,anon,authenticated,service_role;

-- Preserve the established transaction and lock order. The wrapper adds image
-- checks/grants in that SAME transaction; failures roll back the page as well.
alter function public.commit_workspace_page(uuid,uuid,uuid,uuid,text,integer,text,jsonb,jsonb,jsonb,timestamptz,jsonb,jsonb,uuid)
rename to commit_workspace_page_without_images;
revoke all on function public.commit_workspace_page_without_images(uuid,uuid,uuid,uuid,text,integer,text,jsonb,jsonb,jsonb,timestamptz,jsonb,jsonb,uuid)
from public,anon,authenticated,service_role;
create function public.commit_workspace_page(
  p_actor_id uuid,p_org_id uuid,p_page_id uuid,p_operation_id uuid,p_operation_hash text,
  p_expected_revision integer,p_intent text,p_draft jsonb,p_snapshot jsonb,p_expected_graph jsonb,
  p_expected_org_updated_at timestamptz,p_expected_drive_sources jsonb default '[]',
  p_expected_profile jsonb default null,p_canvas_id uuid default null,p_image_assets jsonb default '[]'
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  result jsonb; asset jsonb; item jsonb; source public.organization_document_files%rowtype;
  object_created timestamptz; object_metadata jsonb; total integer:=0; image_count integer;
begin
  result:=public.commit_workspace_page_without_images(p_actor_id,p_org_id,p_page_id,p_operation_id,p_operation_hash,
    p_expected_revision,p_intent,p_draft,p_snapshot,p_expected_graph,p_expected_org_updated_at,
    p_expected_drive_sources,p_expected_profile,p_canvas_id);
  -- Auth/current scope and exact receipt identity were already checked. A
  -- successful retry needs neither source availability nor a second upload.
  if (result->>'replayed')::boolean then return result; end if;
  if jsonb_typeof(p_image_assets) is distinct from 'array' or jsonb_array_length(p_image_assets)>8 then
    raise exception 'Invalid image grants' using errcode='22023';
  end if;
  if p_intent not in ('publish','share_with_guests') then
    if p_image_assets<>'[]'::jsonb then raise exception 'Unexpected image grants' using errcode='22023'; end if;
    return result;
  end if;
  if exists(select 1 from jsonb_array_elements(p_snapshot->'items') i where i#>>'{content,kind}'='document') then
    raise exception 'Document grants unavailable' using errcode='22023';
  end if;
  select count(distinct i#>>'{content,assetId}') into image_count from jsonb_array_elements(p_snapshot->'items') i
    where i#>>'{content,kind}'='image';
  if image_count<>jsonb_array_length(p_image_assets) or image_count<>(select count(distinct a->>'id') from jsonb_array_elements(p_image_assets) a) then
    raise exception 'Image grant selection mismatch' using errcode='22023';
  end if;
  -- Stable source ordering follows the existing board/Drive locks.
  for asset in select value from jsonb_array_elements(p_image_assets) order by value#>>'{source,id}' loop
    select * into source from public.organization_document_files
      where id=(asset#>>'{source,id}')::uuid and org_id=p_org_id for update;
    if not found or source.document_kind is not null or source.deleted_at is not null
      or asset#>>'{source,org_id}' is distinct from p_org_id::text
      or source.storage_path is distinct from asset#>>'{source,storage_path}'
      or source.storage_path not like p_org_id::text||'/library/%'
      or source.mime_type is distinct from asset#>>'{source,mime_type}'
      or source.size_bytes is distinct from (asset#>>'{source,size_bytes}')::bigint
      or source.updated_at is distinct from (asset#>>'{source,updated_at}')::timestamptz then
      raise exception 'Image source changed; review again' using errcode='40001';
    end if;
    if not exists(select 1 from jsonb_array_elements(p_snapshot->'items') i
      where i#>>'{content,kind}'='image' and i#>>'{content,assetId}'=asset->>'id') then
      raise exception 'Unselected image grant' using errcode='22023';
    end if;
    for item in select value from jsonb_array_elements(p_snapshot->'items')
      where value#>>'{content,kind}'='image' and value#>>'{content,assetId}'=asset->>'id' loop
      if not exists(select 1 from jsonb_array_elements(p_expected_graph->'particles') p
        where p->>'id'=item->>'id' and p->>'type'='activity'
        and (p#>'{data,source}' is null or p#>'{data,source}'='null'::jsonb)
        and p#>>'{data,widget,kind}'='image' and p#>>'{data,widget,fileId}'=source.id::text) then
        raise exception 'Image source selection changed' using errcode='40001';
      end if;
    end loop;
    if asset->>'path' is null or asset->>'path' !~ ('^'||p_org_id::text||'/'||p_page_id::text||'/[a-f0-9-]{36}\.webp$') then
      raise exception 'Invalid image path' using errcode='22023';
    end if;
    select created_at,metadata into object_created,object_metadata from storage.objects
      where bucket_id='workspace-page-assets' and name=asset->>'path' for share;
    if not found or object_created<clock_timestamp()-interval '1 hour'
      or object_metadata->>'mimetype' is distinct from 'image/webp'
      or (object_metadata->>'size')::integer is distinct from (asset->>'size')::integer then
      raise exception 'Prepared image unavailable' using errcode='40001';
    end if;
    total:=total+(asset->>'size')::integer;
    insert into public.workspace_page_image_grants(id,page_id,org_id,revision,source_id,storage_path,sha256,size_bytes,width,height)
    values((asset->>'id')::uuid,p_page_id,p_org_id,(result#>>'{page,revision}')::integer,source.id,
      asset->>'path',asset->>'sha256',(asset->>'size')::integer,(asset->>'width')::integer,(asset->>'height')::integer);
  end loop;
  if total>8388608 then raise exception 'Image total exceeds limit' using errcode='22023'; end if;
  return result;
end;
$$;
revoke all on function public.commit_workspace_page(uuid,uuid,uuid,uuid,text,integer,text,jsonb,jsonb,jsonb,timestamptz,jsonb,jsonb,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.commit_workspace_page(uuid,uuid,uuid,uuid,text,integer,text,jsonb,jsonb,jsonb,timestamptz,jsonb,jsonb,uuid,jsonb) to service_role;

-- Service calls supply a verified actor for guest/editor reads. There is no
-- bearer access to guest grants and no signed Storage URL in the response.
create function public.read_workspace_page_image(p_asset_id uuid,p_audience text,p_actor_id uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare asset public.workspace_page_image_grants%rowtype; page public.organization_workspace_pages%rowtype;
  snapshot jsonb; access_result jsonb; role_name text;
begin
  select * into asset from public.workspace_page_image_grants where id=p_asset_id;
  if not found then return null; end if;
  select * into page from public.organization_workspace_pages where id=asset.page_id and org_id=asset.org_id;
  if not found then return null; end if;
  if p_audience='public' then
    if page.visibility<>'public' then return null; end if;
    -- Reuse slug/handle/reservation checks, not just the visibility flag.
    access_result:=public.read_workspace_page_public(page.published_snapshot#>>'{brand,organizationSlug}',page.link_id);
    snapshot:=access_result->'snapshot';
  elsif p_audience='guest' and p_actor_id is not null then
    begin
      access_result:=public.workspace_page_guest_command(p_actor_id,page.id,'{"action":"read"}',null);
      snapshot:=access_result->'snapshot';
    exception when insufficient_privilege then return null; end;
  elsif p_audience='editor' and p_actor_id is not null then
    if p_actor_id<>page.org_id then
      select role into role_name from public.organization_memberships where org_id=page.org_id and member_id=p_actor_id;
      if role_name is null or role_name not in ('owner','admin','staff') then return null; end if;
    end if;
    snapshot:=page.published_snapshot;
  else return null;
  end if;
  if snapshot is null or not exists(select 1 from jsonb_array_elements(snapshot->'items') i
    where i#>>'{content,kind}'='image' and i#>>'{content,assetId}'=asset.id::text) then return null; end if;
  return jsonb_build_object('path',asset.storage_path,'sha256',asset.sha256,'size',asset.size_bytes);
end;
$$;
revoke all on function public.read_workspace_page_image(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.read_workspace_page_image(uuid,text,uuid) to service_role;

-- Failed/uncertain uploads use never-reused random paths. After 24h they cannot
-- enter a new publication (1h admission above). Skip active commit locks. Return
-- at most 100 candidates; delete through Storage API, NEVER storage.objects SQL.
create function public.workspace_page_image_orphans() returns jsonb language sql security definer set search_path='' as $$
 select coalesce(jsonb_agg(name),'[]') from (
   select o.name from storage.objects o where o.bucket_id='workspace-page-assets'
     and o.created_at<clock_timestamp()-interval '24 hours'
     and not exists(select 1 from public.workspace_page_image_grants g where g.storage_path=o.name)
   order by o.created_at,o.id limit 100 for update of o skip locked
 ) candidates;
$$;
revoke all on function public.workspace_page_image_orphans() from public,anon,authenticated;
grant execute on function public.workspace_page_image_orphans() to service_role;
commit;
