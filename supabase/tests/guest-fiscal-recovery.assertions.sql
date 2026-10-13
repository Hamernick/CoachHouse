begin;
do $$
declare s public.fiscal_guest_submissions%rowtype; request_id uuid:=gen_random_uuid(); job public.fiscal_guest_email_outbox%rowtype;
 before_state jsonb; proof jsonb; again jsonb; verified jsonb; lease uuid:=gen_random_uuid(); initial_count integer;
begin
 if has_function_privilege('anon','public.request_fiscal_guest_recovery(uuid,text,uuid)','execute')
  or has_function_privilege('authenticated','public.request_fiscal_guest_recovery(uuid,text,uuid)','execute')
  or not has_function_privilege('service_role','public.request_fiscal_guest_recovery(uuid,text,uuid)','execute')
 then raise exception 'Recovery privilege leak'; end if;
 select * into s from public.fiscal_guest_submissions order by created_at,id limit 1;
 select to_jsonb(a) into before_state from public.fiscal_sponsorship_applications a where id=s.application_id;
 select count(*) into initial_count from public.fiscal_guest_email_outbox;
 perform public.request_fiscal_guest_recovery(gen_random_uuid(),s.contact_email,request_id);
 perform public.request_fiscal_guest_recovery(s.id,'wrong@example.test',request_id);
 perform public.request_fiscal_guest_recovery(s.id,s.contact_email,null);
 if (select count(*) from public.fiscal_guest_email_outbox)<>initial_count then raise exception 'Invalid request queued mail'; end if;
 perform public.request_fiscal_guest_recovery(s.id,upper(s.contact_email),request_id);
 perform public.request_fiscal_guest_recovery(s.id,s.contact_email,request_id);
 perform public.request_fiscal_guest_recovery(s.id,s.contact_email,gen_random_uuid());
 if (select count(*) from public.fiscal_guest_email_outbox)<>initial_count+1 then raise exception 'Recovery not idempotent or cooldown missing'; end if;
 select * into job from public.fiscal_guest_email_outbox where submission_id=s.id and kind='applicant_recovery';
 if job.recipient<>s.contact_email or job.event_id is not null then raise exception 'Recovery misdirected'; end if;
 if (select to_jsonb(a) from public.fiscal_sponsorship_applications a where id=s.application_id)<>before_state
 or (select to_jsonb(t) from public.fiscal_guest_submissions t where id=s.id)<>to_jsonb(s)
 then raise exception 'Recovery changed application or identity'; end if;

 -- A later explicit request can get a fresh link; the original id stays idempotent forever.
 update public.fiscal_guest_email_outbox set created_at=now()-interval '11 minutes' where id=job.id;
 perform public.request_fiscal_guest_recovery(s.id,s.contact_email,request_id);
 if (select count(*) from public.fiscal_guest_email_outbox)<>initial_count+1 then raise exception 'Old key replayed'; end if;
 perform public.request_fiscal_guest_recovery(s.id,s.contact_email,gen_random_uuid());
 if (select count(*) from public.fiscal_guest_email_outbox)<>initial_count+2 then raise exception 'New recovery blocked after cooldown'; end if;

 update public.fiscal_guest_email_outbox set status='sending',lease_token=lease,leased_until=now()+interval '5 minutes' where id=job.id;
 proof:=public.prepare_fiscal_guest_email_proof(job.id,lease,repeat('e',64),repeat('d',64),now()+interval '1 day');
 again:=public.prepare_fiscal_guest_email_proof(job.id,lease,repeat('f',64),repeat('c',64),now()+interval '2 days');
 if proof<>again then raise exception 'Recovery retry changed link'; end if;
 -- Preparing/sending a link does not verify it or grant a session.
 if exists(select 1 from public.fiscal_guest_verified_sessions where key_hash=repeat('e',64)) then raise exception 'Recovery granted access without proof'; end if;
 verified:=public.verify_fiscal_guest_email(repeat('d',64),repeat('e',64),now()+interval '1 day');
 if verified->>'reference'<>s.id::text then raise exception 'Fresh browser cannot recover'; end if;
 if public.read_fiscal_guest_application(s.id,repeat('e',64)) is null then raise exception 'Recovered status unavailable'; end if;
 if public.verify_fiscal_guest_email(repeat('d',64),repeat('f',64),now()+interval '1 day') is not null then raise exception 'Recovery proof replayed in another browser'; end if;
 if (select claimed_user_id from public.fiscal_guest_submissions where id=s.id) is distinct from s.claimed_user_id then raise exception 'Recovery claimed an account'; end if;
end $$;
rollback;
