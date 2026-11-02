\set ON_ERROR_STOP on
\ir organization-closure-fiscal-signing-fixture.sql
-- Expand inherited minimal project/program/asset prerequisites, then load real
-- task/detail schemas, current RPCs, author cleanup, notification and tracker rules.
-- Omitted hosted support/storage/provider prerequisites remain synthetic.
alter table public.organization_projects add column starter_seed_key text,add column starter_seed_version integer,
 add column recurrence_generated boolean not null default false,add column schedule_confirmed boolean not null default false,
 add column guided_setup jsonb,add column creation_request_id uuid,
 add constraint organization_projects_status_check check(status in('backlog','planned','active','cancelled','completed'));
\ir ../migrations/20260406183000_add_member_workspace_projects.sql
drop table public.organization_tasks,public.organization_project_notes,public.organization_project_quick_links;
\ir ../migrations/20260406194000_add_member_workspace_tasks.sql
\ir ../migrations/20260407170000_add_member_workspace_dialog_metadata.sql
\ir ../migrations/20260407200000_add_member_workspace_project_detail_records.sql
alter table public.organization_project_assets add column created_by uuid references public.profiles(id),
 add column updated_by uuid references public.profiles(id) on delete set null,
 add column created_at timestamptz default now(),add column updated_at timestamptz default now();
\ir ../migrations/20260407213000_add_member_workspace_project_assets.sql
\ir ../migrations/20260504143000_allow_account_deletion_with_workspace_authors.sql
alter table public.programs alter column id set default gen_random_uuid(),add column slug text,add column title text,
 add column subtitle text,add column location text,add column image_url text,add column duration_label text,
 add column start_date timestamptz,add column end_date timestamptz,add column features text[],add column status_label text,
 add column is_public boolean not null default false,add column created_at timestamptz default now();
alter table public.programs drop constraint programs_user_id_fkey,
 add constraint programs_user_id_fkey foreign key(user_id) references auth.users(id) on delete cascade;
\ir ../migrations/20251019191500_programs_schema.sql
-- Latest actual DELETE policy; surrounding unrelated legacy tables remain synthetic.
drop policy if exists "programs_delete" on public.programs;
create policy "programs_delete" on public.programs for delete
  to authenticated
  using (
    public.is_admin()
    or user_id = (select auth.uid())
    or exists (
      select 1
      from public.organization_memberships om
      where om.org_id = programs.user_id
        and om.member_id = (select auth.uid())
        and om.role in ('admin', 'staff')
    )
  );

alter table public.organization_tasks add column recurrence_anchor_start date,add column recurrence_anchor_end date;
alter table public.profiles add column full_name text,add column email text;
create table public.notifications(id uuid primary key default gen_random_uuid(),user_id uuid references public.profiles(id) on delete cascade,
 title text,description text,href text,tone text,type text,org_id uuid references public.organizations(user_id) on delete cascade,
 actor_id uuid references public.profiles(id) on delete set null,metadata jsonb);
\ir ../migrations/20260805233500_atomic_organization_task_creation.sql
\ir ../migrations/20260805234500_atomic_organization_task_updates.sql
\ir ../migrations/20260805235500_atomic_organization_task_deletion.sql
\ir ../migrations/20260805235900_atomic_organization_task_reordering.sql
\ir ../migrations/20260806005000_atomic_organization_project_status_updates.sql
\ir ../migrations/20260920150000_project_option_settings.sql
-- The latest project RPCs/generator were loaded by the overview fixture. Install
-- the original deferred recurrence triggers without replaying additive columns.
create constraint trigger organization_project_monthly_recurrence after update on public.organization_projects deferrable initially deferred
 for each row when(old.status is distinct from 'completed' and new.status='completed') execute function public.generate_next_monthly_project();
create constraint trigger organization_project_monthly_recurrence_on_create after insert on public.organization_projects deferrable initially deferred
 for each row when(new.status='completed' and new.recurrence='monthly') execute function public.generate_next_monthly_project();
create trigger confirm_changed_project_schedule before update of start_date,end_date on public.organization_projects
 for each row execute function public.confirm_changed_project_schedule();
\ir ../migrations/20260928160000_task_assignment_notifications.sql
\ir ../migrations/20260928170000_tracker_task_support.sql
\ir ../migrations/20261021010000_task_schedule_and_relative_order.sql
-- Reapply actual guest restrictions to the three tables replaced from stubs.
do $$ declare relation text; begin
 foreach relation in array array['organization_tasks','organization_project_notes','organization_project_quick_links'] loop
 execute format('create policy fiscal_guest_related_scope on public.%I as restrictive for all to authenticated using(public.can_access_fiscal_guest_project(project_id)) with check(public.can_access_fiscal_guest_project(project_id))',relation);
 execute format('create policy fiscal_guest_server_insert on public.%I as restrictive for insert to authenticated with check(public.fiscal_guest_project_reviewer_access(project_id,(select auth.uid())) is null)',relation);
 execute format('create policy fiscal_guest_server_update on public.%I as restrictive for update to authenticated using(public.fiscal_guest_project_reviewer_access(project_id,(select auth.uid())) is null) with check(public.fiscal_guest_project_reviewer_access(project_id,(select auth.uid())) is null)',relation);
 execute format('create policy fiscal_guest_server_delete on public.%I as restrictive for delete to authenticated using(public.fiscal_guest_project_reviewer_access(project_id,(select auth.uid())) is null)',relation);
 end loop;
end $$;
set check_function_bodies=on;
\ir ../migrations/20261102190000_organization_closure_project_task_writes.sql
grant select,insert,update,delete on public.organization_projects,public.organization_tasks,public.organization_task_assignees,
 public.organization_project_notes,public.organization_project_quick_links,public.organization_project_assets,
 public.organization_workspace_starter_state,public.programs to authenticated,service_role;
create function public.fixture_closure_project_tasks() returns void language plpgsql as $$
begin
 delete from public.organization_closure_operations where org_id=public.fixture_form_id(18);
 delete from public.organization_closures where org_id=public.fixture_form_id(18);
 delete from public.organizations where user_id=public.fixture_form_id(18);
 truncate public.task_tracker_import_records,public.task_tracker_import_batches;
 -- Clear dependent task/detail rows before the inherited helper replaces projects.
 truncate public.organization_tasks,public.organization_task_assignees,public.organization_project_notes,public.organization_project_quick_links,public.notifications,public.organization_workspace_starter_state;
 perform public.fixture_closure_fiscal_signing();
 insert into auth.users values(public.fixture_form_id(18),'personal@example.org',now()) on conflict do nothing;
 insert into public.programs(id,user_id,title) values(public.fixture_form_id(1850),public.fixture_form_id(18),'Personal')
 on conflict(id) do update set title='Personal';
 update public.organization_projects set created_by=public.fixture_form_id(13),updated_by=public.fixture_form_id(13),
 start_date='2026-11-01',end_date='2026-11-30',task_count=1 where id in(public.fixture_form_id(1401),public.fixture_form_id(1402));
 insert into public.organization_tasks(id,org_id,project_id,title,start_date,end_date,created_by,updated_by)
 select public.fixture_form_id(1800+n),public.fixture_form_id(n),public.fixture_form_id(1400+n),'Original','2026-11-01','2026-11-30',
 public.fixture_form_id(13),public.fixture_form_id(13) from generate_series(1,2) n;
 insert into public.organization_task_assignees(id,org_id,task_id,user_id,created_by)
 select public.fixture_form_id(1810+n),public.fixture_form_id(n),public.fixture_form_id(1800+n),public.fixture_form_id(13),public.fixture_form_id(1) from generate_series(1,2) n;
 insert into public.organization_project_notes(id,org_id,project_id,title,created_by,updated_by)
 select public.fixture_form_id(1820+n),public.fixture_form_id(n),public.fixture_form_id(1400+n),'Original',public.fixture_form_id(13),public.fixture_form_id(13) from generate_series(1,2) n;
 insert into public.organization_project_quick_links(id,org_id,project_id,name,url,created_by,updated_by)
 select public.fixture_form_id(1830+n),public.fixture_form_id(n),public.fixture_form_id(1400+n),'Original','https://example.org',public.fixture_form_id(13),public.fixture_form_id(13) from generate_series(1,2) n;
 update public.organization_project_assets set created_by=public.fixture_form_id(13),updated_by=public.fixture_form_id(13);
 insert into public.organization_workspace_starter_state(org_id,updated_by) select public.fixture_form_id(n),public.fixture_form_id(13) from generate_series(1,2) n;
 insert into public.task_tracker_import_batches(id,namespace,source_hash,manifest_hash,org_id,actor_id,status,manifest)
 values(public.fixture_form_id(1840),'synthetic','source','manifest',public.fixture_form_id(1),public.fixture_form_id(1),'applying','{}');
 insert into public.task_tracker_import_records(namespace,entity_type,source_id,batch_id,source_payload,disposition)
 values('synthetic','task','source',public.fixture_form_id(1840),'{}','created');
end; $$;
create function public.fixture_task_create() returns jsonb language sql as $$
 select public.create_organization_task_transition(public.fixture_form_id(1),public.fixture_form_id(1401),'Created',null,'task','todo',null,null,'medium',null,null,public.fixture_form_id(13)); $$;
create function public.fixture_task_move(destination integer default 1402) returns jsonb language sql as $$
 select public.update_organization_task_transition(public.fixture_form_id(1),id,org_id,project_id,public.fixture_form_id(destination),
 'Moved',description,task_type,status,start_date,end_date,priority,tag_label,workstream_name,public.fixture_form_id(13))
 from public.organization_tasks where id=public.fixture_form_id(1801); $$;
create function public.fixture_project_complete(expected_at timestamptz default null) returns jsonb language sql as $$
 select public.update_organization_project_status_transition(id,public.fixture_form_id(1),org_id,coalesce(expected_at,updated_at),'completed')
 from public.organization_projects where id=public.fixture_form_id(1401); $$;
create function public.fixture_task_schedule() returns jsonb language sql as $$
 select public.schedule_organization_task_transition(public.fixture_form_id(1),id,project_id,org_id,'2026-11-02',start_date,end_date)
 from public.organization_tasks where id=public.fixture_form_id(1801); $$;
create function public.fixture_project_save() returns jsonb language sql as $$
 select public.update_organization_project_transition(id,public.fixture_form_id(1),org_id,updated_at,
 to_jsonb(p)||'{"name":"Edited"}'::jsonb,false,null,null) from public.organization_projects p where id=public.fixture_form_id(1401); $$;
create function public.fixture_project_create() returns jsonb language sql as $$
 select public.create_organization_project_transition(public.fixture_form_id(1),public.fixture_form_id(1),
 '{"name":"Created","status":"planned","priority":"medium"}',false,null,null); $$;
