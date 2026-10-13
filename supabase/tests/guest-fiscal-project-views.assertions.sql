-- Isolated transaction: later policy assertions retain their original fixtures.
begin;
insert into public.organization_projects(id,org_id,project_kind,name,created_source,created_by)
values ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001',
 'standard','Ordinary project','user','10000000-0000-0000-0000-000000000001');
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',true);
do $$ declare projects jsonb; summary jsonb; begin
 projects := public.list_fiscal_guest_projects(auth.uid());
 if jsonb_array_length(projects) <> 2 then raise exception 'Assigned guest list incomplete'; end if;
 if projects @> '[{"name":"Ordinary project"}]'::jsonb then raise exception 'Non-guest project included'; end if;
 summary := public.get_fiscal_guest_project_summary((projects->0->>'id')::uuid,auth.uid());
 if summary->>'accountLinked' <> 'false' or summary->>'emailVerified' <> 'false' then
   raise exception 'Unverified guest presented as linked';
 end if;
 if (select count(*) from jsonb_object_keys(summary)) <> 4 then raise exception 'Summary exposes extra fields'; end if;
 if public.get_fiscal_guest_project_summary('20000000-0000-0000-0000-000000000001',auth.uid()) is not null then
   raise exception 'Ordinary project presented as guest';
 end if;
 begin
   perform public.list_fiscal_guest_projects('10000000-0000-0000-0000-000000000003');
   raise exception 'Reviewer impersonation allowed';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
update public.fiscal_guest_submissions set email_verified_at=now(),
 claimed_user_id='10000000-0000-0000-0000-000000000001',
 claimed_org_id='10000000-0000-0000-0000-000000000001',claimed_at=now();
set local role authenticated;
do $$ declare projects jsonb; summary jsonb; begin
 projects := public.list_fiscal_guest_projects(auth.uid());
 summary := public.get_fiscal_guest_project_summary((projects->0->>'id')::uuid,auth.uid());
 if summary->>'accountLinked' <> 'true' or summary->>'emailVerified' <> 'true' then
   raise exception 'Verified claim not shown';
 end if;
end $$;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
do $$ begin
 if public.list_fiscal_guest_projects(auth.uid()) <> '[]'::jsonb then raise exception 'Host owner sees guest projects'; end if;
end $$;
reset role;
set local role anon;
do $$ begin
 begin
  perform public.list_fiscal_guest_projects('10000000-0000-0000-0000-000000000002');
  raise exception 'Anonymous list access allowed';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role service_role;
do $$ declare pid uuid; recipients jsonb; begin
 select project_id into pid from public.fiscal_guest_submissions limit 1;
 recipients := public.get_fiscal_guest_notification_recipients(pid);
 if jsonb_array_length(recipients) <> 2 or recipients @> '["10000000-0000-0000-0000-000000000001"]'::jsonb then
  raise exception 'Guest notifications sent outside assigned reviewers';
 end if;
 if public.get_fiscal_guest_notification_recipients('20000000-0000-0000-0000-000000000001') is not null then
  raise exception 'Ordinary notification routing changed';
 end if;
end $$;
reset role;
set local role authenticated;
do $$ begin
 begin
  perform public.get_fiscal_guest_notification_recipients(gen_random_uuid());
  raise exception 'Reviewer recipients exposed to browser';
 exception when insufficient_privilege then null; end;
end $$;
rollback;
