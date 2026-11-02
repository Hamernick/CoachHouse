\set ON_ERROR_STOP on
begin;
set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000001';
select public.fixture_closure_project_tasks();
savepoint personal_program;
set local role authenticated;
set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000018';
do $$ begin
 insert into public.programs(id,user_id,title) values(public.fixture_form_id(1851),public.fixture_form_id(18),'Personal insert');
 update public.programs set title='Personal updated' where id=public.fixture_form_id(1851);
 if not found then raise exception 'Personal program write lost'; end if;
 delete from public.programs where id=public.fixture_form_id(1851);
 if not found then raise exception 'Personal owner deletion lost'; end if;
end $$;
reset role;
set local role service_role;
delete from public.programs where id=public.fixture_form_id(1851);
reset role;
do $$ begin if exists(select 1 from public.programs where id=public.fixture_form_id(1851)) then raise exception 'Authorized personal program deletion lost'; end if; end $$;
rollback to personal_program;
set local role anon;
do $$ begin
 begin perform 1 from public.organization_tasks; raise exception 'Anonymous tasks exposed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role authenticated;
do $$ begin
 if (select count(*) from public.organization_tasks)<>1 then raise exception 'Owner task scope changed'; end if;
 begin perform public.fixture_task_create(); raise exception 'Private task RPC exposed'; exception when insufficient_privilege then null; end;
end $$;
set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000014';
do $$ begin if exists(select 1 from public.organization_tasks) then raise exception 'Unrelated task read'; end if; end $$;
reset role;
set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000001';
savepoint active_move;
set local role service_role;
do $$ begin
 if public.fixture_task_move()->>'ok'<>'true' then raise exception 'Active task move failed'; end if;
 if public.update_organization_task_transition(public.fixture_form_id(1),public.fixture_form_id(1801),public.fixture_form_id(1),public.fixture_form_id(1401),public.fixture_form_id(1402),
 'Stale',null,'task','todo',null,null,'medium',null,null,null)->>'code'<>'stale' then raise exception 'Moved task stale scope ignored'; end if;
end $$;
reset role;
do $$ begin
 if not exists(select 1 from public.organization_tasks where id=public.fixture_form_id(1801) and org_id=public.fixture_form_id(2) and project_id=public.fixture_form_id(1402))
 or not exists(select 1 from public.organization_task_assignees where task_id=public.fixture_form_id(1801) and org_id=public.fixture_form_id(2))
 or (select task_count from public.organization_projects where id=public.fixture_form_id(1401))<>0
 or (select task_count from public.organization_projects where id=public.fixture_form_id(1402))<>2 then raise exception 'Move effects diverged'; end if;
end $$;
rollback to active_move;
-- Identity is stable; authorized scope moves are separately dual-fenced.
do $$ begin
 begin update public.organization_tasks set id=public.fixture_form_id(1899) where id=public.fixture_form_id(1801); raise exception 'Task identity changed';
 exception when insufficient_privilege then if sqlerrm<>'Project/task record identity cannot change' then raise; end if; end;
 begin update public.task_tracker_import_batches set org_id=public.fixture_form_id(2); raise exception 'Import owner changed';
 exception when insufficient_privilege then if sqlerrm<>'Tracker import owner cannot change' then raise; end if; end;
 begin update public.task_tracker_import_records set namespace='moved'; raise exception 'Import identity changed';
 exception when insufficient_privilege then if sqlerrm<>'Tracker import identity cannot change' then raise; end if; end;
end $$;
select public.fixture_closure('request',600,0);
set local role service_role;
do $$ declare relation text; predicate text; command text; begin
 foreach relation in array array['programs','organization_projects','organization_tasks','organization_task_assignees',
 'organization_project_notes','organization_project_quick_links','organization_project_assets','organization_workspace_starter_state',
 'task_tracker_import_batches','task_tracker_import_records'] loop
 predicate:=case when relation='programs' then 'user_id=public.fixture_form_id(1)' when relation='task_tracker_import_records' then 'namespace=''synthetic''' else 'org_id=public.fixture_form_id(1)' end;
 foreach command in array array[
 format('delete from public.%I where %s',relation,predicate),
 format('insert into public.%I select * from public.%I where %s',relation,relation,predicate)
 ] loop
 begin execute command; raise exception 'Closing write admitted: %',relation; exception when insufficient_privilege then
 if sqlerrm<>'Organization unavailable' then raise; end if; end;
 end loop;
 end loop;
 begin update public.organization_tasks set org_id=public.fixture_form_id(2),project_id=public.fixture_form_id(1402) where id=public.fixture_form_id(1801);
 raise exception 'Move escaped closure'; exception when insufficient_privilege then if sqlerrm<>'Organization unavailable' then raise; end if; end;
 begin update public.programs set user_id=public.fixture_form_id(2) where id=public.fixture_form_id(1620);
 raise exception 'Program escaped closure'; exception when insufficient_privilege then if sqlerrm<>'Organization unavailable' then raise; end if; end;
end $$;
reset role;
create function public.fixture_counterfeit_project_cleanup() returns trigger language plpgsql as $$ begin
 update public.organization_project_assets set created_by=null where id=public.fixture_form_id(1511); return new; end $$;
create temporary table counterfeit_project_cleanup(n integer);
create trigger counterfeit after insert on counterfeit_project_cleanup for each row execute function public.fixture_counterfeit_project_cleanup();
do $$ begin
 begin insert into counterfeit_project_cleanup values(1); raise exception 'Counterfeit cleanup admitted'; exception when insufficient_privilege then
 if sqlerrm<>'Organization unavailable' then raise; end if; end;
 delete from auth.users where id=public.fixture_form_id(13);
 if (select count(*) from public.organization_tasks)<>2 or exists(select 1 from public.organization_task_assignees)
 or exists(select 1 from public.organization_tasks where created_by is not null or updated_by is not null or title<>'Original')
 or exists(select 1 from public.organization_project_notes where created_by is not null or updated_by is not null or title<>'Original')
 or exists(select 1 from public.organization_project_quick_links where created_by is not null or updated_by is not null or name<>'Original')
 or exists(select 1 from public.organization_project_assets where created_by is not null or updated_by is not null)
 or exists(select 1 from public.organization_workspace_starter_state where updated_by is not null)
 or not exists(select 1 from auth.users where id=public.fixture_form_id(12)) then raise exception 'Account cleanup lost independent work'; end if;
 delete from public.organizations where user_id=public.fixture_form_id(2);
 if (select count(*) from public.organization_tasks)<>1 or not exists(select 1 from auth.users where id=public.fixture_form_id(2)) then raise exception 'Active org cascade lost shared identity'; end if;
 perform public.fixture_closure('cancel',601,1);
 if exists(select 1 from public.workspace_page_image_grants where org_id=public.fixture_form_id(1))
 or public.read_workspace_page_public('community-table',public.fixture_form_id(10)) is not null then raise exception 'Cancel restored grants/publication'; end if;
end $$;
set local role service_role;
select public.fixture_project_save();
reset role;
select public.fixture_closure('request',602,2);
update public.organization_closures set requested_at='2000-01-01Z',export_until='2000-01-31Z';
do $$ declare role_name text; begin
 begin delete from public.organization_tasks where id=public.fixture_form_id(1801); raise exception 'Expiry authorized purge';
 exception when insufficient_privilege then if sqlerrm<>'Organization unavailable' then raise; end if; end;
 foreach role_name in array array['anon','authenticated','service_role'] loop
 if has_function_privilege(role_name,'public.guard_project_task_closure()','EXECUTE')
 or has_function_privilege(role_name,'public.organization_closure_command(uuid,uuid,text,uuid,integer)','EXECUTE') then raise exception 'Private lifecycle authority exposed'; end if;
 end loop;
end $$;
rollback;
