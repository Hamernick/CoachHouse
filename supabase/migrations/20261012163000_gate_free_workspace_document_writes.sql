-- Free workspaces retain reads and Google Drive links; hosted documents and team
-- collaboration require the selected organization's active paid subscription.
create or replace function public.has_workspace_paid_features(p_org_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select s.status in ('active', 'trialing') and (
      lower(trim(coalesce(s.metadata->>'plan_tier', ''))) in ('organization', 'operations_support')
      or (lower(trim(coalesce(s.metadata->>'planName', ''))) not like '%free%'
          and length(trim(coalesce(s.metadata->>'planName', ''))) > 0)
    )
    from public.subscriptions s
    where s.user_id = p_org_id and s.stripe_subscription_id not ilike 'stub_%'
    order by s.created_at desc limit 1
  ), false);
$$;
revoke all on function public.has_workspace_paid_features(uuid) from public;
grant execute on function public.has_workspace_paid_features(uuid) to authenticated, service_role;

create policy document_storage_paid_insert on storage.objects as restrictive
for insert to authenticated with check (
  case when bucket_id = 'org-documents' then public.has_workspace_paid_features(split_part(name, '/', 1)::uuid) else true end
);
create policy document_storage_paid_update on storage.objects as restrictive
for update to authenticated using (
  case when bucket_id = 'org-documents' then public.has_workspace_paid_features(split_part(name, '/', 1)::uuid) else true end
) with check (
  case when bucket_id = 'org-documents' then public.has_workspace_paid_features(split_part(name, '/', 1)::uuid) else true end
);
create policy document_storage_paid_delete on storage.objects as restrictive
for delete to authenticated using (
  case when bucket_id = 'org-documents' then public.has_workspace_paid_features(split_part(name, '/', 1)::uuid) else true end
);
create policy document_library_paid_insert on public.organization_document_files as restrictive
for insert to authenticated with check (public.has_workspace_paid_features(org_id));
create policy document_library_paid_update on public.organization_document_files as restrictive
for update to authenticated using (public.has_workspace_paid_features(org_id))
with check (public.has_workspace_paid_features(org_id));
create policy document_library_paid_delete on public.organization_document_files as restrictive
for delete to authenticated using (public.has_workspace_paid_features(org_id));

create policy workspace_collaboration_paid_insert on public.organization_workspace_invites as restrictive
for insert to authenticated with check (public.has_workspace_paid_features(org_id));
-- An owner may still revoke access after downgrading.
create policy workspace_collaboration_paid_update on public.organization_workspace_invites as restrictive
for update to authenticated with check (revoked_at is not null or public.has_workspace_paid_features(org_id));

-- Protect native document bodies even when written through organizations.profile.
-- Narrative sections are organization-profile fields and remain editable on Free.
-- Source links and timestamps are metadata, not hosted document content.
create or replace function public.native_workspace_document_content(p_profile jsonb)
returns jsonb language sql immutable set search_path = public as $$
  select jsonb_build_object(
    'documents', jsonb_strip_nulls(coalesce(nullif(p_profile->'documents', 'null'::jsonb), '{}'::jsonb)),
    'policies', coalesce(nullif(p_profile->'policies', 'null'::jsonb), '[]'::jsonb),
    'roadmap', coalesce((
      select jsonb_object_agg(section->>'id', jsonb_build_object(
        'content', coalesce(section->>'content', ''),
        'budgetRows', coalesce(section->'budgetRows', '[]'::jsonb),
        'imageUrl', coalesce(section->>'imageUrl', '')
      ))
      from jsonb_array_elements(case when jsonb_typeof(p_profile#>'{roadmap,sections}') = 'array'
        then p_profile#>'{roadmap,sections}' else '[]'::jsonb end) section
      where section->>'id' is not null
        and section->>'id' not in ('origin_story','need','mission_vision_values','vision','values','theory_of_change')
        and (coalesce(section->>'content', '') <> ''
          or coalesce(section->'budgetRows', '[]'::jsonb) <> '[]'::jsonb
          or coalesce(section->>'imageUrl', '') <> '')
    ), '{}'::jsonb)
  );
$$;
create or replace function public.guard_free_workspace_documents()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.role() = 'service_role' or public.has_workspace_paid_features(new.user_id) then
    return new;
  end if;
  if public.native_workspace_document_content(new.profile) is distinct from
     public.native_workspace_document_content(case when tg_op = 'INSERT' then '{}'::jsonb else old.profile end) then
    raise exception 'Upgrade to create or edit Coach House documents. Google Drive links remain available on Free.' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_free_workspace_documents() from public;
create trigger guard_free_workspace_documents before insert or update of profile on public.organizations
for each row execute function public.guard_free_workspace_documents();
