-- Internal brand drafts are separate from the publicly readable organization profile.
begin;

create table public.organization_brand_kits (
  org_id uuid primary key references public.organizations(user_id) on delete cascade,
  identity jsonb not null check (jsonb_typeof(identity) = 'object' and octet_length(identity::text) <= 100000),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
alter table public.organization_brand_kits enable row level security;
alter table public.organization_brand_kits force row level security;
revoke all on public.organization_brand_kits from public, anon, authenticated;
grant select, insert, update on public.organization_brand_kits to authenticated;
grant all on public.organization_brand_kits to service_role;

create policy organization_brand_kits_read on public.organization_brand_kits
for select to authenticated using (
  org_id = (select auth.uid()) or public.is_admin() or exists (
    select 1 from public.organization_memberships m
    where m.org_id = organization_brand_kits.org_id and m.member_id = (select auth.uid())
  )
);
create policy organization_brand_kits_insert on public.organization_brand_kits
for insert to authenticated with check (
  org_id = (select auth.uid()) or public.is_admin() or exists (
    select 1 from public.organization_memberships m where m.org_id = organization_brand_kits.org_id
    and m.member_id = (select auth.uid()) and m.role in ('owner', 'admin', 'staff')
  )
);
create policy organization_brand_kits_update on public.organization_brand_kits
for update to authenticated using (
  org_id = (select auth.uid()) or public.is_admin() or exists (
    select 1 from public.organization_memberships m where m.org_id = organization_brand_kits.org_id
    and m.member_id = (select auth.uid()) and m.role in ('owner', 'admin', 'staff')
  )
) with check (
  org_id = (select auth.uid()) or public.is_admin() or exists (
    select 1 from public.organization_memberships m where m.org_id = organization_brand_kits.org_id
    and m.member_id = (select auth.uid()) and m.role in ('owner', 'admin', 'staff')
  )
);

create function public.save_organization_profile_with_brand_kit(
  p_org_id uuid, p_expected_updated_at timestamptz, p_expected_brand_revision uuid,
  p_identity jsonb, p_profile_patch jsonb
) returns boolean language plpgsql security definer set search_path = '' as $$
declare
  organization public.organizations%rowtype;
  current_identity jsonb;
  asset jsonb;
  member_role text;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  select * into organization from public.organizations where user_id=p_org_id for update;
  if not found then raise exception 'Organization unavailable' using errcode='42501'; end if;
  if p_org_id <> auth.uid() and not public.is_admin() then
    select role into member_role from public.organization_memberships
      where org_id=p_org_id and member_id=auth.uid() for update;
    if member_role is null or member_role not in ('owner','admin','staff') then
      raise exception 'Organization editor required' using errcode='42501';
    end if;
  end if;
  if organization.updated_at is distinct from p_expected_updated_at then
    raise exception 'This organization was updated elsewhere. Reload before saving.' using errcode='40001';
  end if;
  select identity into current_identity from public.organization_brand_kits where org_id=p_org_id for update;
  if (current_identity->>'revision')::uuid is distinct from p_expected_brand_revision then
    raise exception 'This brand kit was updated elsewhere. Reload before saving.' using errcode='40001';
  end if;
  if p_identity is null or p_identity->>'version' is distinct from '1'
    or p_identity->>'revision' is null or jsonb_typeof(p_identity->'draft') is distinct from 'object'
    or jsonb_typeof(p_identity->'assets') is distinct from 'object'
    or octet_length(p_identity::text)>100000
    or jsonb_typeof(p_profile_patch->'profile') is distinct from 'object' then
    raise exception 'Invalid brand kit' using errcode='22023';
  end if;
  perform (p_identity->>'revision')::uuid;
  for asset in select value from jsonb_each(p_identity->'assets') loop
    if asset = 'null'::jsonb then continue; end if;
    perform 1 from public.organization_document_files f where f.id=(asset->>'fileId')::uuid
      and f.org_id=p_org_id and f.deleted_at is null and f.document_kind is null
      and f.storage_path like p_org_id::text || '/library/%'
      and f.storage_path !~ '(^|/)\.\.(/|$)'
      and f.mime_type in ('image/png','image/jpeg','image/webp','image/svg+xml')
      and f.size_bytes between 1 and 12582912 for share;
    if not found then raise exception 'A brand file is unavailable.' using errcode='42501'; end if;
  end loop;
  -- One transaction: either both records save or neither does.
  update public.organizations set
    profile=(p_profile_patch->'profile') - 'brandIdentity',
    ein=case when p_profile_patch ? 'ein' then p_profile_patch->>'ein' else organization.ein end,
    public_slug=case when p_profile_patch ? 'public_slug' then p_profile_patch->>'public_slug' else organization.public_slug end,
    is_public=case when p_profile_patch ? 'is_public' then (p_profile_patch->>'is_public')::boolean else organization.is_public end,
    location_lat=case when p_profile_patch ? 'location_lat' then (p_profile_patch->>'location_lat')::double precision else organization.location_lat end,
    location_lng=case when p_profile_patch ? 'location_lng' then (p_profile_patch->>'location_lng')::double precision else organization.location_lng end,
    updated_at=clock_timestamp()
    where user_id=p_org_id;
  insert into public.organization_brand_kits(org_id,identity,updated_at,updated_by)
    values(p_org_id,p_identity,clock_timestamp(),auth.uid())
    on conflict(org_id) do update set identity=excluded.identity, updated_at=excluded.updated_at, updated_by=excluded.updated_by;
  return true;
end;
$$;
revoke all on function public.save_organization_profile_with_brand_kit(uuid,timestamptz,uuid,jsonb,jsonb) from public, anon;
grant execute on function public.save_organization_profile_with_brand_kit(uuid,timestamptz,uuid,jsonb,jsonb) to authenticated;

commit;
