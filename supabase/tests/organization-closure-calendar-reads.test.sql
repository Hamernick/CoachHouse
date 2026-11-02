\set ON_ERROR_STOP on
begin;
select public.fixture_closure_calendar();
update public.organizations set is_public_roadmap=true where user_id=public.fixture_form_id(1);
set local role anon;
do $$ begin
 if (select count(*) from public.roadmap_calendar_public_events)<>1 then raise exception 'Public calendar missing'; end if;
 if has_function_privilege('anon','public.read_roadmap_calendar_feed(text,text)','execute') then raise exception 'Anonymous RPC granted'; end if;
end $$;
reset role;
select public.fixture_closure('request',600,0);
set local role service_role;
do $$ begin
 if public.read_roadmap_calendar_feed('synthetic-public-1','public') is not null
 or public.read_roadmap_calendar_feed('synthetic-internal-1','internal') is not null then raise exception 'Closed feed returned'; end if;
 if jsonb_array_length(public.read_roadmap_calendar_feed('synthetic-public-2','public'))<>1 then raise exception 'Other feed changed'; end if;
 if has_function_privilege('service_role','public.organization_closure_command(uuid,uuid,text,uuid,integer)','execute') then raise exception 'Closure activated'; end if;
end $$;
set local role anon;
do $$ begin if exists(select 1 from public.roadmap_calendar_public_events) then raise exception 'Closed public event returned'; end if; end $$;
set local role authenticated;
set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000005';
do $$ begin
 if (select count(*) from public.roadmap_calendar_public_events)<>1 or (select count(*) from public.roadmap_calendar_internal_events)<>1 then raise exception 'Authorized export unavailable'; end if;
end $$;
set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000006';
do $$ begin if exists(select 1 from public.roadmap_calendar_public_events) or exists(select 1 from public.roadmap_calendar_internal_events) then raise exception 'Outsider exported'; end if; end $$;
reset role;
savepoint before_expiry;
update public.organization_closures set requested_at=now()-interval '721 hours',export_until=now()-interval '1 hour' where org_id=public.fixture_form_id(1);
set local role authenticated;
set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000001';
do $$ begin
 if exists(select 1 from public.roadmap_calendar_public_events) or exists(select 1 from public.roadmap_calendar_internal_events) or exists(select 1 from public.organization_workspace_calendar_revisions) then raise exception 'Expired export returned'; end if;
end $$;
reset role;
rollback to before_expiry;
select public.fixture_closure('cancel',601,1);
set local role anon;
do $$ begin if exists(select 1 from public.roadmap_calendar_public_events) then raise exception 'Cancel republished calendar'; end if; end $$;
reset role;
do $$ begin
 if exists(select 1 from public.roadmap_calendar_public_feeds where org_id=public.fixture_form_id(1)) or exists(select 1 from public.roadmap_calendar_internal_feeds where org_id=public.fixture_form_id(1)) then raise exception 'Cancel restored feed'; end if;
 if (select count(*) from public.roadmap_calendar_public_events where org_id=public.fixture_form_id(1))<>1 then raise exception 'Content lost'; end if;
end $$;
rollback;
