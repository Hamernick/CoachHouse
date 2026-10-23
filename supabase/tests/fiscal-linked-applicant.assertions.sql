begin;
do $$ begin
  if has_function_privilege('anon','public.list_linked_fiscal_applications()','execute')
    or has_function_privilege('anon','public.read_linked_fiscal_application(uuid)','execute')
    or has_function_privilege('anon','public.resubmit_linked_fiscal_application(uuid,uuid,text,jsonb)','execute')
    or has_function_privilege('authenticated','public.read_fiscal_guest_application(uuid,text)','execute')
    or has_function_privilege('authenticated','public.fiscal_linked_applicant_access(uuid)','execute')
    or has_table_privilege('authenticated','public.fiscal_guest_submissions','select') then
    raise exception 'Linked applicant boundary exposed';
  end if;
end $$;

do $$ declare s public.fiscal_guest_submissions%rowtype; preview jsonb;
  actor uuid := '80000000-0000-4000-8000-000000000001';
begin
  select * into strict s from public.fiscal_guest_submissions order by created_at,id limit 1;
  insert into public.profiles values(actor,s.contact_email);
  insert into auth.users values(actor,s.contact_email,now()),
    ('80000000-0000-4000-8000-000000000002',s.contact_email,now());
  update public.fiscal_guest_submissions set email_verified_at=now() where id=s.id;
  insert into public.fiscal_guest_verified_sessions values(repeat('9',64),s.id,now()+interval '1 day');
  preview:=public.preview_fiscal_guest_profile(s.id,repeat('9',64),actor);
  if public.save_fiscal_guest_profile(s.id,repeat('9',64),actor,gen_random_uuid(),preview->>'version','{}')->>'state'<>'linked'
    then raise exception 'Fixture claim failed'; end if;
  update public.fiscal_guest_verified_sessions set expires_at=now()-interval '1 day' where submission_id=s.id;
  update public.fiscal_sponsorship_applications set status='needs_info',review_notes='Clarify the budget.' where id=s.application_id;
end $$;

set local role authenticated;
do $$ begin
  if public.list_linked_fiscal_applications()<>'[]'::jsonb then raise exception 'Anonymous identity discovered data'; end if;
end $$;
select set_config('request.jwt.claim.sub','80000000-0000-4000-8000-000000000001',true);
do $$ declare listed jsonb; state jsonb; reference uuid; version text; request_id uuid:=gen_random_uuid(); payload jsonb;
begin
  listed:=public.list_linked_fiscal_applications();
  if jsonb_array_length(listed)<>1 or (select count(*) from jsonb_object_keys(listed->0))<>4
    then raise exception 'Unsafe account discovery'; end if;
  reference:=(listed->0->>'reference')::uuid;
  state:=public.read_linked_fiscal_application(reference);
  if state->>'status'<>'needs_info' or state->>'reviewNote'<>'Clarify the budget.'
    then raise exception 'Expired guest scope blocked linked owner'; end if;
  version:=state->>'version';
  payload:=state->'application'||jsonb_build_object(
    'project_name','Account corrections','project_duration_type','ongoing_multi_year',
    'has_legal_compliance_financial_concerns',false,'phone_number','',
    'focus_area','','project_location','Chicago','formation_status','',
    'temporary_start_date',null,'temporary_end_date',null,'expense_summary','',
    'leadership_background','','initiative_history','','concerns_explanation','',
    'mailing_street_address_2','','estimated_budget_cents',100000,
    'fundraising_goal',jsonb_build_object('amountCents',100000,'period','monthly'));
  if public.resubmit_linked_fiscal_application(reference,request_id,version,payload)->>'state'<>'submitted'
    then raise exception 'Linked correction failed'; end if;
  if public.resubmit_linked_fiscal_application(reference,request_id,version,payload)->>'state'<>'submitted'
    then raise exception 'Linked retry failed'; end if;
  if public.resubmit_linked_fiscal_application(reference,request_id,version,payload||'{"project_name":"Different retry"}')->>'state'<>'conflict'
    then raise exception 'Changed retry accepted'; end if;
  if public.read_linked_fiscal_application(gen_random_uuid()) is not null then raise exception 'Unknown reference exposed'; end if;
end $$;

-- Another confirmed account with the same email has never explicitly claimed it.
select set_config('request.jwt.claim.sub','80000000-0000-4000-8000-000000000002',true);
do $$ begin
  if public.list_linked_fiscal_applications()<>'[]'::jsonb then raise exception 'Email alone discovered an application'; end if;
end $$;
reset role;

do $$ declare s public.fiscal_guest_submissions%rowtype; owner_id uuid; original_org uuid;
begin
  select * into strict s from public.fiscal_guest_submissions where claimed_user_id='80000000-0000-4000-8000-000000000001';
  select org_id into original_org from public.fiscal_sponsorship_applications where id=s.application_id;
  if original_org=s.claimed_org_id or (select org_id from public.organization_projects where id=s.project_id)<>original_org
    or (select is_public from public.organizations where user_id=s.claimed_org_id) then raise exception 'Claim transferred or published staff data'; end if;
  if (select count(*) from public.fiscal_guest_application_revisions where submission_id=s.id)<>1
    then raise exception 'Account correction duplicated revision'; end if;
  -- Neither an unclaimed account nor the staff host receives applicant access.
  foreach owner_id in array array['80000000-0000-4000-8000-000000000002'::uuid,'10000000-0000-0000-0000-000000000001'::uuid] loop
    perform set_config('request.jwt.claim.sub',owner_id::text,true);
    if public.read_linked_fiscal_application(s.id) is not null
      or public.resubmit_linked_fiscal_application(s.id,gen_random_uuid(),repeat('a',32),'{}') is not null
      then raise exception 'Different account gained access'; end if;
  end loop;
  perform set_config('request.jwt.claim.sub',s.claimed_user_id::text,true);
  update auth.users set email_confirmed_at=null where id=s.claimed_user_id;
  if public.read_linked_fiscal_application(s.id) is not null then raise exception 'Unconfirmed account retained access'; end if;
  update auth.users set email_confirmed_at=now(),email='changed@example.test' where id=s.claimed_user_id;
  if public.list_linked_fiscal_applications()<>'[]'::jsonb then raise exception 'Changed account email retained access'; end if;
  update auth.users set email=s.contact_email where id=s.claimed_user_id;
  update public.fiscal_guest_submissions set email_verified_at=null,claimed_user_id=null,claimed_org_id=null,claimed_at=null where id=s.id;
  if public.read_linked_fiscal_application(s.id) is not null then raise exception 'Revoked application claim retained access'; end if;
end $$;
rollback;
