insert into public.fiscal_sponsorship_reviews select project_id from public.fiscal_guest_submissions;
insert into public.fiscal_sponsorship_documents select project_id from public.fiscal_guest_submissions;
insert into public.fiscal_sponsorship_signature_packets select project_id from public.fiscal_guest_submissions;
create function pg_temp.assert_guest_rows(p_visible boolean) returns void language plpgsql as $$
declare relation text; n integer; begin
  foreach relation in array array['organization_projects','fiscal_sponsorship_applications',
    'fiscal_sponsorship_reviews','fiscal_sponsorship_documents',
    'fiscal_sponsorship_signature_packets','fiscal_sponsorship_events'] loop
    execute format('select count(*) from public.%I', relation) into n;
    if (p_visible and n=0) or (not p_visible and n<>0) then
      raise exception 'Guest row visibility failure: %, count %, expected visible %', relation, n, p_visible;
    end if;
  end loop;
end $$;

set role authenticated;
-- Host owner and unassigned staff are NOT guest reviewers.
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',false);
select pg_temp.assert_guest_rows(false);
-- Both assigned reviewers, independent of the organization coach assignment.
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',false);
select pg_temp.assert_guest_rows(true);
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000003',false);
select pg_temp.assert_guest_rows(true);
-- Cannot forge an actor to inspect another reviewer's access.
do $$ begin
  begin
    perform public.fiscal_guest_project_reviewer_access(gen_random_uuid(),'10000000-0000-0000-0000-000000000002');
    raise exception 'Authenticated actor override allowed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
-- Assignment removal takes effect immediately; developer access is explicit.
delete from public.fiscal_project_reviewers where user_id='10000000-0000-0000-0000-000000000003';
set role authenticated;
select pg_temp.assert_guest_rows(false);
reset role;
update public.platform_staff_members set access_level='developer' where user_id='10000000-0000-0000-0000-000000000003';
set role authenticated;
select pg_temp.assert_guest_rows(true);
reset role;
-- An assignment never survives loss of staff status.
delete from public.fiscal_project_reviewers where user_id='10000000-0000-0000-0000-000000000002';
delete from public.platform_staff_members where user_id='10000000-0000-0000-0000-000000000002';
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',false);
select pg_temp.assert_guest_rows(false);
-- Ordinary projects continue to use existing authorization.
do $$ begin
 if not public.can_access_fiscal_guest_project('20000000-0000-0000-0000-000000000001')
   or public.is_fiscal_guest_project_reviewer('20000000-0000-0000-0000-000000000001') then
   raise exception 'Ordinary project behavior changed';
 end if;
end $$;
reset role;
set role anon;
do $$ begin
 begin
   perform public.is_fiscal_guest_project_reviewer(gen_random_uuid());
   raise exception 'Anonymous access oracle allowed';
 exception when insufficient_privilege then null; end;
end $$;
reset role;

insert into public.organization_projects(id,org_id,project_kind,name,created_source,created_by)
values ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001',
 'standard','Ordinary project','user','10000000-0000-0000-0000-000000000001');
set role authenticated;
do $$ begin
 if (select count(*) from public.organization_projects) <> 1 then
   raise exception 'Existing ordinary-project policy was changed';
 end if;
 begin
   update public.organization_projects set name='Unauthorized edit';
   raise exception 'Read assignment granted mutation rights';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
