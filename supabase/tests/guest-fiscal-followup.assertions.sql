begin;
do $$ declare s public.fiscal_guest_submissions%rowtype; other_id uuid; state jsonb; payload jsonb;
 version text; req uuid:=gen_random_uuid(); n_projects integer; n_staff integer; n_guest integer; outcome jsonb;
begin
 if has_function_privilege('anon','public.read_fiscal_guest_application(uuid,text)','execute')
 or has_function_privilege('authenticated','public.resubmit_fiscal_guest_application(uuid,text,uuid,text,jsonb)','execute')
 or has_table_privilege('authenticated','public.fiscal_guest_application_revisions','select')
 then raise exception 'Applicant boundary exposed'; end if;
 select * into s from public.fiscal_guest_submissions order by created_at,id limit 1;
 select id into other_id from public.fiscal_guest_submissions where id<>s.id limit 1;
 if public.read_fiscal_guest_application(s.id,repeat('9',64)) is not null then raise exception 'Unverified read'; end if;
 update public.fiscal_guest_submissions set email_verified_at=now() where id=s.id;
 insert into public.fiscal_guest_verified_sessions values(repeat('9',64),s.id,now()+interval '1 day');
 if public.read_fiscal_guest_application(other_id,repeat('9',64)) is not null then raise exception 'Cross-application read'; end if;
 update public.fiscal_sponsorship_applications set status='submitted' where id=s.application_id;
 state:=public.read_fiscal_guest_application(s.id,repeat('9',64));
 if state->'application'<>'null'::jsonb or state ? 'org_id' then raise exception 'Excess status disclosure'; end if;
 update public.fiscal_sponsorship_applications set status='needs_info',review_notes='Explain funding sources.',
 project_duration_type='ongoing_multi_year',has_legal_compliance_financial_concerns=false where id=s.application_id;
 insert into public.fiscal_sponsorship_events(org_id,project_id,application_id,event_type,summary)
 select org_id,project_id,id,'application_needs_info','Updates requested' from public.fiscal_sponsorship_applications where id=s.application_id;
 if (select count(*) from public.fiscal_guest_email_outbox where submission_id=s.id and kind='applicant_update')<>1
 then raise exception 'Missing applicant review notification'; end if;
 state:=public.read_fiscal_guest_application(s.id,repeat('9',64));
 if state->>'reviewNote'<>'Explain funding sources.' or (state->'application') ? 'metadata'
 or (state->'application') ? 'reviewed_by' then raise exception 'Wrong applicant disclosure'; end if;
 version:=state->>'version'; payload:=state->'application'||'{"project_name":"Corrected garden","prospective_funding_sources":"Community donors"}';
 if public.resubmit_fiscal_guest_application(s.id,repeat('8',64),req,version,payload) is not null then raise exception 'Unverified write'; end if;
 if public.resubmit_fiscal_guest_application(s.id,repeat('9',64),req,repeat('0',32),payload)->>'state'<>'conflict' then raise exception 'Stale edit accepted'; end if;
 if public.resubmit_fiscal_guest_application(s.id,repeat('9',64),req,version,payload||'{"primary_email":"attacker@example.test"}')->>'state'<>'email_change' then raise exception 'Identity transfer'; end if;
 begin
  perform public.resubmit_fiscal_guest_application(s.id,repeat('9',64),req,version,payload||'{"status":"approved"}');
  raise exception 'Forged status accepted'; exception when invalid_parameter_value then null; end;
 begin
  perform public.resubmit_fiscal_guest_application(s.id,repeat('9',64),req,version,payload||'{"engages_in_lobbying":true,"concerns_explanation":null}');
  raise exception 'Missing explanation accepted'; exception when invalid_parameter_value then null; end;
 select count(*) into n_projects from public.organization_projects;
 select count(*) into n_staff from public.fiscal_staff_email_outbox;
 select count(*) into n_guest from public.fiscal_guest_email_outbox;
 outcome:=public.resubmit_fiscal_guest_application(s.id,repeat('9',64),req,version,payload);
 if outcome->>'state'<>'submitted' then raise exception 'Resubmit failed'; end if;
 if (select count(*) from public.organization_projects)<>n_projects
 or (select project_name from public.fiscal_sponsorship_applications where id=s.application_id)<>'Corrected garden'
 or (select status from public.fiscal_sponsorship_applications where id=s.application_id)<>'submitted'
 or (select count(*) from public.fiscal_staff_email_outbox)<>n_staff+1
 or (select count(*) from public.fiscal_guest_email_outbox)<>n_guest+2
 then raise exception 'Incorrect atomic resubmission/notifications'; end if;
 if (select previous_application->>'review_notes' from public.fiscal_guest_application_revisions where submission_id=s.id and request_id=req)<>'Explain funding sources.' then raise exception 'Lost prior review'; end if;
 -- A later review must survive a lost-ack retry, with no repeated events or emails.
 update public.fiscal_sponsorship_applications set status='approved' where id=s.application_id;
 if public.resubmit_fiscal_guest_application(s.id,repeat('9',64),req,version,payload)->>'state'<>'submitted'
 or (select status from public.fiscal_sponsorship_applications where id=s.application_id)<>'approved'
 or (select count(*) from public.fiscal_guest_email_outbox)<>n_guest+2 then raise exception 'Unsafe replay'; end if;
 if public.resubmit_fiscal_guest_application(s.id,repeat('9',64),req,version,payload||'{"project_name":"Overwrite"}')->>'state'<>'conflict'
 then raise exception 'Idempotency key reused with changed answers'; end if;
 if public.resubmit_fiscal_guest_application(s.id,repeat('9',64),gen_random_uuid(),version,payload)->>'state'<>'conflict' then raise exception 'Locked state edited'; end if;
 update public.fiscal_guest_verified_sessions set expires_at=now()-interval '1 second' where key_hash=repeat('9',64);
 if public.read_fiscal_guest_application(s.id,repeat('9',64)) is not null then raise exception 'Expired read'; end if;
end $$;
rollback;

-- Notification failure rolls back correction, history, event and application status together.
begin;
create function pg_temp.reject_followup_mail() returns trigger language plpgsql as $$ begin
 if new.kind='reviewer_update' then raise exception 'fixture mail failure'; end if; return new; end $$;
create trigger reject_followup_mail before insert on public.fiscal_guest_email_outbox for each row execute function pg_temp.reject_followup_mail();
do $$ declare s public.fiscal_guest_submissions%rowtype; state jsonb; before_count integer; begin
 select * into s from public.fiscal_guest_submissions order by created_at,id limit 1;
 update public.fiscal_guest_submissions set email_verified_at=now() where id=s.id;
 insert into public.fiscal_guest_verified_sessions values(repeat('9',64),s.id,now()+interval '1 day');
 update public.fiscal_sponsorship_applications set status='needs_info',project_duration_type='ongoing_multi_year',has_legal_compliance_financial_concerns=false where id=s.application_id;
 state:=public.read_fiscal_guest_application(s.id,repeat('9',64));
 select count(*) into before_count from public.fiscal_sponsorship_events;
 begin
  perform public.resubmit_fiscal_guest_application(s.id,repeat('9',64),gen_random_uuid(),state->>'version',state->'application');
  raise exception 'Expected fixture failure';
 exception when raise_exception then if sqlerrm<>'fixture mail failure' then raise; end if; end;
 if (select status from public.fiscal_sponsorship_applications where id=s.application_id)<>'needs_info'
 or exists(select 1 from public.fiscal_guest_application_revisions where submission_id=s.id)
 or (select count(*) from public.fiscal_sponsorship_events)<>before_count then raise exception 'Partial correction survived'; end if;
end $$;
rollback;

-- Follow-up links use the same frozen, lease-bound proof contract as receipts.
begin;
do $$ declare s public.fiscal_guest_submissions%rowtype; event uuid:=gen_random_uuid(); job uuid; lease uuid:=gen_random_uuid(); proof jsonb; again jsonb;
begin
 select * into s from public.fiscal_guest_submissions order by created_at,id limit 1;
 insert into public.fiscal_sponsorship_events(id,project_id,application_id,event_type)
 values(event,s.project_id,s.application_id,'application_needs_info');
 select id into job from public.fiscal_guest_email_outbox where event_id=event and kind='applicant_update';
 update public.fiscal_guest_email_outbox set status='sending',lease_token=lease,leased_until=now()+interval '5 minutes' where id=job;
 proof:=public.prepare_fiscal_guest_email_proof(job,lease,repeat('a',64),repeat('b',64),now()+interval '1 day');
 again:=public.prepare_fiscal_guest_email_proof(job,lease,repeat('c',64),repeat('d',64),now()+interval '2 days');
 if proof<>again then raise exception 'Follow-up retry changed its proof'; end if;
 begin
  perform public.prepare_fiscal_guest_email_proof(job,gen_random_uuid(),repeat('e',64),repeat('f',64),now()+interval '1 day');
  raise exception 'Accepted stale follow-up lease';
 exception when raise_exception then if sqlerrm<>'Inactive receipt lease' then raise; end if; end;
end $$;
rollback;
