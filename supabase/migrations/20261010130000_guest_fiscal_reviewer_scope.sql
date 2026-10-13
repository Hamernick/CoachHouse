-- Guest intake is internal staff work, not a benefit of membership in its host org.
-- NULL means an ordinary project; its existing organization policies still apply.
create function public.fiscal_guest_project_reviewer_access(p_project_id uuid, p_user_id uuid)
returns boolean language plpgsql stable security definer set search_path = '' as $$
begin
  if current_setting('role', true) is distinct from 'service_role'
    and ((select auth.uid()) is null or (select auth.uid()) is distinct from p_user_id) then
    raise exception 'Cannot inspect another reviewer' using errcode = '42501';
  end if;
  return (select case when exists (
    select 1 from public.fiscal_guest_submissions where project_id = p_project_id
  ) then exists (
    select 1 from public.platform_staff_members staff
    where staff.user_id = p_user_id and (
      staff.access_level = 'developer' or exists (
        select 1 from public.fiscal_project_reviewers reviewer
        where reviewer.project_id = p_project_id and reviewer.user_id = staff.user_id
      )
    )
  ) else null end);
end;
$$;
revoke all on function public.fiscal_guest_project_reviewer_access(uuid,uuid) from public, anon, authenticated;
grant execute on function public.fiscal_guest_project_reviewer_access(uuid,uuid) to authenticated, service_role;

-- Authenticated policies always bind identity to the session, never a caller ID.
create function public.can_access_fiscal_guest_project(p_project_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(public.fiscal_guest_project_reviewer_access(p_project_id, (select auth.uid())), true);
$$;
create function public.is_fiscal_guest_project_reviewer(p_project_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(public.fiscal_guest_project_reviewer_access(p_project_id, (select auth.uid())), false);
$$;
revoke all on function public.can_access_fiscal_guest_project(uuid), public.is_fiscal_guest_project_reviewer(uuid) from public, anon;
grant execute on function public.can_access_fiscal_guest_project(uuid), public.is_fiscal_guest_project_reviewer(uuid) to authenticated, service_role;

-- Restrictive policies intersect every existing permissive policy, including
-- organization membership/coach rules. Assigned reviewers receive read access
-- only; mutations remain behind the existing authorized server transitions.
do $$ declare relation text; column_name text; begin
  foreach relation in array array[
    'organization_projects', 'fiscal_sponsorship_applications',
    'fiscal_sponsorship_reviews', 'fiscal_sponsorship_documents',
    'fiscal_sponsorship_signature_packets', 'fiscal_sponsorship_events'
  ] loop
    column_name := case when relation = 'organization_projects' then 'id' else 'project_id' end;
    execute format('create policy fiscal_guest_staff_scope on public.%I as restrictive for all to authenticated using (public.can_access_fiscal_guest_project(%I)) with check (public.can_access_fiscal_guest_project(%I))', relation, column_name, column_name);
    execute format('create policy fiscal_guest_reviewer_select on public.%I for select to authenticated using (public.is_fiscal_guest_project_reviewer(%I))', relation, column_name);
  end loop;
end $$;
