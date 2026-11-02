\set ON_ERROR_STOP on
begin;
set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000001';
select public.fixture_closure_fiscal_documents();
set local role anon;
do $$ begin
 begin perform 1 from public.fiscal_sponsorship_documents; raise exception 'Anonymous document exposed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role authenticated;
do $$ begin
 if (select count(*) from public.fiscal_sponsorship_documents)<>1 then raise exception 'Owner scope changed'; end if;
 update public.fiscal_sponsorship_documents set title='Unauthorized';
 if found then raise exception 'Owner bypassed server-only write'; end if;
 begin perform public.fixture_fiscal_review(); raise exception 'Service review exposed'; exception when insufficient_privilege then null; end;
 begin perform public.fixture_fiscal_connect(); raise exception 'Service connection exposed'; exception when insufficient_privilege then null; end;
end $$;
set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000014';
do $$ begin if exists(select 1 from public.fiscal_sponsorship_documents) then raise exception 'Unrelated identity read documents'; end if; end $$;
reset role;
savepoint guest_scope;
insert into public.fiscal_guest_submissions values(public.fixture_form_id(1590),public.fixture_form_id(1402));
insert into public.platform_staff_members values(public.fixture_form_id(5),'coach') on conflict(user_id) do update set access_level='coach';
insert into public.fiscal_project_reviewers values(public.fixture_form_id(1402),public.fixture_form_id(5));
set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000002';
set local role authenticated;
do $$ begin if exists(select 1 from public.fiscal_sponsorship_documents) then raise exception 'Host owner accessed guest document'; end if; end $$;
set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000005';
do $$ begin
 if not exists(select 1 from public.fiscal_sponsorship_documents where id=public.fixture_form_id(1522)) then raise exception 'Assigned reviewer lost access'; end if;
 update public.fiscal_sponsorship_documents set title='Unauthorized' where id=public.fixture_form_id(1522);
 if found then raise exception 'Reviewer bypassed server-only write'; end if;
end $$;
reset role;
rollback to guest_scope;
set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000001';
do $$ declare col text; begin
 foreach col in array array['id','org_id','project_id','application_id'] loop
 begin execute format('update public.fiscal_sponsorship_documents set %I=public.fixture_form_id(1599) where org_id=public.fixture_form_id(1)',col);
 raise exception 'Reparent admitted'; exception when insufficient_privilege then if sqlerrm<>'Fiscal document identity cannot change' then raise; end if; end;
 end loop;
end $$;
savepoint active_transition;
set local role service_role;
do $$ begin
 if public.fixture_fiscal_review()->>'ok'<>'true' or public.fixture_fiscal_connect()->>'ok'<>'true' then raise exception 'Active atomic transition failed'; end if;
 if public.fixture_fiscal_review('2000-01-01Z')->>'code'<>'stale' then raise exception 'Stale review admitted'; end if;
 if public.fixture_fiscal_review()->>'transitioned'<>'false' or public.fixture_fiscal_connect()->>'transitioned'<>'false' then raise exception 'Exact replay duplicated effect'; end if;
end $$;
reset role;
do $$ begin
 if (select count(*) from public.fiscal_sponsorship_documents)<>3 or (select count(*) from public.fiscal_sponsorship_events)<>2
 or (select review_status from public.fiscal_sponsorship_documents where id=public.fixture_form_id(1521))<>'accepted' then raise exception 'Atomic effects diverged'; end if;
end $$;
rollback to active_transition;
-- Existing executed-evidence immutability stays stricter than FK cleanup.
savepoint immutable_evidence;
update public.fiscal_sponsorship_documents set kind='tax_form',status='executed' where id=public.fixture_form_id(1521);
do $$ begin
 begin update public.fiscal_sponsorship_documents set title='Changed' where id=public.fixture_form_id(1521);
 raise exception 'Executed evidence changed'; exception when raise_exception then if sqlerrm<>'Executed fiscal tax form evidence is immutable' then raise; end if; end;
 begin delete from auth.users where id=public.fixture_form_id(13);
 raise exception 'Account cleanup bypassed immutable evidence'; exception when raise_exception then if sqlerrm<>'Executed fiscal tax form evidence is immutable' then raise; end if; end;
end $$;
rollback to immutable_evidence;
-- Exercise legacy independent asset FKs: org2's asset is referenced by org1.
update public.fiscal_sponsorship_documents set asset_id=public.fixture_form_id(1512) where id=public.fixture_form_id(1521);
select public.fixture_closure('request',600,0);
set local role service_role;
do $$ declare command text; begin
 foreach command in array array[
 'insert into public.fiscal_sponsorship_documents(org_id,project_id,application_id,kind,title,version) values(public.fixture_form_id(1),public.fixture_form_id(1401),public.fixture_form_id(1501),''application'',''New'',2)',
 'insert into public.fiscal_sponsorship_documents select * from public.fiscal_sponsorship_documents where org_id=public.fixture_form_id(1) on conflict(application_id,kind,version) do update set title=excluded.title',
 'update public.fiscal_sponsorship_documents set title=''Changed'' where org_id=public.fixture_form_id(1)',
 'delete from public.fiscal_sponsorship_documents where org_id=public.fixture_form_id(1)',
 'update public.fiscal_sponsorship_documents set generated_by=null where org_id=public.fixture_form_id(1)',
 'update public.fiscal_sponsorship_documents set asset_id=null where org_id=public.fixture_form_id(1)',
 'select public.fixture_fiscal_review()', 'select public.fixture_fiscal_connect()'
 ] loop
 begin execute command; raise exception 'Closing fiscal effect admitted'; exception when insufficient_privilege then
 if sqlerrm<>'Organization unavailable' then raise; end if; end;
 end loop;
end $$;
reset role;
do $$ begin
 begin delete from public.fiscal_sponsorship_applications where id=public.fixture_form_id(1501); raise exception 'Application cascade bypassed closure';
 exception when insufficient_privilege then if sqlerrm<>'Organization unavailable' then raise; end if; end;
 if (select count(*) from public.fiscal_sponsorship_applications)<>2 or exists(select 1 from public.fiscal_sponsorship_events) then raise exception 'Rejected transition left effects'; end if;
end $$;
create function public.fixture_counterfeit_fiscal_cleanup() returns trigger language plpgsql as $$ begin
 update public.fiscal_sponsorship_documents set generated_by=null where org_id=public.fixture_form_id(1); return new; end $$;
create temporary table counterfeit_fiscal_cleanup(n integer);
create trigger counterfeit after insert on counterfeit_fiscal_cleanup for each row execute function public.fixture_counterfeit_fiscal_cleanup();
do $$ begin
 begin insert into counterfeit_fiscal_cleanup values(1); raise exception 'Counterfeit cleanup admitted'; exception when insufficient_privilege then
 if sqlerrm<>'Organization unavailable' then raise; end if; end;
 delete from public.organization_project_assets where id=public.fixture_form_id(1512);
 if exists(select 1 from public.fiscal_sponsorship_documents where asset_id is not null or title<>'Original') then raise exception 'Asset cleanup lost document content'; end if;
 delete from auth.users where id=public.fixture_form_id(13);
 if (select count(*) from public.fiscal_sponsorship_documents)<>2
 or exists(select 1 from public.fiscal_sponsorship_documents where generated_by is not null or uploaded_by is not null or reviewed_by is not null or confirmed_by is not null or title<>'Original')
 or not exists(select 1 from auth.users where id=public.fixture_form_id(12)) then raise exception 'Account cleanup crossed boundaries'; end if;
 delete from public.organizations where user_id=public.fixture_form_id(2);
 if (select count(*) from public.fiscal_sponsorship_documents)<>1 or not exists(select 1 from auth.users where id=public.fixture_form_id(2)) then raise exception 'Active org cascade crossed identities'; end if;
 perform public.fixture_closure('cancel',601,1);
 if public.read_workspace_page_public('community-table',public.fixture_form_id(10)) is not null
 or exists(select 1 from public.workspace_page_image_grants where org_id=public.fixture_form_id(1)) then raise exception 'Cancel restored publication/grants'; end if;
end $$;
set local role service_role;
select public.fixture_fiscal_review();
reset role;
select public.fixture_closure('request',602,2);
update public.organization_closures set requested_at='2000-01-01Z',export_until='2000-01-31Z';
do $$ declare role_name text; begin
 begin delete from public.fiscal_sponsorship_documents where org_id=public.fixture_form_id(1);
 raise exception 'Expiry authorized purge'; exception when insufficient_privilege then if sqlerrm<>'Organization unavailable' then raise; end if; end;
 foreach role_name in array array['anon','authenticated','service_role'] loop
 if has_function_privilege(role_name,'public.guard_fiscal_document_closure()','EXECUTE')
 or has_function_privilege(role_name,'public.organization_closure_command(uuid,uuid,text,uuid,integer)','EXECUTE') then raise exception 'Private lifecycle authority exposed'; end if;
 end loop;
 if not (select relrowsecurity and relforcerowsecurity from pg_class where oid='public.fiscal_sponsorship_documents'::regclass) then raise exception 'Document RLS removed'; end if;
end $$;
rollback;
