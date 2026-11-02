\set ON_ERROR_STOP on
begin;
do $$ begin
 if current_setting('coach_house.workspace_sharing_fixture',true) is distinct from 'isolated-test-only' then raise exception 'Fixture required'; end if;
end $$;
update public.organization_workspace_boards set state='{}',updated_by=public.fixture_form_id(1);
truncate public.organization_forms cascade;
delete from public.organization_workspace_pages;
select public.fixture_form_publish(0,'publish',80,4);
select public.fixture_form_command('submit');
create function pg_temp.recovery(action text, actor integer default 1, patch jsonb default '{}') returns jsonb language sql as $$
 select public.organization_form_recovery(public.fixture_form_id(actor),jsonb_build_object('action',action,'pageId',public.fixture_form_id(10),
 'formId',public.fixture_form_id(20),'operationId',public.fixture_form_id(150),'expectedRevision',1)||patch);
$$;
do $$ begin
 if pg_temp.recovery('recoverable_forms')->'forms'<>'[]'::jsonb then raise exception 'Active manager recoverable'; end if;
 begin perform pg_temp.recovery('recover_form'); raise exception 'Active manager taken over'; exception when insufficient_privilege then null; end;
 begin perform public.fixture_form_command('responses',1); raise exception 'Automatic owner response access'; exception when insufficient_privilege then null; end;
end $$;
update public.organization_memberships set role='member' where org_id=public.fixture_form_id(1) and member_id=public.fixture_form_id(4);
do $$ declare candidates jsonb; begin
 candidates:=pg_temp.recovery('recoverable_forms');
 if candidates#>>'{forms,0,id}'<>public.fixture_form_id(20)::text or candidates#>>'{forms,0,revision}'<>'1' then raise exception 'Unavailable recovery'; end if;
 if pg_temp.recovery('recoverable_forms',3)->'forms'<>'[]'::jsonb or pg_temp.recovery('recoverable_forms',2)->'forms'<>'[]'::jsonb then raise exception 'Neighbor metadata leaked'; end if;
 begin perform pg_temp.recovery('recover_form',3); raise exception 'Admin took over'; exception when insufficient_privilege then null; end;
 begin perform pg_temp.recovery('recover_form',2); raise exception 'Foreign owner took over'; exception when insufficient_privilege then null; end;
 begin perform pg_temp.recovery('recover_form',1,jsonb_build_object('formId',public.fixture_form_id(21))); raise exception 'Unrelated form recovered'; exception when insufficient_privilege then null; end;
 begin perform pg_temp.recovery('recover_form',1,'{"expectedRevision":2}'); raise exception 'Stale recovery accepted'; exception when serialization_failure then null; end;
 begin perform public.fixture_form_command('responses',4); raise exception 'Removed manager retained answers'; exception when insufficient_privilege then null; end;
end $$;
select pg_temp.recovery('recover_form');
select pg_temp.recovery('recover_form');
select public.fixture_form_command('responses',1);
select public.fixture_form_command('correct',1);
select public.fixture_form_command('submit');
do $$ begin
 if (select count(*) from public.organization_form_recoveries)<>1
   or (select manager_revision from public.organization_forms)<>2
   or (select creator_id from public.organization_forms)<>public.fixture_form_id(4)
   or (select intake_manager from public.organization_forms)<>public.fixture_form_id(1)
   or (select count(*) from public.organization_form_responses)<>1 then raise exception 'Recovery identity or answers damaged'; end if;
 begin perform pg_temp.recovery('recover_form',1,'{"expectedRevision":2}'); raise exception 'Operation reused'; exception when unique_violation then null; end;
 begin perform pg_temp.recovery('recover_form',1,jsonb_build_object('operationId',public.fixture_form_id(151))); raise exception 'Stale operation accepted'; exception when serialization_failure then null; end;
 if pg_temp.recovery('recoverable_forms')->'forms'<>'[]'::jsonb then raise exception 'Recovered form still listed'; end if;
end $$;
-- Rejoining does not restore the old manager. The creator remains provenance, not a grant.
update public.organization_memberships set role='staff' where org_id=public.fixture_form_id(1) and member_id=public.fixture_form_id(4);
do $$ begin
 begin perform public.fixture_form_command('responses',4); raise exception 'Rejoining restored manager'; exception when insufficient_privilege then null; end;
 begin perform public.fixture_form_publish(1,'publish',81,4); raise exception 'Former manager republished'; exception when insufficient_privilege then null; end;
 if has_table_privilege('service_role','public.organization_form_recoveries','SELECT')
 or has_function_privilege('authenticated','public.organization_form_recovery(uuid,jsonb)','EXECUTE')
 or has_function_privilege('anon','public.organization_form_recovery(uuid,jsonb)','EXECUTE') then raise exception 'Recovery bypass exposed'; end if;
end $$;
select public.fixture_form_publish(1,'publish',81,1);
rollback;
