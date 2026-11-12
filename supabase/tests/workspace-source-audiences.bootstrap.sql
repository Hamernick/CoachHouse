-- Controlled parent/canvas prerequisites in the existing folder SQL harness.
-- Folder/file/room/save authority uses the actual migrations already installed.
-- This is not a full-schema or canvas-privacy qualification.
create table public.organization_workspace_boards(org_id uuid primary key references public.organizations(user_id),state jsonb not null);
create function public.can_read_workspace_particle_origins(p_org uuid,p_actor uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.organizations where user_id=p_org) and
    (p_org=p_actor or exists(select 1 from public.organization_memberships where org_id=p_org and member_id=p_actor));
$$;
