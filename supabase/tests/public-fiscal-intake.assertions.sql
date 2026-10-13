do $$ begin
  if has_function_privilege('anon', 'public.start_public_fiscal_intake(text)', 'execute') then
    raise exception 'Anonymous intake execution allowed';
  end if;
end $$;
set role authenticated;
select set_config('request.jwt.claim.sub', '', false);
do $$ begin
  begin
    perform public.start_public_fiscal_intake('Unauthenticated');
    raise exception 'Missing auth was accepted';
  exception when insufficient_privilege then null;
  end;
end $$;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', false);
do $$ declare first_id uuid; repeated_id uuid; begin
  begin
    perform public.start_public_fiscal_intake('  ');
    raise exception 'Blank name accepted';
  exception when invalid_parameter_value then null;
  end;
  if exists(select 1 from public.organizations) then raise exception 'Invalid start mutated data'; end if;
  first_id := public.start_public_fiscal_intake('Community kitchen');
  repeated_id := public.start_public_fiscal_intake('Do not overwrite');
  if first_id <> repeated_id then raise exception 'Repeated intake duplicated project'; end if;
  if (select count(*) from public.organization_projects) <> 1 then raise exception 'Owner scope or idempotency failed'; end if;
  if not exists(select 1 from public.organizations where profile->>'name' = 'Community kitchen' and not is_public) then
    raise exception 'New intake published or overwrote profile';
  end if;
end $$;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', false);
do $$ begin
  perform public.start_public_fiscal_intake('Changed');
  if (select count(*) from public.organization_projects) <> 1 then raise exception 'Intake crossed owner boundary'; end if;
  if not exists(select 1 from public.organizations where profile->>'mission' = 'Keep this' and profile->>'name' = 'Preserved' and is_public) then
    raise exception 'Existing published profile changed';
  end if;
end $$;
reset role;
do $$ begin
  if (select count(*) from public.organization_projects) <> 2 then raise exception 'Unexpected project count'; end if;
  if exists(select 1 from public.organization_projects where created_by <> org_id or updated_by <> org_id or option_settings->>'fiscalSponsorshipEnabled' <> 'true') then
    raise exception 'Invalid intake ownership or fiscal option';
  end if;
end $$;

-- The intake exception must not grant general project writes or reads.
set role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', false);
do $$ begin
  begin
    insert into public.organization_projects(org_id, project_kind, name, created_source, created_by)
    values(auth.uid(), 'standard', 'Forbidden project', 'user', auth.uid());
    raise exception 'Free owner created a general project';
  exception when insufficient_privilege then null; end;
  if public.owns_public_fiscal_intake(auth.uid()::text, 'invalid-path', true) then
    raise exception 'Invalid storage path accepted';
  end if;
end $$;
reset role;
insert into public.fiscal_sponsorship_applications(id,org_id,project_id,status)
select gen_random_uuid(), org_id, id, 'draft' from public.organization_projects;
set role authenticated;
do $$ declare pid uuid; begin
  select id into pid from public.organization_projects limit 1;
  insert into public.organization_project_assets(org_id,project_id,name) values(auth.uid(),pid,'budget.pdf');
  insert into storage.objects(bucket_id,name) values('project-assets',auth.uid()::text||'/'||pid::text||'/budget.pdf');
  begin
    insert into storage.objects(bucket_id,name) values('project-assets',auth.uid()::text||'/unrelated/budget.pdf');
    raise exception 'Free intake escaped its storage folder';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
update public.fiscal_sponsorship_applications set status='submitted';
set role authenticated;
do $$ begin
  if (select count(*) from public.organization_project_assets) <> 1 then raise exception 'Submitted attachment unreadable'; end if;
  update public.organization_project_assets set name='Changed';
  if found then raise exception 'Submitted intake attachment remained writable'; end if;
  delete from storage.objects;
  if found then raise exception 'Submitted intake storage remained writable'; end if;
end $$;
reset role;
