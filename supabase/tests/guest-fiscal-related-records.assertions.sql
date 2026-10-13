begin;
-- Restore a real reviewer after the prior suite's revocation checks.
insert into public.platform_staff_members(user_id,access_level) values('10000000-0000-0000-0000-000000000002','coach');
insert into public.fiscal_project_reviewers(project_id,user_id) select project_id,'10000000-0000-0000-0000-000000000002' from public.fiscal_guest_submissions;
select set_config('test.guest_project',(select project_id::text from public.fiscal_guest_submissions limit 1),true);
do $$ declare relation text; pid uuid:=current_setting('test.guest_project')::uuid; begin
 foreach relation in array array['organization_tasks','organization_project_notes','organization_project_quick_links',
 'organization_project_assets','organization_project_overview_documents','organization_project_activity_events',
 'platform_admin_project_workstream_states','fiscal_sponsorship_signing_drafts','fiscal_sponsorship_signatures'] loop
  execute format('insert into public.%I(project_id) values($1),($2)',relation) using pid,'20000000-0000-0000-0000-000000000001'::uuid;
 end loop;
 insert into storage.objects(bucket_id,name) values('project-assets','host/'||pid||'/file.pdf'),('project-assets','host/20000000-0000-0000-0000-000000000001/file.pdf');
 update public.fiscal_sponsorship_documents set storage_bucket='fiscal-signing',storage_path='historical/private.pdf' where project_id=pid;
 insert into storage.objects(bucket_id,name) values('fiscal-signing','historical/private.pdf');
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
do $$ declare relation text; visible integer; begin
 foreach relation in array array['organization_tasks','organization_project_notes','organization_project_quick_links',
 'organization_project_assets','organization_project_overview_documents','organization_project_activity_events',
 'platform_admin_project_workstream_states','fiscal_sponsorship_signing_drafts','fiscal_sponsorship_signatures'] loop
  execute format('select count(*) from public.%I',relation) into visible;
  if visible<>1 then raise exception 'Host can read guest related record: %',relation; end if;
  begin
   execute format('insert into public.%I(project_id) values($1)',relation) using current_setting('test.guest_project')::uuid;
   raise exception 'Host can insert guest related record: %',relation;
  exception when insufficient_privilege then null; end;
 end loop;
 if (select count(*) from storage.objects)<>1 then raise exception 'Host sees guest storage'; end if;
 begin
  insert into storage.objects(bucket_id,name) values('project-assets','host/'||current_setting('test.guest_project')||'/forged.pdf');
  raise exception 'Host can upload to guest project';
 exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',true);
do $$ begin
 if (select count(*) from storage.objects)<>3 then raise exception 'Assigned reviewer cannot read permitted storage'; end if;
 if (select count(*) from public.organization_project_assets)<>2 then raise exception 'Assigned reviewer cannot read permitted assets'; end if;
 begin
  insert into public.organization_project_notes(project_id) values(current_setting('test.guest_project')::uuid);
  raise exception 'Review assignment granted general mutation rights';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
delete from public.fiscal_project_reviewers where user_id='10000000-0000-0000-0000-000000000002';
set local role authenticated;
do $$ begin
 if (select count(*) from storage.objects)<>1 then raise exception 'Storage assignment revocation ineffective'; end if;
end $$;
reset role;
rollback;
