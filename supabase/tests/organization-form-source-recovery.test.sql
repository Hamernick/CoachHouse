\set ON_ERROR_STOP on
begin;
do $$ begin
 if current_setting('coach_house.workspace_sharing_fixture',true) is distinct from 'isolated-test-only' then raise exception 'Fixture required'; end if;
end $$;
update public.organization_workspace_boards set state='{}',updated_by=public.fixture_form_id(1);
truncate public.organization_forms cascade;
delete from public.organization_workspace_pages;
update public.organization_workspace_boards set updated_by=public.fixture_form_id(4),state=jsonb_build_object('particleGraph',jsonb_build_object('particles',jsonb_build_array(
 jsonb_build_object('id',public.fixture_form_id(20),'type','activity','title','Private draft','data',jsonb_build_object('widget',jsonb_build_object('kind','form','definition',
 jsonb_build_object('questions',jsonb_build_array(jsonb_build_object('id',public.fixture_form_id(90),'type','text','label','Name','required',true)))))))));
create function pg_temp.recover_source(action text, actor integer default 1, patch jsonb default '{}') returns jsonb language sql as $$
 select public.organization_form_recovery(public.fixture_form_id(actor),jsonb_build_object('action',action,
 'organizationId',public.fixture_form_id(1),'formId',public.fixture_form_id(20),'operationId',public.fixture_form_id(450),'expectedRevision',1)||patch);
$$;
do $$ begin
 if pg_temp.recover_source('recoverable_forms')->'forms'<>'[]'::jsonb then raise exception 'Active manager listed'; end if;
 begin perform pg_temp.recover_source('recover_form'); raise exception 'Active manager recovered'; exception when insufficient_privilege then null; end;
 begin perform pg_temp.recover_source('recover_form',1,jsonb_build_object('pageId',public.fixture_form_id(10))); raise exception 'Ambiguous target accepted'; exception when invalid_parameter_value then null; end;
end $$;
update public.organization_memberships set role='member' where org_id=public.fixture_form_id(1) and member_id=public.fixture_form_id(4);
do $$ declare result jsonb; begin
 result:=pg_temp.recover_source('recoverable_forms');
 if result#>>'{forms,0,title}'<>'Private draft' or jsonb_array_length(result->'forms')<>1 then raise exception 'Missing source recovery'; end if;
 if pg_temp.recover_source('recoverable_forms',3)->'forms'<>'[]'::jsonb or pg_temp.recover_source('recoverable_forms',2)->'forms'<>'[]'::jsonb then raise exception 'Recovery metadata leaked'; end if;
 begin perform pg_temp.recover_source('recover_form',3); raise exception 'Admin takeover'; exception when insufficient_privilege then null; end;
 begin perform pg_temp.recover_source('recover_form',2); raise exception 'Cross-org takeover'; exception when insufficient_privilege then null; end;
 begin perform pg_temp.recover_source('recover_form',1,jsonb_build_object('formId',public.fixture_form_id(99))); raise exception 'Invented form recovered'; exception when insufficient_privilege then null; end;
 begin perform pg_temp.recover_source('recover_form',1,'{"expectedRevision":2}'); raise exception 'Stale recovery'; exception when serialization_failure then null; end;
 -- A retained canonical form without a board source cannot be taken over by this entry.
 insert into public.organization_forms(org_id,id,intake_manager) values(public.fixture_form_id(1),public.fixture_form_id(99),public.fixture_form_id(4));
 begin perform pg_temp.recover_source('recover_form',1,jsonb_build_object('formId',public.fixture_form_id(99))); raise exception 'Deleted source recovered'; exception when insufficient_privilege then null; end;
end $$;
select pg_temp.recover_source('recover_form');
select pg_temp.recover_source('recover_form');
update public.organization_workspace_boards set updated_by=public.fixture_form_id(1),state=jsonb_set(state,'{particleGraph,particles,0,title}','"Recovered draft"');
update public.organization_memberships set role='staff' where org_id=public.fixture_form_id(1) and member_id=public.fixture_form_id(4);
do $$ begin
 if (select creator_id from public.organization_forms where id=public.fixture_form_id(20))<>public.fixture_form_id(4)
 or (select intake_manager from public.organization_forms where id=public.fixture_form_id(20))<>public.fixture_form_id(1)
 or (select count(*) from public.organization_form_recoveries)<>1
 or exists(select 1 from public.organization_form_recoveries where page_id is not null)
 or exists(select 1 from public.organization_form_versions) or exists(select 1 from public.organization_workspace_pages)
 or exists(select 1 from public.organization_form_responses) then raise exception 'Recovery changed unrelated state'; end if;
 begin update public.organization_workspace_boards set updated_by=public.fixture_form_id(4),state=jsonb_set(state,'{particleGraph,particles,0,title}','"Old manager"'); raise exception 'Rejoin regained control'; exception when insufficient_privilege then null; end;
 begin perform pg_temp.recover_source('recover_form',1,'{"expectedRevision":2}'); raise exception 'Changed replay accepted'; exception when unique_violation then null; end;
 if pg_temp.recover_source('recoverable_forms')->'forms'<>'[]'::jsonb then raise exception 'Recovered still listed'; end if;
end $$;
rollback;
