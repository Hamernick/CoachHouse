\set ON_ERROR_STOP on
\ir organization-closure-project-tasks-fixture.sql
-- Scoped prerequisite: actual paid-workspace authorization functions over a
-- minimal subscriptions table. Storage/payment/provider/release gates omitted.
-- subscriptions prerequisite is inherited from the document fixture.
set check_function_bodies = off;
set search_path = public;

create or replace function public.has_paid_team_access(org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.subscriptions s
    where s.user_id = org
      and s.status in ('active', 'trialing')
      and coalesce(s.stripe_subscription_id, '') not ilike 'stub_%'
      and lower(
        concat_ws(
          ' ',
          s.metadata ->> 'planName',
          s.metadata ->> 'plan_tier',
          s.metadata ->> 'tier'
        )
      ) not like '%free%'
  );
$$;

revoke all on function public.has_paid_team_access(uuid) from public;

create or replace function public.can_read_member_workspace_org(org uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    return false;
  end if;

  if public.is_admin() then
    return true;
  end if;

  if not public.has_paid_team_access(org) then
    return false;
  end if;

  return org = current_user_id
    or exists (
      select 1
      from public.organization_memberships om
      where om.org_id = org
        and om.member_id = current_user_id
    );
exception when others then
  return false;
end;
$$;

create or replace function public.can_write_member_workspace_org(org uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    return false;
  end if;

  if public.is_admin() then
    return true;
  end if;

  if not public.has_paid_team_access(org) then
    return false;
  end if;

  return org = current_user_id
    or exists (
      select 1
      from public.organization_memberships om
      where om.org_id = org
        and om.member_id = current_user_id
        and om.role in ('admin', 'staff')
    );
exception when others then
  return false;
end;
$$;

create or replace function public.can_read_member_workspace_org(org text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return public.can_read_member_workspace_org(org::uuid);
exception when others then
  return false;
end;
$$;

create or replace function public.can_write_member_workspace_org(org text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return public.can_write_member_workspace_org(org::uuid);
exception when others then
  return false;
end;
$$;

revoke all on function public.can_read_member_workspace_org(uuid) from public;
revoke all on function public.can_write_member_workspace_org(uuid) from public;
revoke all on function public.can_read_member_workspace_org(text) from public;
revoke all on function public.can_write_member_workspace_org(text) from public;

grant execute on function public.can_read_member_workspace_org(uuid) to authenticated;
grant execute on function public.can_write_member_workspace_org(uuid) to authenticated;
grant execute on function public.can_read_member_workspace_org(text) to authenticated;
grant execute on function public.can_write_member_workspace_org(text) to authenticated;


\ir ../migrations/20261102230000_workspace_data_views.sql
create function public.fixture_data_views() returns void language plpgsql as $$
begin
 perform public.fixture_closure_project_tasks();
 delete from public.organization_memberships where member_id=public.fixture_form_id(18);
 update public.organization_memberships set role='member' where member_id=public.fixture_form_id(14);
 truncate public.organization_data_view_receipts,public.organization_data_views,public.organization_data_rows,public.organization_data_tables;
 delete from public.subscriptions;
 insert into public.subscriptions(user_id,status,stripe_subscription_id,metadata) values(public.fixture_form_id(1),'active','local-paid-one','{}'),(public.fixture_form_id(2),'active','local-paid-two','{}');
end $$;
