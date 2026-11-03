-- Full actual schema, isolated clone only. Synthetic records roll back.
do $$begin if current_database() not like 'ch_c3_operating_%' or current_setting('coach_house.operating_cleanup_fixture',true) is distinct from 'isolated-test-only' then raise exception 'Owned operating cleanup fixture required';end if;end$$;
begin;
create function public.c3_operating_assert(ok boolean,message text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'Assertion failed: %',message;end if;end$$;
create function public.c3_operating_error(command text,expected text) returns void language plpgsql as $$begin begin execute command;exception when others then if sqlstate=expected then return;end if;raise exception 'Expected %, got %: %',expected,sqlstate,sqlerrm;end;raise exception 'Unexpected success: %',command;end$$;
set local request.jwt.claim.role='service_role';
set local request.headers='{"x-coach-house-actor-id":"e972bc07-fbf5-4fc8-a416-7f00910a71e2"}';
\set org 'e972bc07-fbf5-4fc8-a416-7f00910a71e2'
\set other 'b80a076c-8ab7-4e16-90b7-98bdcbb09382'
\set closure 'b6000000-0000-4000-8000-000000000001'
\set operation 'b6000000-0000-4000-8000-000000000002'
update public.organizations set profile=profile||'{"org_people":[{"id":"contact","name":"private contact","email":"private@example.invalid"}],"people_roles":["custom contact label"],"people_import_history":[{"before":{"email":"old@example.invalid"},"after":{"email":"new@example.invalid"}}],"mission":"core remains until350","unknownField":"retained"}' where user_id=:'org';
insert into public.organization_people_tags(id,org_id,label,created_by) values('b6000000-0000-4000-8000-000000000010',:'org','Private tag',:'org'),('b6000000-0000-4000-8000-000000000011',:'other','Other tag',:'other');
insert into public.organization_people_segments(id,org_id,label,created_by) values('b6000000-0000-4000-8000-000000000012',:'org','Private segment',:'org');
insert into public.organization_people_tag_members(tag_id,person_id,added_by) values('b6000000-0000-4000-8000-000000000010','contact',:'org'),('b6000000-0000-4000-8000-000000000011','other contact',:'other');
insert into public.organization_people_segment_members(segment_id,person_id,added_by) values('b6000000-0000-4000-8000-000000000012','contact',:'org');
insert into public.organization_brand_kits(org_id,identity,updated_by) values(:'org','{"privateDraft":"secret logo draft"}',:'org') on conflict(org_id) do update set identity=excluded.identity;
insert into public.roadmap_calendar_public_events(id,org_id,title,description,starts_at,ends_at,all_day,recurrence,status,assigned_roles,event_type) values('b6000000-0000-4000-8000-000000000020',:'org','Private public event','Private description','2030-01-01Z','2030-01-02Z',true,'{"frequency":"weekly"}','active',array['owner'],'meeting');
insert into public.roadmap_calendar_internal_events(id,org_id,title,description,starts_at,status,event_type) values('b6000000-0000-4000-8000-000000000021',:'org','Private internal event','Private description','2030-01-01Z','canceled','deadline');
insert into public.finance_opportunity_sources(id,source_key,source_type,name,trust_level) values('b6000000-0000-4000-8000-000000000030','closure360','internal_table','Shared catalog','internal_verified');
insert into public.organization_finance_opportunities(id,org_id,title,external_provider,external_opportunity_id,source_id) values('b6000000-0000-4000-8000-000000000031',:'org','Private opportunity','fixture','360','b6000000-0000-4000-8000-000000000030');
insert into public.organization_resource_opportunity_matches(id,org_id,resource_id,resource_revision,provider,external_id,notice,need,assessment,opportunity_id) values('b6000000-0000-4000-8000-000000000032',:'org',gen_random_uuid(),1,'grants_gov','360','{"title":"private notice"}','{"body":"private need"}','{"body":"private assessment"}','b6000000-0000-4000-8000-000000000031');
insert into public.organization_finance_records(id,org_id,effective_at,record_type,direction,source_kind,source_label,amount_cents) values('b6000000-0000-4000-8000-000000000033',:'org',now(),'donation','in','donations','Retained financial evidence',123);
insert into public.organization_finance_engagement_events(id,org_id,event_type,source_label,finance_record_id,external_provider,external_event_id) values('b6000000-0000-4000-8000-000000000034',:'org','view','Private projection','b6000000-0000-4000-8000-000000000033','fixture','360');
insert into public.finance_opportunity_scan_runs(id,org_id,source_id,status,error_code,error_message,items_seen,trace_id) values('b6000000-0000-4000-8000-000000000035',:'org','b6000000-0000-4000-8000-000000000030','failed','raw_private_code','Raw private error',7,'b6000000-0000-4000-8000-000000000036');
-- Shared and independently retained rows are compared byte-for-byte.
create temporary table protected_before(kind text primary key,value text);
do $$declare t text;begin foreach t in array array['auth.users','public.profiles','public.organization_memberships','public.organization_finance_records','public.fiscal_sponsorship_documents','public.finance_opportunity_sources','public.google_calendar_connections'] loop execute format('insert into protected_before select %L,md5(coalesce(jsonb_agg(row_data order by row_data::text)::text,'''')) from (select to_jsonb(x) row_data from %s x)s',t,t);end loop;end$$;
insert into protected_before select 'other_org',md5(to_jsonb(o)::text) from public.organizations o where user_id=:'other';
insert into protected_before select 'other_tags',md5(jsonb_agg(to_jsonb(t) order by id)::text) from public.organization_people_tags t where org_id=:'other';
select count(*) as activity_before from public.organization_project_activity_events where org_id=:'org' \gset
-- Pending work and independently owned references refuse the entire group.
savepoint pending_scan;
update public.finance_opportunity_scan_runs set status='running',error_code=null,error_message=null where id='b6000000-0000-4000-8000-000000000035';
select public.organization_closure_command(:'org',:'org','request',:'closure',0);
update public.organization_closures set requested_at=statement_timestamp()-interval '31 days',export_until=statement_timestamp()-interval '31 days'+interval '720 hours' where org_id=:'org';
select public.c3_operating_error(format('select public.purge_expired_organization_operating_content(%L,%L,1,%L)',:'org',:'closure',:'operation'),'42501');
select public.c3_operating_assert((select profile ? 'org_people' from public.organizations where user_id=:'org') and not exists(select 1 from public.organization_closure_operating_cleanups where org_id=:'org'),'pending scan leaves all payload and receipts unchanged');
rollback to pending_scan;
release pending_scan;
savepoint foreign_reference;
insert into public.organization_resource_opportunity_matches(id,org_id,resource_id,resource_revision,provider,external_id,notice,need,assessment,opportunity_id) values('b6000000-0000-4000-8000-000000000037',:'other',gen_random_uuid(),1,'grants_gov','361','{}','{}','{}','b6000000-0000-4000-8000-000000000031');
select public.organization_closure_command(:'org',:'org','request',:'closure',0);
update public.organization_closures set requested_at=statement_timestamp()-interval '31 days',export_until=statement_timestamp()-interval '31 days'+interval '720 hours' where org_id=:'org';
select public.c3_operating_error(format('select public.purge_expired_organization_operating_content(%L,%L,1,%L)',:'org',:'closure',:'operation'),'42501');
select public.c3_operating_assert((select opportunity_id is not null from public.organization_resource_opportunity_matches where id='b6000000-0000-4000-8000-000000000037') and (select profile ? 'org_people' from public.organizations where user_id=:'org'),'foreign reference never cascades or permits partial retirement');
rollback to foreign_reference;
release foreign_reference;
-- Exercise actual shutdown/capture before isolated expiry fixture adjustment.
select public.organization_closure_command(:'org',:'org','request',:'closure',0);
select public.c3_operating_error(format('select public.purge_expired_organization_operating_content(%L,%L,1,%L)',:'org',:'closure',:'operation'),'42501');
update public.organization_closures set requested_at=statement_timestamp()-interval '31 days',export_until=statement_timestamp()-interval '31 days'+interval '720 hours' where org_id=:'org';
select public.read_organization_suppression_events()::text as suppression_before \gset
select public.c3_operating_assert(not has_function_privilege('service_role','public.purge_expired_organization_operating_content(uuid,uuid,integer,uuid)','execute') and not has_table_privilege('authenticated','public.organization_closure_operating_cleanups','select'),'private ACLs');
savepoint api_actor;
set local role service_role;
select public.c3_operating_error(format('select public.purge_expired_organization_operating_content(%L,%L,1,%L)',:'org',:'closure',:'operation'),'42501');
reset role;
rollback to api_actor;
release api_actor;
select public.c3_operating_error(format('select public.purge_expired_organization_operating_content(%L,%L,2,%L)',:'org',:'closure',:'operation'),'42501');
savepoint operator_context;
grant execute on function public.purge_expired_organization_operating_content(uuid,uuid,integer,uuid) to service_role;
set local role service_role;
select public.c3_operating_error(format('select public.purge_expired_organization_operating_content(%L,%L,1,%L)',:'org',:'closure',:'operation'),'42501');
reset role;
set local session_replication_role=replica;
select public.c3_operating_error(format('select public.purge_expired_organization_operating_content(%L,%L,1,%L)',:'org',:'closure',:'operation'),'42501');
set local session_replication_role=origin;
rollback to operator_context;
release operator_context;
savepoint injected_failure;
create function public.c3_operating_injected_failure() returns trigger language plpgsql as $$begin raise exception 'Injected source failure';end$$;
create trigger z_c3_operating_failure before delete on public.organization_brand_kits for each row execute function public.c3_operating_injected_failure();
select public.c3_operating_error(format('select public.purge_expired_organization_operating_content(%L,%L,1,%L)',:'org',:'closure',:'operation'),'P0001');
select public.c3_operating_assert((select profile ? 'org_people' from public.organizations where user_id=:'org') and exists(select 1 from public.organization_people_tags where id='b6000000-0000-4000-8000-000000000010') and not exists(select 1 from public.organization_closure_operating_cleanups where org_id=:'org'),'mid-operation source failure restores prior profile/tags and removes running marker');
rollback to injected_failure;
release injected_failure;
--350 first remains compatible and preserves operating content.
savepoint core_first;
select public.purge_expired_organization_core_content(:'org',:'closure',1,'b6000000-0000-4000-8000-000000000040');
select public.c3_operating_assert((select profile ? 'org_people' and not(profile ? 'mission') from public.organizations where user_id=:'org'),'350 retains operating content');
select public.purge_expired_organization_operating_content(:'org',:'closure',1,:'operation');
rollback to core_first;
release core_first;
select public.c3_operating_assert((select profile ? 'org_people' from public.organizations where user_id=:'org') and not exists(select 1 from public.organization_closure_operating_cleanups where org_id=:'org'),'full transaction rollback restores content/receipt');
select public.purge_expired_organization_operating_content(:'org',:'closure',1,:'operation')::text as receipt \gset
select public.c3_operating_assert((:'receipt'::jsonb->>'tagsDeleted')::integer=1 and (:'receipt'::jsonb->>'segmentsDeleted')::integer=1 and (:'receipt'::jsonb->>'tagLinksDeleted')::integer=1 and (:'receipt'::jsonb->>'segmentLinksDeleted')::integer=1 and (:'receipt'::jsonb->>'brandKitsDeleted')::integer=1 and (:'receipt'::jsonb->>'resourceMatchesDeleted')::integer=1 and (:'receipt'::jsonb->>'opportunitiesDeleted')::integer=1 and (:'receipt'::jsonb->>'engagementDeleted')::integer=1,'complete operating projection');
select public.c3_operating_assert((select not(profile ?| array['org_people','people_roles','people_import_history']) and profile->>'mission'='core remains until350' and profile->>'unknownField'='retained' from public.organizations where user_id=:'org'),'contacts and undo retired; unrelated profile preserved');
select public.c3_operating_assert((select title='' and description is null and starts_at='1970-01-01Z' and ends_at is null and not all_day and recurrence is null and cardinality(assigned_roles)=0 and status='active' and event_type='other' from public.roadmap_calendar_public_events where id='b6000000-0000-4000-8000-000000000020') and (select title='' and status='canceled' from public.roadmap_calendar_internal_events where id='b6000000-0000-4000-8000-000000000021'),'calendar content retired without provider cancellation fiction');
select public.c3_operating_assert((select status='failed' and error_code='closure_content_retired' and error_message is null and items_seen=7 and trace_id='b6000000-0000-4000-8000-000000000036' from public.finance_opportunity_scan_runs where id='b6000000-0000-4000-8000-000000000035'),'terminal scan facts preserved, diagnostics removed');
select public.c3_operating_assert(public.read_organization_suppression_events()=:'suppression_before'::jsonb,'revocation/suppression unchanged');
select public.c3_operating_assert(public.purge_expired_organization_operating_content(:'org',:'closure',1,:'operation')=:'receipt'::jsonb,'exact retry returns immutable result');
select public.c3_operating_assert(not(public.purge_expired_organization_operating_content(:'org',:'closure',1,'b6000000-0000-4000-8000-000000000041')->>'profileChanged')::boolean,'fresh no-op operation');
select public.c3_operating_error(format('update public.organizations set profile=''{}'' where user_id=%L',:'org'),'42501');
select public.c3_operating_error(format('delete from public.roadmap_calendar_public_events where org_id=%L',:'org'),'42501');
select public.c3_operating_error(format('update public.organization_closure_operating_cleanups set result=''{}'' where org_id=%L',:'org'),'42501');
select public.c3_operating_error('truncate public.organization_closure_operating_cleanups','42501');
select public.c3_operating_assert((select count(*)=:'activity_before'::integer from public.organization_project_activity_events where org_id=:'org'),'no copied activity payload');
--360 first also leaves350 intact.
select public.purge_expired_organization_core_content(:'org',:'closure',1,'b6000000-0000-4000-8000-000000000042');
select public.c3_operating_assert((select not(profile ? 'mission') and not(profile ? 'org_people') and profile->>'unknownField'='retained' from public.organizations where user_id=:'org'),'360 then350 coexist');
savepoint lifecycle;
select public.c3_operating_error(format('select public.organization_closure_command(%L,%L,''cancel'',%L,1)',:'org',:'org','b6000000-0000-4000-8000-000000000043'),'42501');
update public.organization_closures set requested_at=statement_timestamp(),export_until=statement_timestamp()+interval '720 hours' where org_id=:'org';
select public.organization_closure_command(:'org',:'org','cancel','b6000000-0000-4000-8000-000000000043',1);
select public.c3_operating_error(format('select public.purge_expired_organization_operating_content(%L,%L,1,%L)',:'org',:'closure',:'operation'),'42501');
select public.organization_closure_command(:'org',:'org','request','b6000000-0000-4000-8000-000000000044',2);
select public.c3_operating_error(format('select public.purge_expired_organization_operating_content(%L,%L,1,%L)',:'org',:'closure',:'operation'),'42501');
rollback to lifecycle;
release lifecycle;
do $$declare t text;v text;begin foreach t in array array['auth.users','public.profiles','public.organization_memberships','public.organization_finance_records','public.fiscal_sponsorship_documents','public.finance_opportunity_sources','public.google_calendar_connections'] loop execute format('select md5(coalesce(jsonb_agg(row_data order by row_data::text)::text,'''')) from (select to_jsonb(x) row_data from %s x)s',t) into v;perform public.c3_operating_assert(v=(select value from protected_before where kind=t),'protected '||t);end loop;end$$;
select public.c3_operating_assert((select value from protected_before where kind='other_org')=(select md5(to_jsonb(o)::text) from public.organizations o where user_id=:'other') and (select value from protected_before where kind='other_tags')=(select md5(jsonb_agg(to_jsonb(t) order by id)::text) from public.organization_people_tags t where org_id=:'other'),'other organization preserved');
select 'operating cleanup/preservation/retry/ACL/lifecycle/core coexistence passed';
rollback;
