-- Private page selections and immutable-until-Update public snapshots.
-- No board copy, per-person ACL, storage object or Google permission is created.
create or replace function public.workspace_page_membership_valid(ids uuid[])
returns boolean language sql immutable set search_path = '' as $$
  select coalesce(
    array_ndims(ids) = 1 and cardinality(ids) between 1 and 50
    and array_position(ids, null) is null
    and cardinality(ids) = (select count(distinct id) from unnest(ids) as members(id)),
    false
  );
$$;
revoke all on function public.workspace_page_membership_valid(uuid[]) from public, anon, authenticated;
grant execute on function public.workspace_page_membership_valid(uuid[]) to service_role;

create table public.organization_workspace_pages (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(user_id) on delete cascade,
  link_id uuid not null default gen_random_uuid(),
  title text not null default '' check (char_length(title) <= 240),
  description text not null default '' check (char_length(description) <= 2000),
  particle_ids uuid[] not null check (public.workspace_page_membership_valid(particle_ids)),
  revision integer not null default 1 check (revision > 0),
  visibility text not null default 'private' check (visibility in ('private', 'public')),
  published_snapshot jsonb,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_workspace_pages_link_unique unique (org_id, link_id),
  constraint organization_workspace_pages_snapshot_object check (
    published_snapshot is null or jsonb_typeof(published_snapshot) = 'object'
  ),
  constraint organization_workspace_pages_publication_pair check (
    (published_snapshot is null) = (published_at is null)
  ),
  constraint organization_workspace_pages_public_content check (
    visibility = 'private' or published_snapshot is not null
  )
);

-- Covers scoped listing and keyset ordering without scanning other orgs.
create index organization_workspace_pages_org_updated_idx
  on public.organization_workspace_pages(org_id, updated_at desc, id);

alter table public.organization_workspace_pages enable row level security;
alter table public.organization_workspace_pages force row level security;
revoke all on public.organization_workspace_pages from public, anon, authenticated;
grant select on public.organization_workspace_pages to authenticated;
grant select, insert, update, delete on public.organization_workspace_pages to service_role;

-- Match publication roles; platform/support access alone never grants access.
create policy organization_workspace_pages_editor_read
  on public.organization_workspace_pages for select to authenticated
  using (
    org_id = (select auth.uid()) or exists (
      select 1 from public.organization_memberships om
      where om.org_id = organization_workspace_pages.org_id
        and om.member_id = (select auth.uid())
        and om.role in ('owner', 'admin', 'staff')
    )
  );

-- Deliberately no anonymous SELECT or client write policy. The next slice adds
-- an authorized, revision-checked writer and a narrow public-content reader;
-- direct REST requests must never expose draft membership or source IDs.
