-- Personal inboxes belong only to their recipient, including platform developers.
-- Trusted SECURITY DEFINER producers and service-role maintenance keep their access.
-- Rollback: restore the three policies from 20260115210000_add_notifications.sql
-- and the prior notify_organization_task_assignment body, retaining the
-- import-suppression guard added by 20260928170000_tracker_task_support.sql.
begin;
drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists notifications_update on public.notifications;
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists notifications_delete on public.notifications;
create policy notifications_delete on public.notifications for delete to authenticated
  using (user_id = (select auth.uid()));

create or replace function public.notify_organization_task_assignment()
returns trigger language plpgsql security definer
set search_path = '' set row_security = off as $$
declare
  v_task public.organization_tasks%rowtype;
  v_project public.organization_projects%rowtype;
  v_actor_name text;
  v_assignee_name text;
  v_href text;
begin
  if public.is_task_tracker_import_active() then return new; end if;
  if tg_op = 'UPDATE' and new.user_id = old.user_id and new.task_id = old.task_id then
    return new;
  end if;
  select * into v_task from public.organization_tasks where id = new.task_id and org_id = new.org_id;
  if not found or v_task.created_source <> 'user' then return new; end if;
  select * into v_project from public.organization_projects where id = v_task.project_id;
  if not found or v_project.created_source in ('system', 'starter_seed') and v_project.project_kind <> 'organization_admin' then return new; end if;
  select coalesce(nullif(btrim(full_name), ''), email, 'A teammate') into v_actor_name
    from public.profiles where id = new.created_by;
  select coalesce(nullif(btrim(full_name), ''), email, 'a teammate') into v_assignee_name
    from public.profiles where id = new.user_id;
  v_href := case when v_project.project_kind = 'organization_admin' then '/organizations/' else '/projects/' end || v_project.id::text;

  insert into public.notifications(user_id, title, description, href, tone, type, org_id, actor_id, metadata)
  values(new.user_id, 'Task assigned to you',
    coalesce(v_actor_name, 'A teammate') || ' assigned you “' || v_task.title || '” in ' || v_project.name || '.',
    '/tasks', 'info', 'task_assigned', new.org_id, new.created_by,
    jsonb_build_object('taskId', new.task_id, 'projectId', v_task.project_id, 'assigneeId', new.user_id));

  if new.created_by is not null and new.created_by <> new.user_id
    and exists(select 1 from public.platform_staff_members where user_id = new.created_by) then
    insert into public.notifications(user_id, title, description, href, tone, type, org_id, actor_id, metadata)
    values(new.created_by, 'You assigned a task to ' || coalesce(v_assignee_name, 'a teammate'),
      '“' || v_task.title || '” was assigned to ' || coalesce(v_assignee_name, 'a teammate') || ' in ' || v_project.name || '.',
      v_href, 'success', 'task_assignment_confirmed', new.org_id, new.created_by,
      jsonb_build_object('taskId', new.task_id, 'projectId', v_task.project_id, 'assigneeId', new.user_id));
  end if;
  return new;
end;
$$;
revoke all on function public.notify_organization_task_assignment() from public, anon, authenticated;

commit;
