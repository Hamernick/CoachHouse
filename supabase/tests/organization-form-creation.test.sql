\set ON_ERROR_STOP on
begin;
-- Use a real SET ROLE session; a forged updated_by cannot claim another creator.
grant select,update,delete on public.organization_workspace_boards to authenticated;
select set_config('request.jwt.claim.sub',public.fixture_form_id(4)::text,true);
set local role authenticated;
update public.organization_workspace_boards set updated_by=public.fixture_form_id(1),state=jsonb_build_object('particleGraph',jsonb_build_object('particles',jsonb_build_array(
 jsonb_build_object('id',public.fixture_form_id(20),'type','activity','title','Sign up','data',jsonb_build_object('widget',jsonb_build_object('kind','form','definition',
 jsonb_build_object('questions',jsonb_build_array(jsonb_build_object('id',public.fixture_form_id(90),'type','text','label','Name','required',true)))))))));
reset role;
do $$ begin
 if (select creator_id from public.organization_forms where id=public.fixture_form_id(20))<>public.fixture_form_id(4)
   or (select intake_manager from public.organization_forms where id=public.fixture_form_id(20))<>public.fixture_form_id(4) then
   raise exception 'Authenticated actor was not attributed'; end if;
end $$;
-- Creator can publish, immediately read/correct responses, and keep ownership through retries.
select public.fixture_form_publish(0,'publish',80,4);
select public.fixture_form_command('submit');
select public.fixture_form_command('responses',4);
select public.fixture_form_command('correct',4,jsonb_build_object('hash',repeat('b',64),'answers',jsonb_build_array(jsonb_build_object('questionId',public.fixture_form_id(90),'value','Joanne'))));
select public.fixture_form_command('submit');
do $$ begin
 if (select revision from public.organization_form_responses)<>2 then raise exception 'Retry replaced correction'; end if;
 begin perform public.fixture_form_publish(1,'publish',81,1); raise exception 'Owner stole publication';
   exception when insufficient_privilege then null; end;
 begin perform public.fixture_form_command('responses',1); raise exception 'Owner stole responses';
   exception when insufficient_privilege then null; end;
 if (select revision from public.organization_workspace_pages)<>1 then raise exception 'Denied publication partially committed'; end if;
end $$;
-- Other organization editors can move the form, but not change its content, delete it,
-- convert it, or erase its containing canvas. Metadata cannot grant permissions.
select set_config('request.jwt.claim.sub',public.fixture_form_id(3)::text,true);
set local role authenticated;
update public.organization_workspace_boards set updated_by=public.fixture_form_id(4),state=jsonb_set(state,'{particleGraph,particles,0,position}','{"x":200,"y":100}');
do $$ begin
 begin update public.organization_workspace_boards set state=jsonb_set(state,'{particleGraph,particles,0,title}','"Hijacked"');
   raise exception 'Content guard bypassed'; exception when insufficient_privilege then null; end;
 begin update public.organization_workspace_boards set state='{}'; raise exception 'Board replacement bypassed'; exception when insufficient_privilege then null; end;
 begin delete from public.organization_workspace_boards; raise exception 'Board deletion bypassed'; exception when insufficient_privilege then null; end;
 begin update public.organization_workspace_boards set state=jsonb_set(state,'{particleGraph,particles}',jsonb_build_array(
   jsonb_set(state#>'{particleGraph,particles,0}','{id}',to_jsonb(public.fixture_form_id(19)))));
   raise exception 'Partial batch accepted'; exception when insufficient_privilege then null; end;
 begin update public.organization_workspace_boards set state=jsonb_set(state,'{particleGraph,particles,0,data,widget,kind}','"note"');
   raise exception 'Type conversion bypassed'; exception when insufficient_privilege then null; end;
 begin update public.organization_workspace_boards set state=jsonb_set(state,'{particleGraph,particles,0,data,source}','{"kind":"activity","id":"10000000-0000-4000-8000-000000000099"}');
   raise exception 'Source redirection bypassed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
 if exists(select 1 from public.organization_forms where id=public.fixture_form_id(19)) then
   raise exception 'Denied batch left an orphan creator'; end if;
end $$;
-- Service-role writes need an explicit, current authorized actor; they are not a bypass.
set local role service_role;
do $$ begin
 begin update public.organization_workspace_boards set updated_by=null,state=jsonb_set(state,'{particleGraph,particles,0,title}','"No actor"');
   raise exception 'Missing actor bypassed'; exception when insufficient_privilege then null; end;
 begin update public.organization_workspace_boards set updated_by=public.fixture_form_id(2),state=jsonb_set(state,'{particleGraph,particles,0,title}','"Foreign actor"');
   raise exception 'Foreign actor bypassed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
-- Named-canvas creation is attributed separately, equal placements do not transfer it.
select set_config('request.jwt.claim.sub',public.fixture_form_id(3)::text,true);
set local role authenticated;
update public.organization_workspace_boards set state=state||jsonb_build_object('workspaceCatalog',jsonb_build_object('entries',jsonb_build_array(
 jsonb_build_object('id',public.fixture_form_id(40),'state',jsonb_build_object('particleGraph',jsonb_build_object('particles',jsonb_build_array(
 jsonb_set(state#>'{particleGraph,particles,0}','{id}',to_jsonb(public.fixture_form_id(30))),state#>'{particleGraph,particles,0}')))))));
reset role;
do $$ begin
 if (select creator_id from public.organization_forms where id=public.fixture_form_id(30))<>public.fixture_form_id(3)
 or (select creator_id from public.organization_forms where id=public.fixture_form_id(20))<>public.fixture_form_id(4) then
 raise exception 'Named canvas attribution changed'; end if;
end $$;
select set_config('request.jwt.claim.sub',public.fixture_form_id(4)::text,true);
set local role authenticated;
do $$ begin
 begin update public.organization_workspace_boards set state=jsonb_set(state,'{workspaceCatalog,entries,0,state,particleGraph,particles,1,title}','"Conflicting copy"');
   raise exception 'Ambiguous identity accepted'; exception when invalid_parameter_value then null; end;
 begin update public.organization_workspace_boards set state=state-'workspaceCatalog';
   raise exception 'Other creator canvas deleted'; exception when insufficient_privilege then null; end;
end $$;
-- Deleting every placement of own form retains canonical ownership and existing responses.
update public.organization_workspace_boards set state=jsonb_set(jsonb_set(state,'{particleGraph,particles}','[]'),
 '{workspaceCatalog,entries,0,state,particleGraph,particles}',jsonb_build_array(state#>'{workspaceCatalog,entries,0,state,particleGraph,particles,0}'));
reset role;
select public.fixture_form_command('responses',4);
do $$ begin
 if (select count(*) from public.organization_form_responses)<>1 then raise exception 'Source deletion deleted answers'; end if;
end $$;
select set_config('request.jwt.claim.sub',public.fixture_form_id(3)::text,true);
set local role authenticated;
do $$ begin
 begin update public.organization_workspace_boards set state=jsonb_set(state,'{particleGraph,particles}',jsonb_build_array(
   jsonb_set(state#>'{workspaceCatalog,entries,0,state,particleGraph,particles,0}','{id}',to_jsonb(public.fixture_form_id(20)))));
   raise exception 'Deleted identity takeover'; exception when insufficient_privilege then null; end;
end $$;
reset role;
-- Removed membership removes both source and response authority; creator identity remains historical.
delete from public.organization_memberships where member_id=public.fixture_form_id(4);
do $$ begin
 begin perform public.fixture_form_command('responses',4); raise exception 'Removed creator retained access'; exception when insufficient_privilege then null; end;
 if (select creator_id from public.organization_forms where id=public.fixture_form_id(20))<>public.fixture_form_id(4) then raise exception 'Attribution lost'; end if;
 if has_function_privilege('authenticated','public.guard_workspace_form_sources()','execute')
   or has_function_privilege('service_role','public.workspace_form_sources(jsonb)','execute')
   or has_table_privilege('authenticated','public.organization_forms','update') then raise exception 'Private helper exposed'; end if;
end $$;
rollback;
