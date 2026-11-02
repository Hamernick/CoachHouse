\set ON_ERROR_STOP on
begin;
select public.fixture_form_publish(0);
select public.fixture_form_command('submit');
select public.fixture_form_command('submit');
do $$ declare r jsonb; begin
 if (select count(*) from public.organization_form_responses)<>1 then raise exception 'Duplicate submission'; end if;
 r:=public.fixture_form_command('responses',1);
 if r#>>'{responses,0,answers,0,value}'<>'Joan' then raise exception 'Independent response readback'; end if;
 insert into public.organization_form_responses(version_id,id,original_hash,answers)
   select public.fixture_form_id(80),public.fixture_form_id(n),repeat('b',64),'[]'::jsonb from generate_series(200,258) n;
 begin perform public.fixture_form_command('submit',null,jsonb_build_object('id',public.fixture_form_id(259)));
   raise exception 'Rate limit bypass'; exception when program_limit_exceeded then null; end;
 perform public.fixture_form_command('submit');
 delete from public.organization_form_responses where id<>public.fixture_form_id(91);

 begin perform public.fixture_form_command('submit',null,jsonb_build_object('hash',repeat('b',64)));
   raise exception 'Expected reused ID rejection'; exception when unique_violation then null; end;
 begin perform public.fixture_form_command('responses',null); raise exception 'Anonymous read leaked'; exception when insufficient_privilege then null; end;
 begin perform public.fixture_form_command('responses',2); raise exception 'Cross tenant read leaked'; exception when insufficient_privilege then null; end;
 begin perform public.fixture_form_command('responses',3); raise exception 'Organization role implicitly granted responses'; exception when insufficient_privilege then null; end;
 begin perform public.fixture_form_publish(1,'publish',81,1,true); raise exception 'Tampered version accepted'; exception when invalid_parameter_value then null; end;
 if (select revision from public.organization_workspace_pages limit 1)<>1 then raise exception 'Failed publication leaked'; end if;
end $$;
select public.fixture_form_command('correct',1,jsonb_build_object('hash',repeat('c',64),'answers',jsonb_build_array(jsonb_build_object('questionId',public.fixture_form_id(90),'value','Joanne'))));
select public.fixture_form_command('submit');
select public.fixture_form_command('correct',1,jsonb_build_object('hash',repeat('c',64),'answers',jsonb_build_array(jsonb_build_object('questionId',public.fixture_form_id(90),'value','Joanne'))));
do $$ begin
 if (select answers->0->>'value' from public.organization_form_responses)<>'Joanne' or (select revision from public.organization_form_responses)<>2 then raise exception 'Retry restored original or repeated correction'; end if;
 if (select count(*) from public.organization_form_corrections)<>1 then raise exception 'Duplicate correction audit'; end if;
 begin perform public.fixture_form_command('correct',1,jsonb_build_object('operationId',public.fixture_form_id(93))); raise exception 'Stale correction accepted'; exception when serialization_failure then null; end;
end $$;
select public.fixture_form_publish(1,'publish',81);
do $$ begin
 begin perform public.fixture_form_command('submit'); raise exception 'Old version accepted'; exception when insufficient_privilege then null; end;
 if public.fixture_form_command('responses',1)#>>'{responses,0,answers,0,value}'<>'Joanne' then raise exception 'Republish lost historical answers'; end if;
 if jsonb_array_length(public.list_organization_form_versions(public.fixture_form_id(1),public.fixture_form_id(10))->'versions')<>2 then raise exception 'History undiscoverable'; end if;
 if jsonb_array_length(public.list_organization_form_versions(public.fixture_form_id(3),public.fixture_form_id(10))->'versions')<>0 then raise exception 'History leaked'; end if;
 begin perform public.fixture_form_publish(2,'publish',82,3); raise exception 'Teammate gained intake management'; exception when insufficient_privilege then null; end;
end $$;
select public.fixture_form_publish(2,'make_private',82);
do $$ begin
 begin perform public.fixture_form_command('version',null,jsonb_build_object('versionId',public.fixture_form_id(81))); raise exception 'Revoked intake visible'; exception when insufficient_privilege then null; end;
 if not exists(select 1 from public.organization_form_responses) then raise exception 'Revocation deleted responses'; end if;
 if has_table_privilege('anon','public.organization_form_responses','select')
   or has_table_privilege('authenticated','public.organization_form_responses','update')
   or has_function_privilege('authenticated','public.organization_form_intake(uuid,jsonb)','execute')
   or has_function_privilege('service_role','public.commit_workspace_page_with_assets(uuid,uuid,uuid,uuid,text,integer,text,jsonb,jsonb,jsonb,timestamptz,jsonb,jsonb,uuid,jsonb,jsonb)','execute') then raise exception 'Direct access bypass'; end if;
end $$;
rollback;

-- Invited viewers may submit; a page edit grant still grants no response reads.
begin;
select public.fixture_form_publish(0,'share_with_guests');
select public.workspace_page_guest_command(public.fixture_form_id(1),public.fixture_form_id(10),
 jsonb_build_object('action','invite','operationId',public.fixture_form_id(300),'invitationId',public.fixture_form_id(301),'permission','edit','email','person7@example.org'),repeat('d',64));
select public.workspace_page_guest_command(public.fixture_form_id(7),public.fixture_form_id(10),
 jsonb_build_object('action','accept','invitationId',public.fixture_form_id(301)),null);
do $$ begin
 begin perform public.fixture_form_command('submit'); raise exception 'Private form accepted public submission'; exception when insufficient_privilege then null; end;
 perform public.fixture_form_command('submit',7,'{"audience":"guest"}');
 begin perform public.fixture_form_command('responses',7); raise exception 'Page editor accessed responses'; exception when insufficient_privilege then null; end;
end $$;
select public.workspace_page_guest_command(public.fixture_form_id(1),public.fixture_form_id(10),
 jsonb_build_object('action','revoke','operationId',public.fixture_form_id(302),'invitationId',public.fixture_form_id(301)),repeat('e',64));
do $$ begin
 begin perform public.fixture_form_command('submit',7,'{"audience":"guest"}'); raise exception 'Revoked guest retried'; exception when insufficient_privilege then null; end;
 if (select count(*) from public.organization_form_responses)<>1 then raise exception 'Guest response lost'; end if;
end $$;
rollback;
