-- Project-only staff entrypoints: no host organization profile, membership or
-- billing data is joined into either result.
create function public.list_fiscal_guest_projects(p_user_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if current_setting('role', true) is distinct from 'service_role'
    and ((select auth.uid()) is null or (select auth.uid()) is distinct from p_user_id) then
    raise exception 'Cannot inspect another reviewer' using errcode = '42501';
  end if;
  return (select coalesce(jsonb_agg(to_jsonb(p) order by p.created_at desc, p.id), '[]'::jsonb)
    from public.organization_projects p
    join public.fiscal_guest_submissions submission on submission.project_id=p.id
    where public.fiscal_guest_project_reviewer_access(p.id,p_user_id) is true);
end $$;

create function public.get_fiscal_guest_project_summary(p_project_id uuid, p_user_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if public.fiscal_guest_project_reviewer_access(p_project_id,p_user_id) is distinct from true then
    return null;
  end if;
  return (select jsonb_build_object(
    'projectId',p.id,'projectName',p.name,
    'accountLinked',s.claimed_user_id is not null and s.claimed_org_id is not null and s.claimed_at is not null and s.email_verified_at is not null,
    'emailVerified',s.email_verified_at is not null
  ) from public.organization_projects p
    join public.fiscal_guest_submissions s on s.project_id=p.id
    where p.id=p_project_id);
end $$;
revoke all on function public.list_fiscal_guest_projects(uuid), public.get_fiscal_guest_project_summary(uuid,uuid) from public,anon;
grant execute on function public.list_fiscal_guest_projects(uuid), public.get_fiscal_guest_project_summary(uuid,uuid) to authenticated,service_role;

-- Notifications must not fall back to the internal host's members or coaches.
-- Service-only: callers cannot enumerate another project's reviewers.
create function public.get_fiscal_guest_notification_recipients(p_project_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists(select 1 from public.fiscal_guest_submissions where project_id=p_project_id) then
    return null;
  end if;
  return (select coalesce(jsonb_agg(r.user_id order by r.user_id),'[]'::jsonb)
    from public.fiscal_project_reviewers r
    join public.platform_staff_members staff on staff.user_id=r.user_id
    where r.project_id=p_project_id);
end $$;
revoke all on function public.get_fiscal_guest_notification_recipients(uuid) from public,anon,authenticated;
grant execute on function public.get_fiscal_guest_notification_recipients(uuid) to service_role;
