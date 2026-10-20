-- Complete only the minimal asset fixture; production already has these columns.
alter table public.organization_project_assets
  add column if not exists org_id uuid references public.organizations(user_id),
  add column if not exists name text,
  add column if not exists description text,
  add column if not exists asset_type text,
  add column if not exists mime text,
  add column if not exists size_bytes bigint,
  add column if not exists created_by uuid references public.profiles(id),
  add column if not exists updated_by uuid references public.profiles(id);
