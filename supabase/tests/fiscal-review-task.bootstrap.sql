-- Complete the existing minimal ancillary fixture with actual task columns.
alter table public.profiles add column if not exists full_name text;
alter table public.organization_tasks
 add column org_id uuid references public.organizations(user_id),
 add column title text, add column description text, add column task_type text,
 add column status text check(status in ('todo','in-progress','done')),
 add column start_date date, add column end_date date,
 add column created_source text, add column created_by uuid references public.profiles(id),
 add column updated_by uuid references public.profiles(id), add column created_at timestamptz default now();
create table public.organization_task_assignees (
 id uuid primary key default gen_random_uuid(), org_id uuid references public.organizations(user_id),
 task_id uuid references public.organization_tasks(id), user_id uuid references public.profiles(id),
 created_by uuid references public.profiles(id), unique(task_id,user_id)
);
alter table public.organization_task_assignees enable row level security;
grant select,insert,update,delete on public.organization_task_assignees to authenticated,service_role;
create policy test_host_access on public.organization_task_assignees for all to authenticated using(true) with check(true);
insert into public.profiles(id,email,full_name) values('10000000-0000-0000-0000-000000000099','caleb@bandto.com','Caleb');
insert into public.platform_staff_members(user_id,access_level) values('10000000-0000-0000-0000-000000000099','developer');

-- Earlier reviewer-scope assertions deliberately promoted Joel; restore his real role.
update public.platform_staff_members set access_level='coach' where user_id='10000000-0000-0000-0000-000000000003';
