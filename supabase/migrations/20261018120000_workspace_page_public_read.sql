-- Public requests use a bounded server reader, never direct table grants.
-- Visibility is tested on every request; no draft columns cross this boundary.
create function public.read_workspace_page_public(p_organization_slug text,p_link_id uuid)
returns jsonb language sql stable security invoker set search_path='' as $$
  select jsonb_build_object('snapshot',page.published_snapshot,'publishedAt',page.published_at)
  from public.organization_workspace_pages page
  join public.organizations organization on organization.user_id=page.org_id
  join public.public_handles handle on handle.handle=organization.public_slug
    and handle.owner_type='organization' and handle.organization_id=organization.user_id
  where organization.public_slug=p_organization_slug and page.link_id=p_link_id
    and page.visibility='public' and page.published_snapshot is not null
    and page.published_snapshot#>>'{brand,organizationSlug}'=organization.public_slug
    and not exists(select 1 from public.public_handle_reservations reserved where reserved.handle=organization.public_slug)
  limit 1;
$$;
revoke all on function public.read_workspace_page_public(text,uuid) from public,anon,authenticated;
grant execute on function public.read_workspace_page_public(text,uuid) to service_role;
