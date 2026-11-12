-- Public flags authorize published server projections, never the full profile
-- JSON (which also contains private roadmap, people and document metadata).
begin;
create policy organization_profile_no_anonymous_raw_read on public.organizations
 as restrictive for select to anon using (false);
create policy organization_profile_private_raw_read on public.organizations
 as restrictive for select to authenticated using (
 (select auth.uid()) is not null and (
  user_id=(select auth.uid())
  or public.is_admin()
  or exists(select 1 from public.organization_memberships m
    where m.org_id=organizations.user_id and m.member_id=(select auth.uid()))
  or public.workspace_supports_org(user_id)
 )
);
comment on policy organization_profile_private_raw_read on public.organizations is
 'Public profile/roadmap flags cannot grant raw profile JSON. Preserves existing owner, member, developer and explicit support authority, AND existing closure/permissive RLS. Server public projections remain available. Not per-document member permissions or historical-copy qualification.';
commit;
