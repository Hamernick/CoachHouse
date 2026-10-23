begin;
do $$ declare payload jsonb; result jsonb; repeated jsonb; task uuid; job uuid; claimed jsonb; begin
 if exists(select 1 from public.fiscal_guest_email_outbox where cardinality(cc_recipients)>0 or cardinality(to_recipients)>0 or template_version<>1 or message_snapshot is not null)
  or exists(select 1 from public.organization_tasks t join public.fiscal_guest_submissions s on s.id=t.id) then
  raise exception 'Historical jobs/tasks were changed';
 end if;
 if has_function_privilege('authenticated','public.update_fiscal_review_task_status(uuid,uuid,text)','execute')
  or has_function_privilege('anon','public.list_fiscal_review_tasks(uuid)','execute')
  or has_function_privilege('authenticated','public.claim_fiscal_guest_emails_v4()','execute')
  or has_function_privilege('authenticated','public.fiscal_guest_email_send_allowed(uuid,uuid)','execute')
  or has_function_privilege('anon','public.fiscal_staff_email_send_allowed(uuid,uuid)','execute') then
  raise exception 'Private fiscal task/mail RPC exposed';
 end if;
 select jsonb_object_agg(key,value) into payload from jsonb_each((select to_jsonb(a) from public.fiscal_sponsorship_applications a limit 1))
  where key=any(public.fiscal_guest_editable_fields());
 payload:=payload||'{"primary_email":"team-task@example.test","project_name":"Team application","fundraising_goal":{"amountCents":12345,"period":"monthly"}}';
 result:=public.submit_guest_fiscal_application(repeat('c',64),payload);
 repeated:=public.submit_guest_fiscal_application(repeat('c',64),payload);
 if result->>'submissionId' is distinct from repeated->>'submissionId' then raise exception 'Retry created another application'; end if;
 task:=(result->>'submissionId')::uuid;
 perform set_config('test.review_task',task::text,true);
 perform set_config('test.review_project',result->>'projectId',true);
 if (select count(*) from public.organization_tasks where id=task)<>1
  or (select count(*) from public.organization_task_assignees where task_id=task)<>3
  or (select count(*) from public.fiscal_project_reviewers where project_id=(result->>'projectId')::uuid)<>3 then
  raise exception 'Shared task/team assignment not atomic or duplicated';
 end if;
 if (select count(*) from public.notifications where metadata->>'projectId'=result->>'projectId')<>3 then raise exception 'Initial team notifications incomplete'; end if;
 if not exists(select 1 from public.fiscal_guest_email_outbox where submission_id=task and kind='reviewer_notification' and recipient='joel@coachhousesolutions.org' and cc_recipients=array['caleb@bandto.com'] and to_recipients=array['joel@coachhousesolutions.org','fs@coachhousesolutions.org'] and template_version=2)
  or not exists(select 1 from public.fiscal_guest_email_outbox where submission_id=task and kind='applicant_receipt' and cardinality(cc_recipients)=0 and cardinality(to_recipients)=0 and template_version=2) then
  raise exception 'CC missing or applicant proof copied to staff';
 end if;
 select id into job from public.fiscal_guest_email_outbox where submission_id=task and kind='reviewer_notification';
 begin
  update public.fiscal_guest_email_outbox set cc_recipients='{}' where id=job;
  raise exception 'CC mutated';
 exception when raise_exception then if sqlerrm<>'Fiscal CC recipients are immutable' then raise; end if; end;
 perform public.claim_fiscal_guest_emails_v3();
 perform public.claim_fiscal_guest_emails();
 if exists(select 1 from public.fiscal_guest_email_outbox where submission_id=task and status<>'pending') then
  raise exception 'Old worker claimed new applicant or reviewer payload';
 end if;
 if exists(select 1 from public.fiscal_staff_email_outbox where project_id=(result->>'projectId')::uuid and event_type='application_submitted') then
  raise exception 'Guest application created duplicate staff digest/Caleb copy';
 end if;
 -- Isolate the new job from previous fixture jobs and prove its frozen payload.
 update public.fiscal_guest_email_outbox set status='failed' where id<>job;
 perform set_config('role','service_role',true);
 select x into claimed from jsonb_array_elements(public.claim_fiscal_guest_emails_v4()) x where x->>'id'=job::text;
 if claimed->'reviewSnapshot'->>'project_name' is distinct from 'Team application' or claimed->'reviewSnapshot'->'fundraising_goal'->>'amountCents' is distinct from '12345' then raise exception 'Digest lost submitted answers'; end if;
 if claimed->'reviewSnapshot' ? 'review_notes' or claimed->'reviewSnapshot' ? 'mailing_street_address' then raise exception 'Digest leaked unselected fields'; end if;
 if claimed->'ccRecipients' is distinct from '["caleb@bandto.com"]'::jsonb
  or claimed->'toRecipients' is distinct from '["joel@coachhousesolutions.org","fs@coachhousesolutions.org"]'::jsonb
  or claimed->>'templateVersion' is distinct from '2' then raise exception 'Worker lost immutable envelope'; end if;
 perform set_config('test.review_mail_id',job::text,true);
 perform set_config('test.review_mail_lease',claimed->>'leaseToken',true);
 perform set_config('test.review_mail_snapshot',(claimed-'leaseToken')::text,true);
 if public.fiscal_guest_email_send_allowed(job,(claimed->>'leaseToken')::uuid) is distinct from true
  or public.fiscal_guest_email_send_allowed(job,gen_random_uuid()) is distinct from false then raise exception 'Guest pre-send lease check failed'; end if;
end $$;
set local role service_role;
do $$ declare uid uuid; tasks jsonb; result jsonb; tid uuid:=current_setting('test.review_task')::uuid; begin
 foreach uid in array array['10000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000099']::uuid[] loop
  tasks:=public.list_fiscal_review_tasks(uid);
  if jsonb_array_length(tasks)<>1 or tasks->0->>'id'<>tid::text or jsonb_array_length(tasks->0->'reviewers')<>3 then raise exception 'Assigned reviewer missing shared task'; end if;
  if tasks->0 ? 'org_id' or tasks->0 ? 'application' then raise exception 'Host/private answers exposed in task'; end if;
  result:=public.update_fiscal_review_task_status(tid,uid,'done');
  if result->>'ok'<>'true' then raise exception 'Assignee cannot complete shared task'; end if;
 end loop;
 if public.list_fiscal_review_tasks('10000000-0000-0000-0000-000000000001')<>'[]'::jsonb
  or public.update_fiscal_review_task_status(tid,'10000000-0000-0000-0000-000000000001','done')->>'ok'<>'false' then raise exception 'Unassigned staff can access task'; end if;
 if public.update_fiscal_review_task_status(gen_random_uuid(),'10000000-0000-0000-0000-000000000099','done') is not null then raise exception 'Ordinary task did not retain old path'; end if;
 if public.update_fiscal_review_task_status(tid,'10000000-0000-0000-0000-000000000099','invalid')->>'ok'<>'false' then raise exception 'Invalid task status accepted'; end if;
end $$;
reset role;
do $$ begin
 if (select count(*) from public.organization_task_assignees where task_id=current_setting('test.review_task')::uuid)<>3
  or (select status from public.fiscal_sponsorship_applications where project_id=current_setting('test.review_project')::uuid)<>'submitted' then
  raise exception 'Task completion altered reviewers/application approval';
 end if;
end $$;
-- An application edit cannot change a leased/retried message. Corrections create
-- exactly one new team envelope; the staff queue must not duplicate it.
do $$ declare claimed jsonb; app public.fiscal_sponsorship_applications%rowtype; job uuid:=current_setting('test.review_mail_id')::uuid; begin
 select a.* into app from public.fiscal_sponsorship_applications a where project_id=current_setting('test.review_project')::uuid;
 update public.fiscal_sponsorship_applications set project_name='Corrected name' where id=app.id;
 update public.fiscal_guest_email_outbox set leased_until=now()-interval '1 second' where id=job;
 perform set_config('role','service_role',true);
 if public.fiscal_guest_email_send_allowed(job,current_setting('test.review_mail_lease')::uuid) is distinct from false then raise exception 'Expired guest lease allowed'; end if;
 select x into claimed from jsonb_array_elements(public.claim_fiscal_guest_emails_v4()) x where x->>'id'=job::text;
 if (claimed-'leaseToken') is distinct from current_setting('test.review_mail_snapshot')::jsonb then raise exception 'Retry changed payload/envelope'; end if;
 perform set_config('test.review_mail_lease',claimed->>'leaseToken',true);
 perform set_config('role','none',true);
 begin
  update public.fiscal_guest_email_outbox set review_snapshot='{}' where id=job;
  raise exception 'Snapshot mutated';
 exception when raise_exception then if sqlerrm<>'Fiscal review snapshot is immutable' then raise; end if; end;
 begin
  update public.fiscal_guest_email_outbox set to_recipients='{}' where id=job;
  raise exception 'Recipients mutated';
 exception when raise_exception then if sqlerrm<>'Fiscal message envelope is immutable' then raise; end if; end;
 begin
  update public.fiscal_guest_email_outbox set message_snapshot='{}' where id=job;
  raise exception 'Message mutated';
 exception when raise_exception then if sqlerrm<>'Fiscal message envelope is immutable' then raise; end if; end;
 begin
  update public.fiscal_guest_email_outbox set template_version=1 where id=job;
  raise exception 'Version mutated';
 exception when raise_exception then if sqlerrm<>'Fiscal message envelope is immutable' then raise; end if; end;
 insert into public.fiscal_sponsorship_events(org_id,project_id,application_id,event_type,metadata)
  values(app.org_id,app.project_id,app.id,'application_submitted','{"previousStatus":"needs_info"}');
 if exists(select 1 from public.fiscal_staff_email_outbox where project_id=app.project_id and event_type='application_submitted') then raise exception 'Corrections created duplicate Caleb copy'; end if;
 if (select count(*) from public.fiscal_guest_email_outbox where submission_id=current_setting('test.review_task')::uuid and kind='reviewer_update'
  and review_snapshot->>'project_name'='Corrected name' and to_recipients=array['joel@coachhousesolutions.org','fs@coachhousesolutions.org'] and cc_recipients=array['caleb@bandto.com'])<>1 then raise exception 'Correction team snapshot missing'; end if;
 if (select count(*) from public.organization_tasks where id=current_setting('test.review_task')::uuid)<>1 then raise exception 'Correction duplicated task'; end if;
end $$;
-- Non-guest applications use the staff queue, but the same full review team.
do $$ declare app public.fiscal_sponsorship_applications%rowtype; project public.organization_projects%rowtype;
 pid uuid:=gen_random_uuid(); aid uuid:=gen_random_uuid(); eid uuid; milestone uuid; claimed jsonb; first_payload jsonb; saved_assignments jsonb; begin
 select a.* into app from public.fiscal_sponsorship_applications a where project_id=current_setting('test.review_project')::uuid;
 select p.* into project from public.organization_projects p where id=app.project_id;
 insert into public.organization_projects select (jsonb_populate_record(null::public.organization_projects,to_jsonb(project)||jsonb_build_object('id',pid,'name','Signed-in application'))).*;
 insert into public.fiscal_sponsorship_applications select (jsonb_populate_record(null::public.fiscal_sponsorship_applications,to_jsonb(app)||jsonb_build_object('id',aid,'project_id',pid,'project_name','Signed-in application'))).*;
 insert into public.fiscal_sponsorship_events(org_id,project_id,application_id,event_type,metadata)
  values(app.org_id,pid,aid,'application_submitted','{}') returning id into eid;
 insert into public.fiscal_sponsorship_events(org_id,project_id,application_id,event_type,metadata)
  values(app.org_id,pid,aid,'application_approved','{}') returning id into milestone;
 if not exists(select 1 from public.fiscal_staff_email_outbox where event_id=eid and template_version=2
  and to_recipients=array['joel@coachhousesolutions.org','fs@coachhousesolutions.org'] and cc_recipients=array['caleb@bandto.com']) then raise exception 'Non-guest application omitted review team'; end if;
 if not exists(select 1 from public.fiscal_staff_email_outbox where event_id=milestone and template_version=2 and to_recipients=array['fs@coachhousesolutions.org'] and cardinality(cc_recipients)=0) then raise exception 'Staff milestone recipients broadened'; end if;
 perform public.claim_fiscal_staff_emails();
 if exists(select 1 from public.fiscal_staff_email_outbox where event_id in(eid,milestone) and status<>'pending') then raise exception 'Old worker claimed new staff content'; end if;
 update public.fiscal_staff_email_outbox set status='failed' where event_id not in(eid,milestone);
 perform set_config('role','service_role',true);
 select x into claimed from jsonb_array_elements(public.claim_fiscal_staff_emails_v2()) x where x->>'event_id'=eid::text;
 first_payload:=claimed-'lease_token';
 if public.fiscal_staff_email_send_allowed(eid,(claimed->>'lease_token')::uuid) is distinct from true
  or public.fiscal_staff_email_send_allowed(eid,gen_random_uuid()) is distinct from false then raise exception 'Staff pre-send lease check failed'; end if;
 perform set_config('role','none',true);
 update public.fiscal_sponsorship_applications set project_name='Signed-in corrected' where id=aid;
 update public.fiscal_staff_email_outbox set leased_until=now()-interval '1 second' where event_id=eid;
 perform set_config('role','service_role',true);
 if public.fiscal_staff_email_send_allowed(eid,(claimed->>'lease_token')::uuid) is distinct from false then raise exception 'Expired staff lease allowed'; end if;
 select x into claimed from jsonb_array_elements(public.claim_fiscal_staff_emails_v2()) x where x->>'event_id'=eid::text;
 if (claimed-'lease_token') is distinct from first_payload then raise exception 'Staff retry changed frozen payload'; end if;
 perform set_config('role','none',true);
 select jsonb_agg(to_jsonb(r)) into saved_assignments from public.fiscal_project_reviewers r where user_id='10000000-0000-0000-0000-000000000002';
 delete from public.fiscal_project_reviewers where user_id='10000000-0000-0000-0000-000000000002';
 delete from public.platform_staff_members where user_id='10000000-0000-0000-0000-000000000002';
 perform set_config('role','service_role',true);
 if public.fiscal_staff_email_send_allowed(eid,(claimed->>'lease_token')::uuid) is distinct from false then raise exception 'Post-claim staff revocation did not prevent send'; end if;
 perform set_config('role','none',true);
 insert into public.platform_staff_members(user_id,access_level) values('10000000-0000-0000-0000-000000000002','coach');
 insert into public.fiscal_project_reviewers select * from jsonb_populate_recordset(null::public.fiscal_project_reviewers,saved_assignments);
 insert into public.fiscal_sponsorship_events(org_id,project_id,application_id,event_type,metadata)
  values(app.org_id,pid,aid,'application_submitted','{"previousStatus":"needs_info"}');
 if (select count(*) from public.fiscal_staff_email_outbox where project_id=pid and review_snapshot->>'project_name'='Signed-in corrected'
  and review_snapshot->>'corrections'='true' and to_recipients=array['joel@coachhousesolutions.org','fs@coachhousesolutions.org'] and cc_recipients=array['caleb@bandto.com'])<>1 then raise exception 'Non-guest correction missing full team/new answers'; end if;
end $$;
reset role;
delete from public.fiscal_project_reviewers where project_id=current_setting('test.review_project')::uuid and user_id='10000000-0000-0000-0000-000000000003';
set local role service_role;
do $$ begin
 if public.fiscal_guest_email_send_allowed(current_setting('test.review_mail_id')::uuid,current_setting('test.review_mail_lease')::uuid) is distinct from false then raise exception 'Post-claim reviewer revocation did not prevent send'; end if;
 perform public.claim_fiscal_guest_emails_v4();
 if exists(select 1 from public.fiscal_guest_email_outbox where submission_id=current_setting('test.review_task')::uuid and kind='reviewer_update' and status<>'failed') then raise exception 'Revoked reviewer digest not withheld'; end if;
 if public.list_fiscal_review_tasks('10000000-0000-0000-0000-000000000003')<>'[]'::jsonb
  or public.update_fiscal_review_task_status(current_setting('test.review_task')::uuid,'10000000-0000-0000-0000-000000000003','todo')->>'ok'<>'false' then raise exception 'Revoked reviewer retained task access'; end if;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',true);
do $$ declare affected integer; begin
 delete from public.organization_task_assignees where task_id=current_setting('test.review_task')::uuid;
 get diagnostics affected = row_count;
 if affected<>0 then raise exception 'Reviewer could remove shared assignments directly'; end if;
 update public.organization_task_assignees set user_id='10000000-0000-0000-0000-000000000001' where task_id=current_setting('test.review_task')::uuid;
 get diagnostics affected = row_count;
 if affected<>0 then raise exception 'Reviewer could replace shared assignments directly'; end if;
end $$;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
do $$ begin
 if exists(select 1 from public.organization_task_assignees where task_id=current_setting('test.review_task')::uuid) then raise exception 'Host can read private task assignments'; end if;
end $$;
reset role;
rollback;
