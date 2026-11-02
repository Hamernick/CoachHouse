\set ON_ERROR_STOP on
begin;
select public.fixture_closure_calendar();
update public.organizations set is_public=true,is_public_roadmap=true;
insert into public.programs(id,user_id,is_public) values(public.fixture_form_id(2401),public.fixture_form_id(1),true),(public.fixture_form_id(2402),public.fixture_form_id(2),true),(public.fixture_form_id(2403),public.fixture_form_id(3),true);
set local role service_role;
do $$ begin
 if cardinality(public.filter_public_organization_ids(array[public.fixture_form_id(1),public.fixture_form_id(2)]))<>2 then raise exception 'Active public organizations missing'; end if;
 if has_function_privilege('anon','public.filter_public_organization_ids(uuid[],text)','execute') then raise exception 'Public RPC ACL widened'; end if;
end $$;
reset role;
set local role anon;
do $$ begin if (select count(*) from public.programs where id in(public.fixture_form_id(2401),public.fixture_form_id(2402),public.fixture_form_id(2403)))<>3 then raise exception 'Active public programs unavailable'; end if; end $$;
reset role;
select public.fixture_closure('request',600,0);
set local role anon;
do $$ begin
 if exists(select 1 from public.programs where id=public.fixture_form_id(2401)) then raise exception 'Closed program public read'; end if;
 if (select count(*) from public.programs where id in(public.fixture_form_id(2402),public.fixture_form_id(2403)))<>2 then raise exception 'Other/personal programs hidden'; end if;
end $$;
reset role;
do $$ begin
 if exists(select 1 from public.organizations where user_id=public.fixture_form_id(1) and (is_public or is_public_roadmap)) then raise exception 'Closure retained publication'; end if;
 if (select is_public from public.programs where id=public.fixture_form_id(2401)) or not (select is_public from public.programs where id=public.fixture_form_id(2402)) or not (select is_public from public.programs where id=public.fixture_form_id(2403)) then raise exception 'Program ownership withdrawal failed'; end if;
 if cardinality(public.filter_public_organization_ids(array[public.fixture_form_id(1),public.fixture_form_id(2)]))<>1 then raise exception 'Public filter failed'; end if;
end $$;
savepoint expiry;
update public.organization_closures set requested_at=now()-interval '721 hours',export_until=now()-interval '1 hour' where org_id=public.fixture_form_id(1);
set local role authenticated;
set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000001';
do $$ begin if exists(select 1 from public.organizations where user_id=public.fixture_form_id(1)) then raise exception 'Expired private profile returned'; end if; end $$;
reset role;
rollback to expiry;
select public.fixture_closure('cancel',601,1);
do $$ begin
 if cardinality(public.filter_public_organization_ids(array[public.fixture_form_id(1)]))<>0 then raise exception 'Cancel restored publication'; end if;
 if not exists(select 1 from public.organizations where user_id=public.fixture_form_id(2) and is_public and is_public_roadmap) then raise exception 'Other org changed'; end if;
end $$;
-- Existing explicit publication may be authorized again after cancellation.
update public.organizations set is_public=true where user_id=public.fixture_form_id(1);
do $$ begin
 if cardinality(public.filter_public_organization_ids(array[public.fixture_form_id(1)]))<>1 then raise exception 'Explicit republish failed'; end if;
 if cardinality(public.filter_public_organization_ids(array[public.fixture_form_id(1)],'roadmap'))<>0 then raise exception 'Profile republished roadmap'; end if;
end $$;
rollback;
