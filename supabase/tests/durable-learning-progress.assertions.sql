begin;
alter table public.module_progress alter column status set default 'not_started';
set request.jwt.claim.role='authenticated';
set request.jwt.claim.sub='77000000-0000-0000-0000-000000000003';
set request.headers='{}';
insert into public.module_progress(user_id,module_id,status,notes) values
 ('77000000-0000-0000-0000-000000000003','79000000-0000-0000-0000-000000000001','completed','{"content":"Original","format":"markdown"}');
set role authenticated;
do $$ declare a jsonb; b jsonb; result jsonb; begin
 a := public.record_module_step(auth.uid(),'79000000-0000-0000-0000-000000000001','video');
 b := public.record_module_step(auth.uid(),'79000000-0000-0000-0000-000000000001','assignment:section-1');
 if not (b->'completed' ?& array['video','assignment:section-1']) then raise exception 'step merge lost earlier progress'; end if;
 b := public.record_module_step(auth.uid(),'79000000-0000-0000-0000-000000000001','video');
 if a->'completed'->'video' is distinct from b->'completed'->'video' then raise exception 'duplicate changed completion metadata'; end if;
 if b->'completed'->'video'->>'actorId' <> auth.uid()::text then raise exception 'wrong actor'; end if;
 if (select status from public.module_progress where user_id=auth.uid()) <> 'completed' then raise exception 'step changed status'; end if;
 if (select notes->>'content' from public.module_progress where user_id=auth.uid()) <> 'Original' then raise exception 'step changed notes'; end if;
 result := public.save_module_notes_if_current(auth.uid(),'79000000-0000-0000-0000-000000000001','{"content":"New","format":"markdown"}','{"content":"Original","format":"markdown"}');
 if result->>'ok' <> 'true' then raise exception 'current notes could not save after step write'; end if;
 result := public.save_module_notes_if_current(auth.uid(),'79000000-0000-0000-0000-000000000001','{"content":"New","format":"markdown"}','{"content":"Original","format":"markdown"}');
 if result->>'ok' <> 'true' then raise exception 'duplicate save is not idempotent'; end if;
 result := public.save_module_notes_if_current(auth.uid(),'79000000-0000-0000-0000-000000000001','{"content":"Stale"}','{"content":"Original","format":"markdown"}');
 if result->>'ok' <> 'false' then raise exception 'stale notes overwritten'; end if;
 if (select notes->>'content' from public.module_progress where user_id=auth.uid()) <> 'New' then raise exception 'stale notes not preserved'; end if;
 if (select step_progress from public.module_progress where user_id=auth.uid()) is distinct from b then raise exception 'notes changed steps'; end if;
 result := public.save_module_notes_if_current(auth.uid(),'79000000-0000-0000-0000-000000000002','{"content":"Missing"}','{"content":"Deleted"}');
 if result->>'ok' <> 'false' then raise exception 'deleted notes resurrected from stale baseline'; end if;
 result := public.save_module_notes_if_current(auth.uid(),'79000000-0000-0000-0000-000000000002','{"content":"First"}',null);
 if result->>'ok' <> 'true' then raise exception 'first note failed'; end if;
 perform public.record_module_step(auth.uid(),'79000000-0000-0000-0000-000000000003','video');
 if (select status from public.module_progress where user_id=auth.uid() and module_id='79000000-0000-0000-0000-000000000003') <> 'not_started' then raise exception 'partial step promoted whole module'; end if;
 begin
  perform public.record_module_step('77000000-0000-0000-0000-000000000002','79000000-0000-0000-0000-000000000001','video');
  raise exception 'cross learner write allowed';
 exception when insufficient_privilege then null; end;
 begin
  perform public.save_module_notes_if_current('77000000-0000-0000-0000-000000000002','79000000-0000-0000-0000-000000000001','"bad"',null);
  raise exception 'cross learner notes allowed';
 exception when insufficient_privilege then null; end;
 begin
  perform public.record_module_step(auth.uid(),'79000000-0000-0000-0000-000000000001','complete');
  raise exception 'whole module completion accepted as partial step';
 exception when invalid_parameter_value then null; end;
end $$;
reset role;
-- Support requires a current grant, the selected organization, and live presence.
insert into public.platform_staff_members values('77000000-0000-0000-0000-000000000001','coach') on conflict(user_id) do update set access_level='coach';
insert into public.workspace_support_grants(user_id) values('77000000-0000-0000-0000-000000000001') on conflict(user_id) do update set revoked_at=null;
set request.jwt.claim.sub='77000000-0000-0000-0000-000000000001';
set request.headers='{"x-coach-house-organization-id":"77000000-0000-0000-0000-000000000003"}';
set role authenticated;
select public.sync_workspace_support_presence('77000000-0000-0000-0000-000000000003','78000000-0000-0000-0000-000000000001','/workspace',null,true);
select public.record_module_step('77000000-0000-0000-0000-000000000003','79000000-0000-0000-0000-000000000001','resources');
reset role;
update public.workspace_support_grants set revoked_at=now() where user_id='77000000-0000-0000-0000-000000000001';
set role authenticated;
do $$ begin
 begin
  perform public.record_module_step('77000000-0000-0000-0000-000000000003','79000000-0000-0000-0000-000000000001','lesson');
  raise exception 'revoked support wrote progress';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
 if has_function_privilege('anon','public.record_module_step(uuid,uuid,text)','EXECUTE') then raise exception 'anonymous progress execute granted'; end if;
 if has_function_privilege('anon','public.save_module_notes_if_current(uuid,uuid,jsonb,jsonb)','EXECUTE') then raise exception 'anonymous notes execute granted'; end if;
end $$;
rollback;
