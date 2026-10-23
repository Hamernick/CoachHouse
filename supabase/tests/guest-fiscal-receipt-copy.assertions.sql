-- Earlier revocation assertions intentionally remove this reviewer.
insert into public.platform_staff_members(user_id,access_level)
 values('10000000-0000-0000-0000-000000000002','coach') on conflict do nothing;
do $$
declare payload jsonb; result jsonb; receipt public.fiscal_guest_email_outbox%rowtype;
 job jsonb; proof jsonb; original text:=repeat('9',64); phone text:=repeat('8',64);
begin
 if has_function_privilege('anon','public.claim_fiscal_guest_emails_v3()','execute')
  or has_function_privilege('authenticated','public.claim_fiscal_guest_emails_v3()','execute')
  or has_column_privilege('anon','public.fiscal_guest_email_outbox','receipt_snapshot','select') then
  raise exception 'Private receipt access widened';
 end if;
 if exists(select 1 from public.fiscal_guest_submissions s where not exists(
  select 1 from public.fiscal_guest_verified_sessions v where v.submission_id=s.id
   and v.key_hash=s.submission_key_hash and v.expires_at>now())) then
  raise exception 'Existing phone confirmation did not recover original browser';
 end if;
 update public.fiscal_guest_email_outbox set status='failed';
 select jsonb_object_agg(key,value) into payload from jsonb_each((select to_jsonb(a)
  from public.fiscal_sponsorship_applications a order by created_at limit 1))
  where key=any(public.fiscal_guest_editable_fields());
 payload:=payload||'{"primary_email":"receipt-copy@example.test","project_name":"Receipt copy","project_description":"Original_submitted_answer","fundraising_goal":{"amountCents":12345,"period":"monthly"}}';
 result:=public.submit_guest_fiscal_application(original,payload);
 select * into receipt from public.fiscal_guest_email_outbox
  where submission_id=(result->>'submissionId')::uuid and kind='applicant_receipt';
 if receipt.receipt_snapshot->>'project_description'<>'Original_submitted_answer'
  or receipt.receipt_snapshot->'fundraising_goal'<>payload->'fundraising_goal'
  or exists(select 1 from jsonb_object_keys(receipt.receipt_snapshot) k
   where k<>all(public.fiscal_guest_editable_fields()) and k<>'fundraising_goal') then
  raise exception 'Receipt copy lost answers or included private fields';
 end if;
 update public.fiscal_sponsorship_applications set project_description='Changed later'
  where id=(result->>'applicationId')::uuid;
 begin
  update public.fiscal_guest_email_outbox set receipt_snapshot='{}' where id=receipt.id;
  raise exception 'Mutable receipt copy';
 exception when raise_exception then
  if sqlerrm<>'Receipt snapshot is immutable' then raise; end if;
 end;
 if exists(select 1 from jsonb_array_elements(public.claim_fiscal_guest_emails()) j
  where j->>'id'=receipt.id::text) then raise exception 'Old worker claimed new receipt'; end if;
 select j into job from jsonb_array_elements(public.claim_fiscal_guest_emails_v3()) j where j->>'id'=receipt.id::text;
 if job is null or job->'receiptSnapshot'->>'project_description'<>'Original_submitted_answer' then
  raise exception 'New worker did not receive frozen submission';
 end if;
 proof:=public.prepare_fiscal_guest_email_proof(receipt.id,(job->>'leaseToken')::uuid,repeat('a',64),repeat('6',64),now()+interval '1 day');
 if public.fiscal_guest_application_access((result->>'submissionId')::uuid,original) then raise exception 'Unverified original browser accepted'; end if;
 perform public.verify_fiscal_guest_email(repeat('6',64),phone,now()+interval '1 day');
 if not public.fiscal_guest_application_access((result->>'submissionId')::uuid,original)
  or not public.fiscal_guest_application_access((result->>'submissionId')::uuid,phone)
  or public.fiscal_guest_application_access((result->>'submissionId')::uuid,repeat('7',64)) then
  raise exception 'Cross-device verification granted wrong browser';
 end if;
 if public.verify_fiscal_guest_email(repeat('6',64),repeat('7',64),now()+interval '1 day') is not null then raise exception 'Unrelated proof replay accepted'; end if;
 update public.fiscal_guest_verified_sessions set expires_at=now()-interval '1 second'
  where submission_id=(result->>'submissionId')::uuid and key_hash=original;
 perform public.verify_fiscal_guest_email(repeat('6',64),phone,now()+interval '1 day');
 if public.fiscal_guest_application_access((result->>'submissionId')::uuid,original) then raise exception 'Revoked original grant renewed'; end if;
end $$;
