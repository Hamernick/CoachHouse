-- Full-schema isolated profile cleanup clone only; all synthetic writes roll back.
do $$begin if current_database() not like 'ch_c3_profile_%' or current_setting('coach_house.profile_cleanup_fixture',true) is distinct from 'isolated-test-only' then raise exception 'Owned profile cleanup fixture required';end if;end$$;
begin;
create function public.c3_profile_assert(ok boolean,message text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'Assertion failed: %',message;end if;end$$;
create function public.c3_profile_error(command text,expected text) returns void language plpgsql as $$begin begin execute command;exception when others then if sqlstate=expected then return;end if;raise exception 'Expected %, got %: %',expected,sqlstate,sqlerrm;end;raise exception 'Unexpected success: %',command;end$$;
set local request.jwt.claim.role='service_role';
set local request.headers='{"x-coach-house-actor-id":"e972bc07-fbf5-4fc8-a416-7f00910a71e2"}';
\set org 'e972bc07-fbf5-4fc8-a416-7f00910a71e2'
\set other 'b80a076c-8ab7-4e16-90b7-98bdcbb09382'
\set closure 'b4200000-0000-4000-8000-000000000001'
\set operation 'b4200000-0000-4000-8000-000000000002'
select public.c3_profile_assert(public.project_retired_profile_metadata('{"name":"private name","brandColors":["#112233"],"brandTypography":{"headings":{"family":"Private font","weight":"400","tracking":"normal"},"body":{"family":"Private font"},"code":{"family":"Private mono"}},"isPublic":true,"documents":{"legacy":{"path":"keep exact"}},"unknown":{"path":"keep unknown"}}')='{"documents":{"legacy":{"path":"keep exact"}},"unknown":{"path":"keep unknown"}}'::jsonb,'exact pure projection preserves all physical/unknown bindings');
select public.c3_profile_assert(public.project_retired_profile_metadata('{"name":{"file":"legacy"},"brandColors":"malformed","brandTypography":{"headings":{"family":"Font","assetPath":"legacy"}},"isPublic":"malformed"}')='{"name":{"file":"legacy"},"brandColors":"malformed","brandTypography":{"headings":{"family":"Font","assetPath":"legacy"}},"isPublic":"malformed"}'::jsonb,'malformed known keys preserve recovery evidence');
select public.c3_profile_error($q$select public.project_retired_profile_metadata('[]')$q$,'42501');
-- Every supported alias is seeded, then valid structured values are supplied.
update public.organizations set profile=profile||(select jsonb_object_agg(key,'private metadata sentinel') from unnest(public.closure_profile_metadata_keys())key)||
 '{"brandColors":["#112233"],"brandTypography":{"headings":{"family":"Private font","weight":"400","tracking":"normal"}},"brand_typography":{"code":{"family":"Private mono"}},"isPublic":true,"reports":{"legacyPhysical":"unresolved/report.pdf"},"mission":"retained until350","org_people":[{"name":"retained until360"}],"logoUrl":"https://example.invalid/physical.png","logo_url":"https://legacy.invalid/physical.png","documents":{"legacy":{"path":"unresolved/document.pdf"}},"unknownAttachment":{"path":"unresolved/source.pdf"}}',location_lat=45.12,location_lng=-91.4 where user_id=:'org';
-- Arbitrary key names can themselves contain content; retain only their digest.
update public.organizations set profile=profile||jsonb_build_object(repeat('synthetic-private-person@example.invalid-',300),jsonb_build_object('path','unresolved/long-key-binding.pdf')) where user_id=:'org';
create temporary table protected_before(kind text primary key,value text);
do $$declare t text;begin foreach t in array array['auth.users','public.profiles','public.organization_memberships','public.organization_finance_records','public.fiscal_sponsorship_documents','public.fiscal_sponsorship_signatures','public.organization_document_files','storage.objects','public.google_calendar_connections'] loop execute format('insert into protected_before select %L,md5(coalesce(jsonb_agg(row_data order by row_data::text)::text,'''')) from (select to_jsonb(x) row_data from %s x)s',t,t);end loop;end$$;
insert into protected_before select 'other_org',md5(to_jsonb(o)::text) from public.organizations o where user_id=:'other';
select (to_jsonb(o)-array['profile','location_lat','location_lng','updated_at'])::text as org_identity from public.organizations o where user_id=:'org' \gset
select profile::text as original_profile from public.organizations where user_id=:'org' \gset
select count(*) as activity_before from public.organization_project_activity_events where org_id=:'org' \gset
select count(*) as versions_before from public.organization_core_document_versions where org_id=:'org' \gset
select public.organization_closure_command(:'org',:'org','request',:'closure',0);
select public.c3_profile_error(format('select public.purge_expired_organization_profile_metadata(%L,%L,1,%L)',:'org',:'closure',:'operation'),'42501');
update public.organization_closures set requested_at=statement_timestamp()-interval '31 days',export_until=statement_timestamp()-interval '31 days'+interval '720 hours' where org_id=:'org';
select public.read_organization_suppression_events()::text as suppression_before \gset
select public.c3_profile_error(format('select public.purge_expired_organization_profile_metadata(%L,%L,2,%L)',:'org',:'closure',:'operation'),'42501');
select public.c3_profile_assert(not has_function_privilege('service_role','public.purge_expired_organization_profile_metadata(uuid,uuid,integer,uuid)','execute') and not has_table_privilege('authenticated','public.organization_closure_profile_cleanups','select'),'private cleanup ACL');
select public.c3_profile_assert(not has_function_privilege('service_role','public.organization_closure_command(uuid,uuid,text,uuid,integer)','execute'),'lifecycle controls remain private');
savepoint role_context;
grant execute on function public.purge_expired_organization_profile_metadata(uuid,uuid,integer,uuid) to service_role;
set local role service_role;
select public.c3_profile_error(format('select public.purge_expired_organization_profile_metadata(%L,%L,1,%L)',:'org',:'closure',:'operation'),'42501');
reset role;
set local session_replication_role=replica;
select public.c3_profile_error(format('select public.purge_expired_organization_profile_metadata(%L,%L,1,%L)',:'org',:'closure',:'operation'),'42501');
set local session_replication_role=origin;
rollback to role_context;
release role_context;
savepoint failure;
create function public.c3_profile_failure() returns trigger language plpgsql as $$begin raise exception 'Injected post-profile receipt failure';end$$;
create trigger z_c3_profile_failure before update on public.organization_closure_profile_cleanups for each row execute function public.c3_profile_failure();
select public.c3_profile_error(format('select public.purge_expired_organization_profile_metadata(%L,%L,1,%L)',:'org',:'closure',:'operation'),'P0001');
select public.c3_profile_assert((select profile=:'original_profile'::jsonb and location_lat=45.12 and location_lng=-91.4 from public.organizations where user_id=:'org') and not exists(select 1 from public.organization_closure_profile_cleanups where org_id=:'org'),'failed receipt rolls back metadata/coordinates/marker');
rollback to failure;
release failure;
-- Earlier owner projections and420 compose in both orders.
savepoint earlier_first;
select public.purge_expired_organization_core_content(:'org',:'closure',1,'b4200000-0000-4000-8000-000000000003');
select public.purge_expired_organization_operating_content(:'org',:'closure',1,'b4200000-0000-4000-8000-000000000004');
select public.purge_expired_organization_profile_metadata(:'org',:'closure',1,:'operation');
select public.c3_profile_assert((select not(profile ?| array['mission','org_people','name']) and profile ? 'documents' from public.organizations where user_id=:'org'),'350/360 then420');
rollback to earlier_first;
release earlier_first;
select public.purge_expired_organization_profile_metadata(:'org',:'closure',1,:'operation')::text as receipt \gset
select public.c3_profile_assert((:'receipt'::jsonb->>'removedMetadataKeys')::integer=cardinality(public.closure_profile_metadata_keys())-1 and :'receipt'::jsonb->'malformedKnownKeys'='["reports"]'::jsonb and (:'receipt'::jsonb->>'unknownKeyCount')::integer>=1,'all supported metadata retired; malformed/unknown ownership reported');
select public.c3_profile_assert(position('private metadata sentinel' in :'receipt')=0 and position('unresolved/source.pdf' in :'receipt')=0,'receipt contains no source values');
select public.c3_profile_assert(position('synthetic-private-person@example.invalid-' in :'receipt')=0 and length(:'receipt')<10000 and :'receipt'::jsonb->'unknownKeySha256' @> jsonb_build_array(encode(sha256(convert_to(repeat('synthetic-private-person@example.invalid-',300),'UTF8')),'hex')),'odd long unknown key retained only as bounded digest');
select public.c3_profile_assert((select profile=public.project_retired_profile_metadata(:'original_profile'::jsonb) and location_lat is null and location_lng is null from public.organizations where user_id=:'org'),'exact metadata and coordinate projection');
-- Closure publication flags may change at request; compare all other fields
-- against the immediately closed row for the cleanup-only projection below.
select public.c3_profile_assert((select ein is not distinct from (:'org_identity'::jsonb->>'ein') and public_slug is not distinct from (:'org_identity'::jsonb->>'public_slug') and user_id=:'org' from public.organizations where user_id=:'org'),'canonical EIN/handle/identity retained pending separate disposition');
select public.c3_profile_assert((select profile->'documents'=:'original_profile'::jsonb->'documents' and profile->'unknownAttachment'=:'original_profile'::jsonb->'unknownAttachment' and profile->'logoUrl'=:'original_profile'::jsonb->'logoUrl' and profile->'logo_url'=:'original_profile'::jsonb->'logo_url' and profile->'reports'=:'original_profile'::jsonb->'reports' from public.organizations where user_id=:'org'),'physical and malformed bindings unchanged');
select public.c3_profile_assert((select count(*)=:'activity_before'::integer from public.organization_project_activity_events where org_id=:'org') and (select count(*)=:'versions_before'::integer from public.organization_core_document_versions where org_id=:'org'),'no copied activity/history payload');
select public.c3_profile_assert(public.read_organization_suppression_events()=:'suppression_before'::jsonb,'suppression/revocation history unchanged');
select public.c3_profile_assert(public.purge_expired_organization_profile_metadata(:'org',:'closure',1,:'operation')=:'receipt'::jsonb,'immutable exact retry');
select public.c3_profile_assert((public.purge_expired_organization_profile_metadata(:'org',:'closure',1,'b4200000-0000-4000-8000-000000000005')->>'removedMetadataKeys')::integer=0,'new operation no-op');
select public.c3_profile_error(format('update public.organizations set profile=''{}'' where user_id=%L',:'org'),'42501');
select public.c3_profile_error(format('update public.organizations set location_lat=10 where user_id=%L',:'org'),'42501');
select public.c3_profile_error(format('update public.organization_closure_profile_cleanups set result=''{}'' where org_id=%L',:'org'),'42501');
select public.c3_profile_error('truncate public.organization_closure_profile_cleanups','42501');
select public.purge_expired_organization_core_content(:'org',:'closure',1,'b4200000-0000-4000-8000-000000000006');
select public.purge_expired_organization_operating_content(:'org',:'closure',1,'b4200000-0000-4000-8000-000000000007');
select public.c3_profile_assert((select not(profile ?| array['mission','org_people','name']) and profile ? 'documents' from public.organizations where user_id=:'org'),'420 then350/360');
savepoint lifecycle;
update public.organization_closures set requested_at=statement_timestamp(),export_until=statement_timestamp()+interval '720 hours' where org_id=:'org';
select public.organization_closure_command(:'org',:'org','cancel','b4200000-0000-4000-8000-000000000008',1);
select public.c3_profile_error(format('select public.purge_expired_organization_profile_metadata(%L,%L,1,%L)',:'org',:'closure',:'operation'),'42501');
select public.organization_closure_command(:'org',:'org','request','b4200000-0000-4000-8000-000000000009',2);
select public.c3_profile_error(format('select public.purge_expired_organization_profile_metadata(%L,%L,1,%L)',:'org',:'closure',:'operation'),'42501');
rollback to lifecycle;
release lifecycle;
do $$declare t text;v text;begin foreach t in array array['auth.users','public.profiles','public.organization_memberships','public.organization_finance_records','public.fiscal_sponsorship_documents','public.fiscal_sponsorship_signatures','public.organization_document_files','storage.objects','public.google_calendar_connections'] loop execute format('select md5(coalesce(jsonb_agg(row_data order by row_data::text)::text,'''')) from (select to_jsonb(x) row_data from %s x)s',t) into v;perform public.c3_profile_assert(v=(select value from protected_before where kind=t),'protected '||t);end loop;end$$;
select public.c3_profile_assert((select value from protected_before where kind='other_org')=(select md5(to_jsonb(o)::text) from public.organizations o where user_id=:'other'),'other organization preserved');
select 'profile metadata/projection/coordinates/preservation/retry/lifecycle/coexistence passed';
rollback;
