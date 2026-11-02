\set ON_ERROR_STOP on
begin;
select public.fixture_form_publish(0);
select public.fixture_form_command('submit');

do $$ declare initial jsonb; closed jsonb; current_status jsonb; result jsonb; op integer; role_name text;
begin
 initial:=public.fixture_closure('status');
 if initial->>'state'<>'active' or initial->>'revision'<>'0' then raise exception 'Initial state incorrect'; end if;
 if exists(select 1 from public.organization_closures) then raise exception 'Status mutated state'; end if;
 begin perform public.fixture_closure('request',600,0,3); raise exception 'Member closed organization'; exception when insufficient_privilege then null; end;
 begin perform public.fixture_closure('request',600,0,null); raise exception 'Anonymous closed organization'; exception when insufficient_privilege then null; end;
 begin perform public.fixture_closure('request',600,0,1,2); raise exception 'Cross organization close'; exception when insufficient_privilege then null; end;
 begin perform public.fixture_closure('request',600,0,999,999); raise exception 'Missing organization closed'; exception when insufficient_privilege then null; end;
 begin perform public.fixture_closure('unknown',600,0); raise exception 'Unknown action'; exception when invalid_parameter_value then null; end;
 begin perform public.fixture_closure('request',null,0); raise exception 'Missing operation'; exception when invalid_parameter_value then null; end;
 begin perform public.fixture_closure('request',600,null); raise exception 'Missing revision'; exception when invalid_parameter_value then null; end;
 begin perform public.fixture_closure('request',600,-1); raise exception 'Negative revision'; exception when invalid_parameter_value then null; end;
 begin perform public.fixture_closure('status',600,0); raise exception 'Status with mutation identity'; exception when invalid_parameter_value then null; end;
 begin perform public.fixture_closure('request',600,1); raise exception 'Stale revision'; exception when serialization_failure then null; end;
 closed:=public.fixture_closure('request',600,0);
 if closed->>'state'<>'closing' or closed->>'revision'<>'1'
   or (closed->>'exportUntil')::timestamptz-(closed->>'requestedAt')::timestamptz<>interval '720 hours'
   then raise exception 'Closure deadline incorrect'; end if;
 if closed is distinct from public.fixture_closure('request',600,0) then raise exception 'Request retry changed deadline'; end if;
 begin perform public.fixture_closure('request',601,1); raise exception 'Closure extended'; exception when serialization_failure then null; end;
 begin perform public.fixture_closure('cancel',600,0); raise exception 'Operation reused'; exception when unique_violation then null; end;
 begin perform public.fixture_closure('request',600,1); raise exception 'Revision reused'; exception when unique_violation then null; end;
 begin perform public.fixture_closure('request',600,0,3); raise exception 'Retry bypassed owner'; exception when insufficient_privilege then null; end;
 if public.fixture_closure('status',null,null,2,2)->>'state'<>'active' then raise exception 'Other organization changed'; end if;
 -- Actual canonical endpoint, not a mock permission function.
 begin perform public.fixture_form_command('version'); raise exception 'Public form still open'; exception when insufficient_privilege then null; end;
 begin perform public.fixture_form_command('submit'); raise exception 'Submission replay bypassed fence'; exception when insufficient_privilege then null; end;
 begin perform public.fixture_form_command('correct',1); raise exception 'Correction bypassed fence'; exception when insufficient_privilege then null; end;
 begin perform public.fixture_form_command('delete_response',1); raise exception 'Deletion bypassed fence'; exception when insufficient_privilege then null; end;
 begin perform public.fixture_form_command('responses',2); raise exception 'Closure expanded data permission'; exception when insufficient_privilege then null; end;
 result:=public.fixture_form_command('responses',1);
 if result#>>'{responses,0,answers,0,value}'<>'Joan' then raise exception 'Authorized export lost answers'; end if;
 if exists(select 1 from jsonb_each(result->'permissions') p where p.value<>'false'::jsonb) then raise exception 'Mutation affordance survived'; end if;
 if public.fixture_form_command('response',1)->>'id'<>public.fixture_form_id(91)::text then raise exception 'Authorized individual read blocked'; end if;
 -- Owner without form authority still cannot read/export answers during closure.
 update public.organization_forms set intake_manager=public.fixture_form_id(3),manager_revision=manager_revision+1;
 begin perform public.fixture_form_command('responses',1); raise exception 'Ownership granted response access'; exception when insufficient_privilege then null; end;
 update public.organization_forms set intake_manager=public.fixture_form_id(1),manager_revision=manager_revision+1;
 -- Simulate independently revoked publication; cancel must not restore it.
 update public.organization_workspace_pages set visibility='private';
 current_status:=public.fixture_closure('cancel',602,1);
 if current_status->>'state'<>'active' or current_status->>'revision'<>'2' or current_status->>'exportUntil' is not null then raise exception 'Cancel incorrect'; end if;
 if (select visibility from public.organization_workspace_pages limit 1)<>'private' then raise exception 'Cancel republished'; end if;
 if public.fixture_closure('request',600,0) is distinct from current_status then raise exception 'Old request reclosed'; end if;
 if public.fixture_closure('cancel',602,1) is distinct from current_status then raise exception 'Cancel replay changed state'; end if;
 closed:=public.fixture_closure('request',603,2);
 if closed->>'revision'<>'3' then raise exception 'Reclose revision incorrect'; end if;
 if public.fixture_closure('cancel',602,1) is distinct from closed then raise exception 'Old cancel canceled new request'; end if;
 if (select count(*) from public.organization_closure_operations)<>3 then raise exception 'Duplicate operation'; end if;
 -- Expiry uses wall-clock time; no cleanup worker or export attempt extends it.
 update public.organization_closures set requested_at=statement_timestamp()-interval '721 hours',export_until=statement_timestamp()-interval '1 hour';
 begin perform public.fixture_form_command('responses',1); raise exception 'Expired export allowed'; exception when insufficient_privilege then null; end;
 begin perform public.fixture_form_command('response',1); raise exception 'Expired direct read allowed'; exception when insufficient_privilege then null; end;
 begin perform public.fixture_form_command('editor_version',1); raise exception 'Expired version read allowed'; exception when insufficient_privilege then null; end;
 begin perform public.fixture_closure('cancel',604,3); raise exception 'Expired cancel allowed'; exception when insufficient_privilege then null; end;
 if not exists(select 1 from public.organization_form_responses) then raise exception 'Expiry erased data without cleanup'; end if;
 if (select count(*) from public.organization_closure_operations)<>3 then raise exception 'Failed command wrote receipt'; end if;
 -- Direct API roles cannot activate an incomplete closure implementation or bypass it.
 foreach role_name in array array['anon','authenticated','service_role'] loop
   if has_function_privilege(role_name,'public.organization_closure_command(uuid,uuid,text,uuid,integer)','EXECUTE')
     or has_function_privilege(role_name,'public.organization_form_intake_before_closure(uuid,jsonb)','EXECUTE')
     or has_function_privilege(role_name,'public.guard_organization_closure(uuid,boolean)','EXECUTE')
     or has_table_privilege(role_name,'public.organization_closures','SELECT,INSERT,UPDATE,DELETE')
     or has_table_privilege(role_name,'public.organization_closure_operations','SELECT,INSERT,UPDATE,DELETE')
     then raise exception 'Direct closure privilege: %',role_name; end if;
 end loop;
 if not has_function_privilege('service_role','public.organization_form_intake(uuid,jsonb)','EXECUTE') then raise exception 'App intake missing'; end if;
 if (select count(*) from pg_class where oid in ('public.organization_closures'::regclass,'public.organization_closure_operations'::regclass) and relrowsecurity)<>2 then raise exception 'Missing RLS'; end if;
 begin update public.organization_closures set export_until=null; raise exception 'Null closing deadline'; exception when check_violation then null; end;
end $$;
rollback;
