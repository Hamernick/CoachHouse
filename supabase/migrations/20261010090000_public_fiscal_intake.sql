-- A single resumable public intake per owner. No Workspace entitlement is granted.
create or replace function public.start_public_fiscal_intake(p_organization_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_project uuid;
  v_name text := btrim(p_organization_name);
begin
  if v_owner is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if v_name is null or length(v_name) < 1 or length(v_name) > 160 then
    raise exception 'Organization name must contain 1 to 160 characters' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles where id = v_owner) then
    raise exception 'Account setup is incomplete' using errcode = '42501';
  end if;

  -- Never overwrite an existing profile or publish one as a side effect of applying.
  insert into public.organizations (user_id, profile, is_public)
  values (v_owner, jsonb_build_object('name', v_name), false)
  on conflict (user_id) do nothing;

  -- Serializes simultaneous starts, including tabs and retried requests.
  perform 1 from public.organizations where user_id = v_owner for update;
  -- Signup may already have created an empty private organization row.
  update public.organizations
  set profile = jsonb_set(profile, '{name}', to_jsonb(v_name))
  where user_id = v_owner and nullif(btrim(profile->>'name'), '') is null;
  select id into v_project from public.organization_projects
  where org_id = v_owner and starter_seed_key = 'public_fiscal_intake_v1';
  if v_project is not null then return v_project; end if;

  insert into public.organization_projects (
    org_id, project_kind, name, created_source, starter_seed_key,
    created_by, updated_by, option_settings
  ) values (
    v_owner, 'standard', 'Fiscal sponsorship application', 'system',
    'public_fiscal_intake_v1', v_owner, v_owner,
    '{"fiscalSponsorshipEnabled":true}'::jsonb
  ) returning id into v_project;
  return v_project;
end;
$$;

-- No caller-supplied owner/project/role; auth.uid() is the only authority.
revoke all on function public.start_public_fiscal_intake(text) from public, anon;
grant execute on function public.start_public_fiscal_intake(text) to authenticated;

-- Free applicants may read only their intake project. General project mutation
-- continues to require the existing paid Workspace policies.
create policy public_fiscal_intake_project_read on public.organization_projects
for select to authenticated using (
  org_id = (select auth.uid()) and starter_seed_key = 'public_fiscal_intake_v1'
);

create or replace function public.owns_public_fiscal_intake(p_org text, p_project text, p_write boolean default false)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_org = (select auth.uid())::text and exists (
    select 1 from public.organization_projects p
    where p.org_id::text = p_org and p.id::text = p_project
      and p.starter_seed_key = 'public_fiscal_intake_v1'
      and (not p_write or exists (
        select 1 from public.fiscal_sponsorship_applications a
        where a.project_id = p.id and a.org_id = p.org_id
          and a.status in ('draft', 'needs_info')
      ))
  );
$$;
revoke all on function public.owns_public_fiscal_intake(text, text, boolean) from public, anon;
grant execute on function public.owns_public_fiscal_intake(text, text, boolean) to authenticated;

create policy public_fiscal_asset_read on public.organization_project_assets
for select to authenticated using (public.owns_public_fiscal_intake(org_id::text, project_id::text));
create policy public_fiscal_asset_insert on public.organization_project_assets
for insert to authenticated with check (public.owns_public_fiscal_intake(org_id::text, project_id::text, true));
create policy public_fiscal_asset_update on public.organization_project_assets
for update to authenticated using (public.owns_public_fiscal_intake(org_id::text, project_id::text, true))
with check (public.owns_public_fiscal_intake(org_id::text, project_id::text, true));
create policy public_fiscal_asset_delete on public.organization_project_assets
for delete to authenticated using (public.owns_public_fiscal_intake(org_id::text, project_id::text, true));

create policy public_fiscal_storage_read on storage.objects for select to authenticated
using (bucket_id = 'project-assets' and public.owns_public_fiscal_intake(split_part(name, '/', 1), split_part(name, '/', 2)));
create policy public_fiscal_storage_insert on storage.objects for insert to authenticated
with check (bucket_id = 'project-assets' and public.owns_public_fiscal_intake(split_part(name, '/', 1), split_part(name, '/', 2), true));
create policy public_fiscal_storage_update on storage.objects for update to authenticated
using (bucket_id = 'project-assets' and public.owns_public_fiscal_intake(split_part(name, '/', 1), split_part(name, '/', 2), true))
with check (bucket_id = 'project-assets' and public.owns_public_fiscal_intake(split_part(name, '/', 1), split_part(name, '/', 2), true));
create policy public_fiscal_storage_delete on storage.objects for delete to authenticated
using (bucket_id = 'project-assets' and public.owns_public_fiscal_intake(split_part(name, '/', 1), split_part(name, '/', 2), true));
