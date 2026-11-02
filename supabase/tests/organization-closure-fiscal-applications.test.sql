\set ON_ERROR_STOP on
begin;
set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000001';
select public.fixture_closure_fiscal_applications();
set local role anon;
do $$ begin
 begin perform 1 from public.fiscal_sponsorship_applications; raise exception 'Anonymous application exposed'; exception when insufficient_privilege then null; end;
 begin perform 1 from public.fiscal_sponsorship_reviews; raise exception 'Anonymous review exposed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role authenticated;
do $$ begin
 if (select count(*) from public.fiscal_sponsorship_applications)<>2 or (select count(*) from public.fiscal_sponsorship_reviews)<>1 then raise exception 'Owner read scope changed'; end if;
 begin update public.fiscal_sponsorship_applications set project_name='Unauthorized'; raise exception 'Owner bypassed server write'; exception when insufficient_privilege then null; end;
 begin update public.fiscal_sponsorship_reviews set notes='Unauthorized'; raise exception 'Owner bypassed review write'; exception when insufficient_privilege then null; end;
 begin perform public.fixture_fiscal_application_save(); raise exception 'Service save exposed'; exception when insufficient_privilege then null; end;
 begin perform public.fixture_fiscal_application_submit(); raise exception 'Service submit exposed'; exception when insufficient_privilege then null; end;
 begin perform public.fixture_fiscal_application_review(); raise exception 'Service review exposed'; exception when insufficient_privilege then null; end;
end $$;
set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000014';
do $$ begin
 if exists(select 1 from public.fiscal_sponsorship_applications) or exists(select 1 from public.fiscal_sponsorship_reviews) then raise exception 'Unrelated identity read fiscal state'; end if;
end $$;
reset role;
savepoint guest_scope;
insert into public.fiscal_guest_submissions values(public.fixture_form_id(1690),public.fixture_form_id(1402));
insert into public.platform_staff_members values(public.fixture_form_id(5),'coach') on conflict(user_id) do update set access_level='coach';
insert into public.fiscal_project_reviewers values(public.fixture_form_id(1402),public.fixture_form_id(5));
set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000002';
set local role authenticated;
do $$ begin
 if exists(select 1 from public.fiscal_sponsorship_applications) or exists(select 1 from public.fiscal_sponsorship_reviews) then raise exception 'Host owner read guest state'; end if;
end $$;
set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000005';
do $$ begin
 if not exists(select 1 from public.fiscal_sponsorship_applications where id=public.fixture_form_id(1502))
 or not exists(select 1 from public.fiscal_sponsorship_reviews where id=public.fixture_form_id(1612)) then raise exception 'Assigned reviewer lost read access'; end if;
end $$;
reset role;
rollback to guest_scope;
set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000001';
do $$ declare relation text; col text; begin
 foreach relation in array array['fiscal_sponsorship_applications','fiscal_sponsorship_reviews'] loop
 foreach col in array case when relation='fiscal_sponsorship_applications' then array['id','org_id','project_id'] else array['id','org_id','project_id','application_id'] end loop
 begin execute format('update public.%I set %I=public.fixture_form_id(1699) where org_id=public.fixture_form_id(1)',relation,col);
 raise exception 'Reparent admitted'; exception when insufficient_privilege then if sqlerrm<>'Fiscal application/review identity cannot change' then raise; end if; end;
 end loop; end loop;
end $$;
savepoint active_transitions;
set local role service_role;
do $$ begin
 if public.save_fiscal_sponsorship_application_draft_transition(public.fixture_form_id(1401),public.fixture_form_id(1),
 (select updated_at from public.fiscal_sponsorship_applications where id=public.fixture_form_id(1501)),
 '{}',null,false,'[]',0,false)->>'code'<>'invalid_status' then raise exception 'Locked draft bypassed'; end if;
 if public.fixture_fiscal_application_save()->>'ok'<>'true' or public.fixture_fiscal_application_create()->>'ok'<>'true'
 or public.fixture_fiscal_application_submit()->>'ok'<>'true' or public.fixture_fiscal_application_review()->>'ok'<>'true' then raise exception 'Active transition failed'; end if;
 if public.fixture_fiscal_application_save('2000-01-01Z')->>'code'<>'stale'
 or public.fixture_fiscal_application_review('2000-01-01Z')->>'code'<>'stale' then raise exception 'Stale write admitted'; end if;
 if public.fixture_fiscal_application_submit()->>'transitioned'<>'false' then raise exception 'Submit replay duplicated effect'; end if;
end $$;
reset role;
do $$ begin
 if (select count(*) from public.fiscal_sponsorship_applications)<>4 or (select count(*) from public.fiscal_sponsorship_reviews)<>3
 or (select count(*) from public.fiscal_sponsorship_events)<>2
 or (select project_name from public.fiscal_sponsorship_applications where id=public.fixture_form_id(1501))<>'Edited'
 or not exists(select 1 from public.programs where id=public.fixture_form_id(1620) and goal_cents=400 and wizard_snapshot->>'preserved'='true'
 and wizard_snapshot->'budgetRows'='[{"name":"Budget","amount":500}]'::jsonb) then raise exception 'Atomic application/budget effects diverged'; end if;
end $$;
rollback to active_transitions;
select public.fixture_closure('request',600,0);
set local role service_role;
do $$ declare command text; begin
 foreach command in array array[
 'insert into public.fiscal_sponsorship_applications(org_id,project_id) values(public.fixture_form_id(1),public.fixture_form_id(1404))',
 'update public.fiscal_sponsorship_applications set project_name=''Changed'' where id=public.fixture_form_id(1501)',
 'delete from public.fiscal_sponsorship_applications where id=public.fixture_form_id(1601)',
 'insert into public.fiscal_sponsorship_applications select * from public.fiscal_sponsorship_applications where id=public.fixture_form_id(1501) on conflict(org_id,project_id) do update set project_name=excluded.project_name',
 'insert into public.fiscal_sponsorship_reviews(application_id,org_id,project_id,decision) values(public.fixture_form_id(1501),public.fixture_form_id(1),public.fixture_form_id(1401),''approved'')',
 'update public.fiscal_sponsorship_reviews set notes=''Changed'' where id=public.fixture_form_id(1611)',
 'delete from public.fiscal_sponsorship_reviews where id=public.fixture_form_id(1611)',
 'insert into public.fiscal_sponsorship_reviews select * from public.fiscal_sponsorship_reviews where id=public.fixture_form_id(1611) on conflict(application_id,decision,reviewed_at) do update set notes=excluded.notes',
 'update public.fiscal_sponsorship_applications set created_by=null where id=public.fixture_form_id(1501)',
 'update public.fiscal_sponsorship_reviews set reviewed_by=null where id=public.fixture_form_id(1611)',
 'select public.fixture_fiscal_application_save()', 'select public.fixture_fiscal_application_create()',
 'select public.fixture_fiscal_application_submit()', 'select public.fixture_fiscal_application_review()'
 ] loop
 begin execute command; raise exception 'Closing fiscal state effect admitted'; exception when insufficient_privilege then
 if sqlerrm<>'Organization unavailable' then raise; end if; end;
 end loop;
end $$;
reset role;
do $$ begin
 begin delete from public.organization_projects where id=public.fixture_form_id(1403); raise exception 'Project cascade bypassed closure';
 exception when insufficient_privilege then if sqlerrm<>'Organization unavailable' then raise; end if; end;
 if (select count(*) from public.fiscal_sponsorship_applications)<>3 or (select count(*) from public.fiscal_sponsorship_reviews)<>2
 or exists(select 1 from public.fiscal_sponsorship_events) or (select goal_cents from public.programs where id=public.fixture_form_id(1620))<>200 then raise exception 'Denied transition left effects'; end if;
end $$;
create function public.fixture_counterfeit_fiscal_application_cleanup() returns trigger language plpgsql as $$ begin
 if new.n=1 then update public.fiscal_sponsorship_applications set created_by=null where id=public.fixture_form_id(1501);
 else update public.fiscal_sponsorship_reviews set reviewed_by=null where id=public.fixture_form_id(1611); end if; return new; end $$;
create temporary table counterfeit_fiscal_application_cleanup(n integer);
create trigger counterfeit after insert on counterfeit_fiscal_application_cleanup for each row execute function public.fixture_counterfeit_fiscal_application_cleanup();
do $$ declare n integer; begin
 for n in 1..2 loop
 begin insert into counterfeit_fiscal_application_cleanup values(n); raise exception 'Counterfeit cleanup admitted'; exception when insufficient_privilege then
 if sqlerrm<>'Organization unavailable' then raise; end if; end;
 end loop;
 delete from auth.users where id=public.fixture_form_id(13);
 if (select count(*) from public.fiscal_sponsorship_applications)<>3 or (select count(*) from public.fiscal_sponsorship_reviews)<>2
 or exists(select 1 from public.fiscal_sponsorship_applications where created_by is not null or updated_by is not null or reviewed_by is not null or project_name<>'Original')
 or exists(select 1 from public.fiscal_sponsorship_reviews where reviewed_by is not null or notes<>'Original')
 or not exists(select 1 from auth.users where id=public.fixture_form_id(12)) then raise exception 'Account cleanup crossed boundaries'; end if;
 delete from public.organizations where user_id=public.fixture_form_id(2);
 if (select count(*) from public.fiscal_sponsorship_applications)<>2 or (select count(*) from public.fiscal_sponsorship_reviews)<>1
 or not exists(select 1 from auth.users where id=public.fixture_form_id(2)) then raise exception 'Active cascade crossed identities'; end if;
 perform public.fixture_closure('cancel',601,1);
 if public.read_workspace_page_public('community-table',public.fixture_form_id(10)) is not null
 or exists(select 1 from public.workspace_page_image_grants where org_id=public.fixture_form_id(1)) then raise exception 'Cancel restored publication/grants'; end if;
end $$;
set local role service_role;
select public.fixture_fiscal_application_save();
reset role;
select public.fixture_closure('request',602,2);
update public.organization_closures set requested_at='2000-01-01Z',export_until='2000-01-31Z';
do $$ declare role_name text; relation text; begin
 foreach relation in array array['fiscal_sponsorship_applications','fiscal_sponsorship_reviews'] loop
 begin execute format('delete from public.%I where org_id=public.fixture_form_id(1)',relation);
 raise exception 'Expiry authorized purge'; exception when insufficient_privilege then if sqlerrm<>'Organization unavailable' then raise; end if; end;
 if not (select relrowsecurity and relforcerowsecurity from pg_class where oid=('public.'||relation)::regclass) then raise exception 'Fiscal RLS removed'; end if;
 end loop;
 foreach role_name in array array['anon','authenticated','service_role'] loop
 if has_function_privilege(role_name,'public.guard_fiscal_application_closure()','EXECUTE')
 or has_function_privilege(role_name,'public.organization_closure_command(uuid,uuid,text,uuid,integer)','EXECUTE') then raise exception 'Private lifecycle authority exposed'; end if;
 end loop;
end $$;
rollback;
