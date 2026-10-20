create table auth.users(id uuid primary key);
alter table profiles add column full_name text, add column email text;
insert into profiles(id,role,full_name,email) values('00000000-0000-4000-8000-000000000003','member','Unrelated user','unrelated@example.test');
insert into auth.users select id from profiles;
update profiles set full_name='Assigning admin' where id='00000000-0000-4000-8000-000000000001';
update profiles set full_name='Assigned coach' where id='00000000-0000-4000-8000-000000000002';
create table public.platform_staff_members(user_id uuid primary key references profiles(id), access_level text);
insert into public.platform_staff_members values('00000000-0000-4000-8000-000000000001','developer'),('00000000-0000-4000-8000-000000000002','coach');

-- Import suppression dependency from 20260928170000_tracker_task_support.sql.
-- Other tracker transition/schema changes are outside this focused fixture.
create table public.task_tracker_import_batches(id uuid primary key, status text not null);
create function public.is_task_tracker_import_active() returns boolean
language sql stable security definer set search_path = '' set row_security = off as $$
  select exists(select 1 from public.task_tracker_import_batches
    where id::text = current_setting('app.task_tracker_import_batch', true) and status = 'applying');
$$;
revoke all on function public.is_task_tracker_import_active() from public, anon, authenticated;
