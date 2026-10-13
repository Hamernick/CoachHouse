begin;
do $$ begin
 if has_function_privilege('anon','public.claim_fiscal_guest_emails()','execute')
 or has_function_privilege('authenticated','public.get_fiscal_guest_receipt(text)','execute')
 or has_function_privilege('authenticated','public.consume_fiscal_guest_limit(text,integer,integer)','execute')
 or has_table_privilege('authenticated','public.fiscal_guest_request_limits','select') then
  raise exception 'Guest delivery/risk records exposed';
 end if;
end $$;
set local role service_role;
do $$ declare jobs jsonb; first_job jsonb; second_jobs jsonb; begin
 jobs:=public.claim_fiscal_guest_emails();
 if jsonb_array_length(jobs)<>3 then raise exception 'Expected bounded guest delivery batch'; end if;
 first_job:=jobs->0;
 if public.finish_fiscal_guest_email((first_job->>'id')::uuid,gen_random_uuid(),'forged',true) then raise exception 'Stale lease accepted'; end if;
 if not public.finish_fiscal_guest_email((first_job->>'id')::uuid,(first_job->>'leaseToken')::uuid,'sent-id',true) then raise exception 'Valid lease rejected'; end if;
 second_jobs:=public.claim_fiscal_guest_emails();
 if jsonb_array_length(second_jobs)<>1 then raise exception 'Active leases were reclaimed'; end if;
 if public.finish_fiscal_guest_email((first_job->>'id')::uuid,(first_job->>'leaseToken')::uuid,'duplicate',true) then raise exception 'Repeated ack accepted'; end if;
 if public.get_fiscal_guest_receipt(repeat('a',64))->>'submissionId' is null
 or public.get_fiscal_guest_receipt(repeat('f',64)) is not null then raise exception 'Receipt capability mismatch'; end if;
 if not public.consume_fiscal_guest_limit(repeat('a',64),2,60)
 or not public.consume_fiscal_guest_limit(repeat('a',64),2,60)
 or public.consume_fiscal_guest_limit(repeat('a',64),2,60) then raise exception 'Rate limit boundary wrong'; end if;
end $$;
reset role;
update public.fiscal_guest_request_limits set expires_at=now()-interval '1 second';
set local role service_role;
do $$ begin
 if not public.consume_fiscal_guest_limit(repeat('a',64),2,60) then raise exception 'Expired rate bucket did not reset'; end if;
end $$;
reset role;
update public.fiscal_guest_email_outbox set leased_until=now()-interval '1 second' where status='sending';
set local role service_role;
do $$ declare jobs jsonb; job jsonb; begin
 jobs:=public.claim_fiscal_guest_emails();
 if jsonb_array_length(jobs)<>3 then raise exception 'Expired jobs not re-leased'; end if;
 job:=jobs->0;
 if not public.finish_fiscal_guest_email((job->>'id')::uuid,(job->>'leaseToken')::uuid,null,false) then raise exception 'Failure not recorded'; end if;
 if jsonb_array_length(public.claim_fiscal_guest_emails())<>0 then raise exception 'Backoff ignored'; end if;
end $$;
reset role;
update public.fiscal_guest_email_outbox set first_attempt_at=now()-interval '24 hours',leased_until=now()-interval '1 second' where status<>'sent';
set local role service_role;
do $$ begin
 if public.claim_fiscal_guest_emails()<>'[]'::jsonb then raise exception 'Retried outside provider idempotency window'; end if;
end $$;
reset role;
-- A revoked assignment must stop unsent reviewer notices.
update public.fiscal_guest_email_outbox set status='pending',attempts=0,first_attempt_at=null,leased_until=null,available_at=now();
delete from public.fiscal_project_reviewers where user_id='10000000-0000-0000-0000-000000000003';
set local role service_role;
do $$ declare jobs jsonb; begin
 jobs:=public.claim_fiscal_guest_emails();
 if exists(select 1 from jsonb_array_elements(jobs) item where item->>'kind'='reviewer_notification') then raise exception 'Revoked reviewer notified'; end if;
end $$;
rollback;
