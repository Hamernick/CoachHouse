begin;
-- Prior suites deliberately revoke staff. Restore only this transaction's reviewer.
insert into public.platform_staff_members(user_id,access_level) values('10000000-0000-0000-0000-000000000002','coach')
on conflict(user_id) do update set access_level='coach';
select set_config('test.upload_project',(select project_id::text from public.fiscal_guest_submissions order by created_at limit 1),false);
insert into public.fiscal_project_reviewers(project_id,user_id)
values(current_setting('test.upload_project')::uuid,'10000000-0000-0000-0000-000000000002') on conflict do nothing;
select set_config('test.upload_prefix',(select org_id::text from public.organization_projects where id=current_setting('test.upload_project')::uuid)
 || '/' || current_setting('test.upload_project') || '/fiscal-uploads/10000000-0000-0000-0000-000000000002/50000000-0000-4000-8000-000000000001-',false);
insert into storage.objects(bucket_id,name) values('project-assets',current_setting('test.upload_prefix') || repeat('a',64) || '-attempt-budget.pdf');

do $$ begin
 if has_function_privilege('authenticated','public.register_fiscal_guest_project_asset(uuid,uuid,uuid,text,text,text,text,bigint,text)','execute')
 or has_function_privilege('anon','public.register_fiscal_guest_project_asset(uuid,uuid,uuid,text,text,text,text,bigint,text)','execute') then raise exception 'Guest upload RPC exposed'; end if;
end $$;
-- A second real guest project under the same host must not inherit this assignment.
insert into public.organization_projects
select (jsonb_populate_record(null::public.organization_projects,to_jsonb(p)||jsonb_build_object('id','60000000-0000-4000-8000-000000000001'))).*
from public.organization_projects p where id=current_setting('test.upload_project')::uuid;
insert into public.fiscal_sponsorship_applications
select (jsonb_populate_record(null::public.fiscal_sponsorship_applications,to_jsonb(a)||jsonb_build_object('id','70000000-0000-4000-8000-000000000001','project_id','60000000-0000-4000-8000-000000000001'))).*
from public.fiscal_sponsorship_applications a where project_id=current_setting('test.upload_project')::uuid;
insert into public.fiscal_guest_submissions(submission_key_hash,application_id,project_id,contact_email)
values(encode(digest('reviewer-upload-unassigned-project','sha256'),'hex'),'70000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001','separate@example.test');
set role service_role;
do $$ declare first_result jsonb; retried jsonb; begin
 first_result:=public.register_fiscal_guest_project_asset('10000000-0000-0000-0000-000000000002',current_setting('test.upload_project')::uuid,
 '50000000-0000-4000-8000-000000000001','budget.pdf','Budget','Budget support','application/pdf',123,current_setting('test.upload_prefix') || repeat('a',64) || '-attempt-budget.pdf');
 if first_result->>'ok'<>'true' or first_result->>'created'<>'true' then raise exception 'Reviewer upload failed: %',first_result; end if;
 retried:=public.register_fiscal_guest_project_asset('10000000-0000-0000-0000-000000000002',current_setting('test.upload_project')::uuid,
 '50000000-0000-4000-8000-000000000001','budget.pdf','Budget','Budget support','application/pdf',123,current_setting('test.upload_prefix') || repeat('a',64) || '-retry-budget.pdf');
 if retried->>'ok'<>'true' or retried->>'created'<>'false' or retried->>'assetId'<>first_result->>'assetId' then raise exception 'Retry duplicated file: %',retried; end if;
 if public.register_fiscal_guest_project_asset('10000000-0000-0000-0000-000000000002',current_setting('test.upload_project')::uuid,
 '50000000-0000-4000-8000-000000000001','budget.pdf','Budget','Budget support','application/pdf',123,current_setting('test.upload_prefix') || repeat('b',64) || '-changed.pdf')->>'code'<>'conflict' then raise exception 'Request reuse changed evidence'; end if;
 if public.register_fiscal_guest_project_asset('10000000-0000-0000-0000-000000000001',current_setting('test.upload_project')::uuid,
 gen_random_uuid(),'bad.pdf','bad',null,'application/pdf',123,'foreign/path')->>'code'<>'forbidden' then raise exception 'Host membership granted upload'; end if;
 if public.register_fiscal_guest_project_asset('10000000-0000-0000-0000-000000000002',current_setting('test.upload_project')::uuid,
 gen_random_uuid(),'bad.pdf','bad',null,'application/pdf',123,'foreign/path')->>'code'<>'invalid_asset' then raise exception 'Foreign organization path accepted'; end if;
 if public.register_fiscal_guest_project_asset('10000000-0000-0000-0000-000000000002','60000000-0000-4000-8000-000000000001',
 gen_random_uuid(),'bad.pdf','bad',null,'application/pdf',123,'foreign/path')->>'code'<>'forbidden' then raise exception 'Unassigned guest project escalated'; end if;
 if public.register_fiscal_guest_project_asset('10000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001',
 gen_random_uuid(),'bad.pdf','bad',null,'application/pdf',123,'foreign/path')->>'code'<>'forbidden' then raise exception 'Ordinary project escalated'; end if;
end $$;
reset role;
do $$ begin
 if (select count(*) from public.organization_project_assets where id='50000000-0000-4000-8000-000000000001')<>1
 or (select count(*) from public.fiscal_sponsorship_events where metadata->>'asset_id'='50000000-0000-4000-8000-000000000001')<>1 then raise exception 'Asset/event not idempotent'; end if;
 if not exists(select 1 from public.organization_project_assets where id='50000000-0000-4000-8000-000000000001' and created_by='10000000-0000-0000-0000-000000000002' and asset_type='pdf') then raise exception 'Uploader/type lost'; end if;
end $$;
-- Event failure must roll back the asset insert within the same transaction.
create function pg_temp.reject_test_upload_event() returns trigger language plpgsql as $$ begin
 if new.metadata->>'asset_id'='50000000-0000-4000-8000-000000000002' then raise exception 'Test event failure'; end if;
 return new;
end $$;
create trigger reject_test_upload_event before insert on public.fiscal_sponsorship_events for each row execute function pg_temp.reject_test_upload_event();
insert into storage.objects(bucket_id,name) values('project-assets',replace(current_setting('test.upload_prefix'),'50000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000002') || repeat('c',64) || '-atomic.pdf');
set role service_role;
do $$ begin
 begin
  perform public.register_fiscal_guest_project_asset('10000000-0000-0000-0000-000000000002',current_setting('test.upload_project')::uuid,
  '50000000-0000-4000-8000-000000000002','atomic.pdf','Atomic',null,'application/pdf',123,replace(current_setting('test.upload_prefix'),'50000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000002') || repeat('c',64) || '-atomic.pdf');
  raise exception 'Atomic failure was ignored';
 exception when raise_exception then if sqlerrm<>'Test event failure' then raise; end if; end;
end $$;
reset role;
do $$ begin
 if exists(select 1 from public.organization_project_assets where id='50000000-0000-4000-8000-000000000002') then raise exception 'Partial asset escaped failed event transaction'; end if;
end $$;
delete from public.fiscal_project_reviewers where project_id=current_setting('test.upload_project')::uuid and user_id='10000000-0000-0000-0000-000000000002';
set role service_role;
do $$ begin
 if public.register_fiscal_guest_project_asset('10000000-0000-0000-0000-000000000002',current_setting('test.upload_project')::uuid,
 '50000000-0000-4000-8000-000000000001','budget.pdf','Budget','Budget support','application/pdf',123,current_setting('test.upload_prefix') || repeat('a',64) || '-attempt-budget.pdf')->>'code'<>'forbidden' then raise exception 'Revoked reviewer retained upload'; end if;
end $$;
reset role;
insert into public.fiscal_project_reviewers(project_id,user_id) values(current_setting('test.upload_project')::uuid,'10000000-0000-0000-0000-000000000002');
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',false);
do $$ begin
 begin
  insert into public.organization_project_assets(id,project_id) values(gen_random_uuid(),current_setting('test.upload_project')::uuid);
  raise exception 'Generic reviewer INSERT was opened';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
