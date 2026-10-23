create function pg_temp.valid_guest_application() returns jsonb language sql as $$
 select '{"applicant_first_name":"Test","applicant_last_name":"Applicant","mailing_street_address":"1 Test St","mailing_city":"Chicago","mailing_state":"IL","mailing_postal_code":"60601","legal_entity_type":"individual","project_description":"Grow food together","public_benefit":"Fresh food for neighbors","prospective_funding_sources":"Community donations","estimated_budget_cents":100000,"budget_rows":[{"category":"Supplies","totalCost":"1000"}],"operates_outside_united_states":false,"engages_in_lobbying":false,"fundraising_goal":{"amountCents":100000,"period":"monthly"}}'::jsonb
$$;
do $$ begin
  if has_function_privilege('anon','public.submit_guest_fiscal_application(text,jsonb)','execute')
    or has_function_privilege('authenticated','public.submit_guest_fiscal_application(text,jsonb)','execute') then
    raise exception 'Guest transaction must only be callable by trusted server';
  end if;
  if has_table_privilege('anon','public.fiscal_guest_submissions','select')
    or has_table_privilege('authenticated','public.fiscal_guest_email_outbox','select') then
    raise exception 'Private intake tables exposed';
  end if;
end $$;
set role service_role;
do $$ begin
  begin
    perform public.submit_guest_fiscal_application(repeat('a',64),pg_temp.valid_guest_application() || '{"primary_email":"guest@example.test","project_name":"Community garden"}');
    raise exception 'Accepted unconfigured intake';
  exception when raise_exception then
    if sqlerrm <> 'Fiscal intake is not configured' then raise; end if;
  end;
end $$;
reset role;
insert into public.fiscal_guest_intake_settings(org_id, system_actor_id)
 values('10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001');
set role service_role;
do $$ declare first_result jsonb; retry_result jsonb; begin
  first_result := public.submit_guest_fiscal_application(repeat('a',64),pg_temp.valid_guest_application() || '{"primary_email":"Guest@Example.test","project_name":"Community garden","project_description":"Grow food together","applicant_first_name":"Test","applicant_last_name":"Applicant"}');
  retry_result := public.submit_guest_fiscal_application(repeat('a',64),pg_temp.valid_guest_application() || '{"primary_email":"Guest@Example.test","project_name":"Community garden"}');
  if first_result->>'submissionId' <> retry_result->>'submissionId'
    or (retry_result->>'created')::boolean then raise exception 'Submission retry duplicated'; end if;
  begin
    perform public.submit_guest_fiscal_application(repeat('b',64),pg_temp.valid_guest_application() || '{"primary_email":"g@example.test","project_name":"Forged","org_id":"10000000-0000-0000-0000-000000000003"}');
    raise exception 'Accepted caller ownership';
  exception when invalid_parameter_value then null; end;
end $$;
reset role;
do $$ begin
  if (select count(*) from public.organization_projects) <> 1
    or (select count(*) from public.fiscal_sponsorship_applications) <> 1
    or (select count(*) from public.fiscal_project_reviewers) <> 2
    or (select count(*) from public.fiscal_guest_email_outbox) <> 2
    or (select count(*) from public.fiscal_staff_email_outbox) <> 1
    or (select count(*) from public.fiscal_sponsorship_events) <> 1 then raise exception 'Incomplete or duplicated handoff'; end if;
  if exists(select 1 from public.fiscal_guest_submissions where claimed_user_id is not null or contact_email <> 'guest@example.test') then raise exception 'Guest identity is wrong'; end if;
  if exists(select 1 from public.fiscal_sponsorship_applications where created_by is not null or status <> 'submitted' or project_description <> 'Grow food together' or jsonb_array_length(metadata->'budgetRows') <> 1) then raise exception 'Lost applicant data or forged actor'; end if;
  if exists(select 1 from public.organization_projects where org_id <> '10000000-0000-0000-0000-000000000001' or not organization_unassigned or option_settings is distinct from '{"tags":[],"sprintTypes":[],"fiscalSponsorshipEnabled":true}'::jsonb) then raise exception 'Incorrect project ownership or fiscal setup'; end if;
  if (select count(*) from public.profiles) <> 3 then raise exception 'Created a fake applicant account'; end if;
end $$;
-- Missing reviewer must fail without leaving a project or application behind.
update public.profiles set email='unconfigured@example.test' where email='joel@coachhousesolutions.org';
set role service_role;
do $$ begin
  begin
    perform public.submit_guest_fiscal_application(repeat('c',64),pg_temp.valid_guest_application() || '{"primary_email":"another@example.test","project_name":"Another project"}');
    raise exception 'Accepted missing reviewer';
  exception when raise_exception then
    if sqlerrm <> 'Fiscal reviewers are not configured' then raise; end if;
  end;
end $$;
reset role;
do $$ begin
 if (select count(*) from public.organization_projects) <> 1 then raise exception 'Orphan project'; end if;
end $$;
-- A failure after project insertion must roll back the whole handoff.
update public.profiles set email='joel@coachhousesolutions.org' where email='unconfigured@example.test';
alter table public.fiscal_guest_email_outbox add constraint fail_test check(recipient <> 'reject@example.test');
set role service_role;
do $$ begin
  begin
    perform public.submit_guest_fiscal_application(repeat('d',64),pg_temp.valid_guest_application() || '{"primary_email":"reject@example.test","project_name":"Rollback project"}');
    raise exception 'Expected outbox failure';
  exception when check_violation then null; end;
end $$;
reset role;
do $$ begin
 if (select count(*) from public.organization_projects) <> 1 or (select count(*) from public.fiscal_sponsorship_applications) <> 1 then raise exception 'Partial submission survived rollback'; end if;
end $$;
-- Yes answers require explanations, not automatic denial; amounts keep their timeframe.
set role service_role;
do $$ declare payload jsonb; begin
 payload := pg_temp.valid_guest_application() || '{"primary_email":"explained@example.test","project_name":"International project","operates_outside_united_states":true,"engages_in_lobbying":true}';
 begin
   perform public.submit_guest_fiscal_application(repeat('e',64),payload);
   raise exception 'Accepted unexplained Yes';
 exception when invalid_parameter_value then null; end;
 begin
   perform public.submit_guest_fiscal_application(repeat('e',64),payload || '{"concerns_explanation":"Partner-led educational work abroad; advocacy activities described for review.","fundraising_goal":{"amountCents":50000,"period":"weekly"}}');
   raise exception 'Accepted invalid timeframe';
 exception when invalid_parameter_value then null; end;
 perform public.submit_guest_fiscal_application(repeat('e',64),payload || '{"concerns_explanation":"Partner-led educational work abroad; advocacy activities described for review."}');
end $$;
reset role;
do $$ begin
 if not exists(select 1 from public.fiscal_sponsorship_applications where project_name='International project'
    and status='submitted' and metadata->'fundraisingGoal'->>'period'='monthly'
    and metadata->'fundraisingGoal'->>'amountCents'='100000') then raise exception 'Explained application or goal lost'; end if;
end $$;
