begin;
do $$ begin
 if has_table_privilege('anon','public.fiscal_guest_email_proofs','select')
 or has_table_privilege('authenticated','public.fiscal_guest_verified_sessions','select')
 or has_function_privilege('authenticated','public.verify_fiscal_guest_email(text,text,timestamptz)','execute')
 or has_function_privilege('anon','public.prepare_fiscal_guest_email_proof(uuid,uuid,text,text,timestamptz)','execute') then
 raise exception 'Email proof material exposed'; end if;
end $$;
set local role service_role;
do $$ declare jobs jsonb; job jsonb; proof jsonb; again jsonb; result jsonb; verified_at timestamptz; begin
 jobs := public.claim_fiscal_guest_emails();
 select item into job from jsonb_array_elements(jobs) item where item->>'kind'='applicant_receipt' limit 1;
 if job is null then raise exception 'Missing applicant receipt fixture'; end if;
 begin
  perform public.prepare_fiscal_guest_email_proof((job->>'id')::uuid,gen_random_uuid(),repeat('a',64),repeat('b',64),now()+interval '6 days');
  raise exception 'Accepted stale lease';
 exception when raise_exception then if sqlerrm<>'Inactive receipt lease' then raise; end if; end;
 proof:=public.prepare_fiscal_guest_email_proof((job->>'id')::uuid,(job->>'leaseToken')::uuid,repeat('a',64),repeat('b',64),now()+interval '6 days');
 again:=public.prepare_fiscal_guest_email_proof((job->>'id')::uuid,(job->>'leaseToken')::uuid,repeat('c',64),repeat('d',64),now()+interval '5 days');
 if proof<>again then raise exception 'Receipt retry changed its verification link'; end if;
 if exists(select 1 from public.fiscal_guest_submissions where id=(job->>'submissionId')::uuid and email_verified_at is not null) then raise exception 'Preparing mail verified the applicant'; end if;
 if public.verify_fiscal_guest_email(repeat('f',64),repeat('c',64),now()+interval '1 day') is not null then raise exception 'Forged token accepted'; end if;
 result:=public.verify_fiscal_guest_email(repeat('b',64),repeat('c',64),now()+interval '1 day');
 if result->>'reference'<>job->>'submissionId' or result ? 'projectId' then raise exception 'Wrong proof response'; end if;
 select email_verified_at into verified_at from public.fiscal_guest_submissions where id=(job->>'submissionId')::uuid;
 if verified_at is null then raise exception 'Email proof not recorded'; end if;
 if public.verify_fiscal_guest_email(repeat('b',64),repeat('c',64),now()+interval '2 days')<>result then raise exception 'Same browser could not recover lost ack'; end if;
 if public.verify_fiscal_guest_email(repeat('b',64),repeat('d',64),now()+interval '1 day') is not null then raise exception 'Other browser replay accepted'; end if;
 if exists(select 1 from public.fiscal_guest_submissions where claimed_user_id is not null or claimed_org_id is not null) then raise exception 'Verification silently claimed an account'; end if;
 if (select expires_at from public.fiscal_guest_verified_sessions where key_hash=repeat('c',64))<>now()+interval '1 day' then raise exception 'Replay extended session'; end if;
 update public.fiscal_guest_email_proofs set expires_at=now()-interval '1 second';
 if public.verify_fiscal_guest_email(repeat('b',64),repeat('c',64),now()+interval '1 day') is not null then raise exception 'Expired proof accepted'; end if;
 update public.fiscal_guest_verified_sessions set expires_at=now()-interval '1 second';
 if public.purge_expired_fiscal_guest_proofs()<>2 then raise exception 'Expired proof/session not cleaned'; end if;
end $$;
rollback;
