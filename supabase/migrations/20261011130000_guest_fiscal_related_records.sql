-- A guest project belongs to staff review, not to the ordinary host workspace.
-- Intersect existing policies so direct PostgREST/storage calls cannot bypass
-- the narrower server UI. No new grants or ordinary-project access are added.
do $$ declare relation text; begin
  foreach relation in array array[
    'organization_tasks','organization_project_notes','organization_project_quick_links',
    'organization_project_assets','organization_project_overview_documents',
    'organization_project_activity_events','platform_admin_project_workstream_states',
    'fiscal_sponsorship_signing_drafts','fiscal_sponsorship_signatures'
  ] loop
    if to_regclass('public.'||relation) is null then raise exception 'Missing prerequisite table: %',relation; end if;
    execute format('create policy fiscal_guest_related_scope on public.%I as restrictive for all to authenticated using (public.can_access_fiscal_guest_project(project_id)) with check (public.can_access_fiscal_guest_project(project_id))',relation);
  end loop;
end $$;

-- Assigned reviewers read through RLS; guest mutations use authorized server
-- transitions, never a permissive host-org/editor policy from the browser.
do $$ declare relation text; column_name text; predicate text; begin
  foreach relation in array array[
    'organization_projects','fiscal_sponsorship_applications','fiscal_sponsorship_reviews',
    'fiscal_sponsorship_documents','fiscal_sponsorship_signature_packets','fiscal_sponsorship_events',
    'organization_tasks','organization_project_notes','organization_project_quick_links',
    'organization_project_assets','organization_project_overview_documents',
    'organization_project_activity_events','platform_admin_project_workstream_states',
    'fiscal_sponsorship_signing_drafts','fiscal_sponsorship_signatures'
  ] loop
    column_name:=case when relation='organization_projects' then 'id' else 'project_id' end;
    predicate:=format('public.fiscal_guest_project_reviewer_access(%I,(select auth.uid())) is null',column_name);
    execute format('create policy fiscal_guest_server_insert on public.%I as restrictive for insert to authenticated with check (%s)',relation,predicate);
    execute format('create policy fiscal_guest_server_update on public.%I as restrictive for update to authenticated using (%s) with check (%s)',relation,predicate,predicate);
    execute format('create policy fiscal_guest_server_delete on public.%I as restrictive for delete to authenticated using (%s)',relation,predicate);
  end loop;
end $$;

create function public.can_access_fiscal_guest_storage(p_bucket text,p_name text)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare project_text text;
begin
  if p_bucket not in ('project-assets','fiscal-signing') then return true; end if;
  -- Include historical/generated paths by exact document/asset association.
  if exists(select 1 from public.fiscal_sponsorship_documents d
    join public.fiscal_guest_submissions s on s.project_id=d.project_id
    where d.storage_bucket=p_bucket and d.storage_path=p_name
      and not public.can_access_fiscal_guest_project(d.project_id)) then return false; end if;
  if p_bucket='project-assets' and exists(select 1 from public.organization_project_assets a
    join public.fiscal_guest_submissions s on s.project_id=a.project_id
    where a.storage_path=p_name and not public.can_access_fiscal_guest_project(a.project_id)) then return false; end if;
  -- New project files use org/project/file. Guard inserts before an asset row exists.
  project_text:=split_part(p_name,'/',2);
  if project_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return public.can_access_fiscal_guest_project(project_text::uuid);
  end if;
  return true;
end $$;
revoke all on function public.can_access_fiscal_guest_storage(text,text) from public,anon;
grant execute on function public.can_access_fiscal_guest_storage(text,text) to authenticated,service_role;
create policy fiscal_guest_storage_scope on storage.objects as restrictive for all to authenticated
  using(public.can_access_fiscal_guest_storage(bucket_id,name))
  with check(public.can_access_fiscal_guest_storage(bucket_id,name));
