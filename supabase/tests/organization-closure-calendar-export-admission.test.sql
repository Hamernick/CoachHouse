-- Owned full-schema clone seeded by the private390 qualification harness only.
do $$begin if current_database() not like 'ch_c3_calendar_%' or current_setting('coach_house.calendar_export_fixture',true) is distinct from 'isolated-test-only' then raise exception 'Owned calendar export fixture required';end if;end$$;
begin;
create function public.c3_calendar_assert(ok boolean,message text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'Assertion failed: %',message;end if;end$$;
create function public.c3_calendar_error(command text,expected text) returns void language plpgsql as $$begin begin execute command;exception when others then if sqlstate=expected then return;end if;raise exception 'Expected %, got %: %',expected,sqlstate,sqlerrm;end;raise exception 'Unexpected success: %',command;end$$;
\set org 'b9000000-0000-4000-8000-000000000001'
\set other 'b9000000-0000-4000-8000-000000000002'
\set closed 'b9000000-0000-4000-8000-000000000003'
\set closure 'b9000000-0000-4000-8000-000000000101'
set local request.jwt.claim.role='service_role';
set local role service_role;
select public.c3_calendar_assert(public.authorize_organization_calendar_export(:'org',:'org'),'active owner admitted');
select public.c3_calendar_assert(public.authorize_organization_calendar_export('b9000000-0000-4000-8000-000000000004',:'org'),'admin admitted');
select public.c3_calendar_assert(public.authorize_organization_calendar_export('b9000000-0000-4000-8000-000000000005',:'org'),'staff admitted');
select public.c3_calendar_assert(public.authorize_organization_calendar_export('b9000000-0000-4000-8000-000000000006',:'org'),'board admitted');
select public.c3_calendar_assert(not public.authorize_organization_calendar_export('b9000000-0000-4000-8000-000000000007',:'org') and not public.authorize_organization_calendar_export('b9000000-0000-4000-8000-000000000008',:'org'),'member and unrelated user refused');
select public.c3_calendar_assert(not public.authorize_organization_calendar_export(:'closed',:'closed') and not public.authorize_organization_calendar_export('b9000000-0000-4000-8000-000000000099','b9000000-0000-4000-8000-000000000099') and not public.authorize_organization_calendar_export(null,:'org'),'closed owner/missing org/null refused');
reset role;
select public.c3_calendar_assert(not has_function_privilege('authenticated','public.authorize_organization_calendar_export(uuid,uuid)','execute') and not has_function_privilege('anon','public.authorize_organization_calendar_export(uuid,uuid)','execute') and has_function_privilege('service_role','public.authorize_organization_calendar_export(uuid,uuid)','execute'),'only trusted service RPC exposed');
select public.c3_calendar_assert(not has_function_privilege('service_role','public.organization_closure_command(uuid,uuid,text,uuid,integer)','execute'),'canonical closure controls still unavailable');
create temporary table before_connections as select user_id,to_jsonb(c) row_data from public.google_calendar_connections c;
select public.organization_closure_command(:'org',:'org','request',:'closure',0);
select public.c3_calendar_assert((select export_org_id is null and lease_id is null and lease_expires_at is null and revision::text<>(select row_data->>'revision' from before_connections where user_id=:'org') from public.google_calendar_connections where user_id=:'org'),'close withdraws matching export pointer and current worker revision/lease');
select public.c3_calendar_assert((select to_jsonb(c)-array['export_org_id','revision','lease_id','lease_expires_at','updated_at']=(select row_data-array['export_org_id','revision','lease_id','lease_expires_at','updated_at'] from before_connections where user_id=:'org') from public.google_calendar_connections c where user_id=:'org'),'personal credentials/cache/destinations unchanged');
select public.c3_calendar_assert(not exists(select 1 from public.google_calendar_connections c join before_connections b using(user_id) where c.user_id<>:'org' and to_jsonb(c)<>b.row_data),'every other connection unchanged');
select public.c3_calendar_assert(not public.authorize_organization_calendar_export(:'org',:'org') and not public.authorize_organization_calendar_export('b9000000-0000-4000-8000-000000000004',:'org'),'closed owner/admin refused immediately');
select public.c3_calendar_error(format('update public.google_calendar_connections set export_org_id=%L where user_id=%L',:'org',:'org'),'42501');
select public.c3_calendar_error(format('insert into public.google_calendar_connections(user_id,google_subject,google_email,export_org_id) values(%L,''synthetic'',''synthetic@example.invalid'',%L)','b9000000-0000-4000-8000-000000000004',:'org'),'42501');
select public.c3_calendar_error(format('update public.google_calendar_connections set export_org_id=%L where user_id=%L',:'other',:'org'),'42501');
select public.organization_closure_command(:'org',:'org','cancel','b9000000-0000-4000-8000-000000000102',1);
select public.c3_calendar_assert((select export_org_id is null and lease_id is null from public.google_calendar_connections where user_id=:'org'),'cancel never restores export selection/lease');
select public.c3_calendar_assert(public.authorize_organization_calendar_export(:'org',:'org'),'active owner can make a new explicit choice');
-- New explicit consent is allowed after cancellation; old consent is never replayed.
update public.google_calendar_connections set export_org_id=:'org' where user_id=:'org';
select public.c3_calendar_assert((select export_org_id=:'org'::uuid from public.google_calendar_connections where user_id=:'org'),'fresh owner selection admitted');
select 'calendar admission/scoped withdrawal/personal preservation/cancel/selection passed';
rollback;
