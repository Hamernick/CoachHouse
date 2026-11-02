\set ON_ERROR_STOP on
begin;
select public.fixture_form_publish(0);
select public.fixture_form_command('submit');
select public.fixture_form_command('correct',1,jsonb_build_object('hash',repeat('c',64),'answers',jsonb_build_array(jsonb_build_object('questionId',public.fixture_form_id(90),'value','Joanne'))));
do $$ declare command jsonb; receipt jsonb; actual jsonb; actor integer; begin
 command:=jsonb_build_object('action','delete_response','versionId',public.fixture_form_id(80),'id',public.fixture_form_id(91),'expectedRevision',2,'operationId',public.fixture_form_id(500));
 -- A scoped Manage grant is deliberately not deletion authority.
 perform public.organization_form_review_access(public.fixture_form_id(1),jsonb_build_object('action','grant_reviewer','versionId',public.fixture_form_id(80),'email','person3@example.org','role','manage','expectedRevision',1,'operationId',public.fixture_form_id(501)));
 foreach actor in array array[2,3,7] loop
   begin perform public.organization_form_intake(public.fixture_form_id(actor),command); raise exception 'Unauthorized deletion'; exception when insufficient_privilege then null; end;
 end loop;
 begin perform public.organization_form_intake(null,command); raise exception 'Anonymous deletion'; exception when insufficient_privilege then null; end;
 if public.fixture_form_command('responses',3)#>>'{permissions,canDelete}'<>'false' then raise exception 'Delegate delete affordance'; end if;
 if public.fixture_form_command('responses',1)#>>'{permissions,canDelete}'<>'true' then raise exception 'Primary missing affordance'; end if;
 begin perform public.organization_form_intake(public.fixture_form_id(1),command||'{"expectedRevision":1}'); raise exception 'Stale deletion'; exception when serialization_failure then null; end;
 receipt:=public.organization_form_intake(public.fixture_form_id(1),command);
 if receipt is distinct from public.organization_form_intake(public.fixture_form_id(1),command) then raise exception 'Unstable deletion receipt'; end if;
 if exists(select 1 from public.organization_form_responses) or exists(select 1 from public.organization_form_corrections) then raise exception 'Answer/correction survived'; end if;
 if jsonb_array_length(public.fixture_form_command('responses',1)->'responses')<>0 then raise exception 'Deleted answer readable'; end if;
 begin perform public.fixture_form_command('response',1); raise exception 'Deleted direct read'; exception when insufficient_privilege then null; end;
 begin perform public.fixture_form_command('correct',1); raise exception 'Deleted correction retry'; exception when insufficient_privilege then null; end;
 begin perform public.fixture_form_command('submit'); raise exception 'Deleted submission resurrected'; exception when no_data_found then null; end;
 begin perform public.fixture_form_command('submit',null,jsonb_build_object('hash',repeat('d',64))); raise exception 'Changed submission resurrected'; exception when no_data_found then null; end;
 begin perform public.organization_form_intake(public.fixture_form_id(1),command||jsonb_build_object('operationId',public.fixture_form_id(502))); raise exception 'New deletion identity reused'; exception when unique_violation then null; end;
 begin perform public.organization_form_intake(public.fixture_form_id(1),command||'{"expectedRevision":3}'); raise exception 'Changed deletion replay'; exception when unique_violation then null; end;
 -- A deleted row can still locate an existing older page without answer content.
 insert into public.organization_form_responses(version_id,id,original_hash,answers,submitted_at)
   values(public.fixture_form_id(80),public.fixture_form_id(92),repeat('f',64),'[]',clock_timestamp()-interval '1 day');
 actual:=public.fixture_form_command('responses',1,jsonb_build_object('before',public.fixture_form_id(91)));
 if actual#>>'{responses,0,id}'<>public.fixture_form_id(92)::text then raise exception 'Deleted cursor lost older responses'; end if;
 if (select count(*) from public.organization_form_response_deletions)<>1 then raise exception 'Duplicate suppression'; end if;
 if exists(select 1 from information_schema.columns where table_name='organization_form_response_deletions' and column_name in ('answers','original_hash','email','name')) then raise exception 'Deletion retained respondent content'; end if;
 if has_table_privilege('anon','public.organization_form_response_deletions','select') or has_table_privilege('authenticated','public.organization_form_response_deletions','delete') or has_table_privilege('service_role','public.organization_form_response_deletions','insert') then raise exception 'Direct suppression access'; end if;
 if not (select relrowsecurity from pg_class where oid='public.organization_form_response_deletions'::regclass) then raise exception 'RLS disabled'; end if;
 -- Deletion must not free a rate-limit slot for another new admission.
 insert into public.organization_form_responses(version_id,id,original_hash,answers)
 select public.fixture_form_id(80),public.fixture_form_id(n),repeat('e',64),'[]' from generate_series(200,258) n;
 begin perform public.fixture_form_command('submit',null,jsonb_build_object('id',public.fixture_form_id(259))); raise exception 'Deletion bypassed rate cap'; exception when program_limit_exceeded then null; end;
 -- Replaced primary authority is rechecked even for an exact deletion retry.
 update public.organization_forms set intake_manager=public.fixture_form_id(3),manager_revision=manager_revision+1;
 begin perform public.organization_form_intake(public.fixture_form_id(1),command); raise exception 'Former manager replay'; exception when insufficient_privilege then null; end;
end $$;
rollback;
