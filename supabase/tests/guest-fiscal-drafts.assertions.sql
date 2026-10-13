begin;
do $$ begin
  if has_table_privilege('anon','public.fiscal_guest_drafts','select')
    or has_table_privilege('authenticated','public.fiscal_guest_drafts','insert')
    or has_function_privilege('anon','public.read_fiscal_guest_draft(text,timestamptz)','execute')
    or has_function_privilege('authenticated','public.save_fiscal_guest_draft(text,timestamptz,integer,uuid,jsonb)','execute')
    or has_function_privilege('authenticated','public.purge_expired_fiscal_guest_drafts()','execute')
    or not (select relrowsecurity from pg_class where oid='public.fiscal_guest_drafts'::regclass) then
    raise exception 'Private drafts exposed';
  end if;
end $$;
set local role service_role;
do $$ declare
  key text := repeat('b',64); expiry timestamptz := now()+interval '6 days';
  request_id uuid := gen_random_uuid(); result jsonb; receipt jsonb;
begin
  result := public.read_fiscal_guest_draft(key,expiry);
  if result->>'version' <> '0' or result->'draft' <> '{}'::jsonb then raise exception 'Missing draft not empty'; end if;
  result := public.save_fiscal_guest_draft(key,expiry,0,request_id,'{"primaryEmail":"unfinished@","fundraisingGoalDollars":"1,","projectName":"  Keep spaces  "}');
  if result->>'version' <> '1' or result->'draft'->>'projectName' <> '  Keep spaces  ' then raise exception 'Unfinished draft altered'; end if;
  if public.save_fiscal_guest_draft(key,expiry,0,request_id,result->'draft') <> result then raise exception 'Lost acknowledgement retry duplicated'; end if;
  if public.save_fiscal_guest_draft(key,expiry,1,request_id,'{}')->>'state' <> 'conflict' then raise exception 'Reused write ID accepted changed payload'; end if;
  if public.save_fiscal_guest_draft(key,expiry,0,gen_random_uuid(),'{}')->>'state' <> 'conflict' then raise exception 'Stale tab overwrote draft'; end if;
  if public.read_fiscal_guest_draft(repeat('c',64),expiry)->'draft' <> '{}'::jsonb then raise exception 'Another session can read draft'; end if;
  if public.read_fiscal_guest_draft(key,expiry+interval '1 hour')->>'state' <> 'expired' then raise exception 'Extended draft lifetime'; end if;
  if public.read_fiscal_guest_draft(key,now()-interval '1 second')->>'state' <> 'expired' then raise exception 'Expired session allowed'; end if;
  begin
    perform public.save_fiscal_guest_draft(key,expiry,1,gen_random_uuid(),'{"orgId":"forged"}');
    raise exception 'Expected draft field denial';
  exception when raise_exception then if sqlerrm <> 'Invalid draft fields' then raise; end if; end;
  begin
    perform public.save_fiscal_guest_draft(key,expiry,1,gen_random_uuid(),'{"projectName":{"nested":"bad"}}');
    raise exception 'Expected nested value denial';
  exception when raise_exception then if sqlerrm <> 'Invalid draft fields' then raise; end if; end;
  result := public.save_fiscal_guest_draft(key,expiry,1,gen_random_uuid(),'{"projectName":"Next revision"}');
  if result->>'version' <> '2' then raise exception 'Valid revision not saved'; end if;
  -- Real submission discards the private draft in the same transaction.
  receipt := public.submit_guest_fiscal_application(key,
    '{"applicant_first_name":"Test","applicant_last_name":"Applicant","primary_email":"draft@example.test","project_name":"Draft handoff","mailing_street_address":"1 Test St","mailing_city":"Chicago","mailing_state":"IL","mailing_postal_code":"60601","legal_entity_type":"individual","project_description":"Grow food","public_benefit":"Fresh food","prospective_funding_sources":"Donations","estimated_budget_cents":100000,"operates_outside_united_states":false,"engages_in_lobbying":false,"fundraising_goal":{"amountCents":100000,"period":"monthly"}}');
  if exists(select 1 from public.fiscal_guest_drafts where key_hash=key) then raise exception 'Submitted draft retained'; end if;
  result := public.save_fiscal_guest_draft(key,expiry,2,gen_random_uuid(),'{"projectName":"Too late"}');
  if result->>'state' <> 'submitted' or result->>'reference' <> receipt->>'submissionId' then raise exception 'Draft changed after handoff'; end if;
  if result ? 'projectId' or result ? 'applicationId' or result ? 'draft' then raise exception 'Internal details in submitted response'; end if;
end $$;
reset role;
insert into public.fiscal_guest_drafts(key_hash,answers,version,last_request_id,expires_at)
  select lpad(to_hex(n),64,'0'),'{}',1,gen_random_uuid(),now()-interval '1 day' from generate_series(1,501) n;
insert into public.fiscal_guest_drafts values(repeat('f',64),'{}',1,gen_random_uuid(),now()+interval '1 day',now());
set local role service_role;
do $$ begin
  if public.purge_expired_fiscal_guest_drafts() <> 500 then raise exception 'Cleanup is not bounded'; end if;
  if public.purge_expired_fiscal_guest_drafts() <> 1 then raise exception 'Cleanup did not finish'; end if;
  if (select count(*) from public.fiscal_guest_drafts) <> 1 then raise exception 'Live draft removed'; end if;
end $$;
rollback;
