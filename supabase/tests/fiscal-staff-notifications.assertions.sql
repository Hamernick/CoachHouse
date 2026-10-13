do $$ begin
 if has_table_privilege('anon','public.fiscal_staff_email_outbox','select')
   or has_table_privilege('authenticated','public.fiscal_staff_email_outbox','update')
   or has_function_privilege('authenticated','public.claim_fiscal_staff_emails()','execute')
   or has_function_privilege('anon','public.finish_fiscal_staff_email(uuid,uuid,text,boolean)','execute') then
   raise exception 'Staff notification queue exposed';
 end if;
 if (select count(*) from public.fiscal_staff_email_outbox) <> (select count(*) from public.fiscal_sponsorship_events) then
   raise exception 'Workflow event missing its notification';
 end if;
end $$;
-- No new queue rows survive a failed workflow transaction.
do $$ declare old_count integer; begin
 select count(*) into old_count from public.fiscal_staff_email_outbox;
 begin
   insert into public.fiscal_sponsorship_events(project_id,event_type)
     select id,'document_connected' from public.organization_projects limit 1;
   raise exception 'test rollback';
 exception when raise_exception then null; end;
 if (select count(*) from public.fiscal_staff_email_outbox) <> old_count then raise exception 'Orphan notification'; end if;
end $$;
set role service_role;
do $$ declare jobs jsonb; retry jsonb; job jsonb; begin
 jobs := public.claim_fiscal_staff_emails();
 if jsonb_array_length(jobs) <> 2 then raise exception 'Expected one job per submitted application'; end if;
 if public.claim_fiscal_staff_emails() <> '[]' then raise exception 'Leased jobs claimed twice'; end if;
 job := jobs->0;
 if public.finish_fiscal_staff_email((job->>'event_id')::uuid,gen_random_uuid(),null,true) then raise exception 'Accepted wrong lease'; end if;
 if not public.finish_fiscal_staff_email((job->>'event_id')::uuid,(job->>'lease_token')::uuid,null,false) then raise exception 'Failed job not recorded'; end if;
 if public.claim_fiscal_staff_emails() <> '[]' then raise exception 'Ignored retry backoff'; end if;
 update public.fiscal_staff_email_outbox set available_at=now() where event_id=(job->>'event_id')::uuid;
 retry:=public.claim_fiscal_staff_emails()->0;
 if retry->>'lease_token'=job->>'lease_token' then raise exception 'Lease not rotated'; end if;
 if public.finish_fiscal_staff_email((job->>'event_id')::uuid,(job->>'lease_token')::uuid,'stale',true) then raise exception 'Stale worker completed job'; end if;
 if not public.finish_fiscal_staff_email((retry->>'event_id')::uuid,(retry->>'lease_token')::uuid,'provider-id',true) then raise exception 'Success not recorded'; end if;
 if public.claim_fiscal_staff_emails() <> '[]' then raise exception 'Sent job retried'; end if;
 -- An ambiguous old provider attempt stops before provider idempotency expires.
 update public.fiscal_staff_email_outbox set first_attempt_at=now()-interval '24 hours',leased_until=now()-interval '1 minute' where status='sending';
 if public.claim_fiscal_staff_emails() <> '[]' then raise exception 'Expired idempotency window retried'; end if;
 if not exists(select 1 from public.fiscal_staff_email_outbox where status='failed') then raise exception 'Failure not retained'; end if;
end $$;
reset role;
