begin;
-- Restore the granted staff fixture removed by the preceding revocation test.
insert into public.platform_staff_members values('77000000-0000-0000-0000-000000000001','coach') on conflict(user_id) do update set access_level='coach';
insert into public.workspace_support_grants(user_id) values('77000000-0000-0000-0000-000000000001') on conflict(user_id) do update set revoked_at=null;
set request.jwt.claim.role='authenticated';
set request.jwt.claim.sub='77000000-0000-0000-0000-000000000001';
set request.headers='{"x-coach-house-organization-id":"77000000-0000-0000-0000-000000000003"}';
insert into public.module_progress values
 ('77000000-0000-0000-0000-000000000001','79000000-0000-0000-0000-000000000001','completed','{"content":"Staff seed"}'),
 ('77000000-0000-0000-0000-000000000002','79000000-0000-0000-0000-000000000001','completed','{"content":"Other organization"}'),
 ('77000000-0000-0000-0000-000000000003','79000000-0000-0000-0000-000000000001','in_progress','{"content":"Selected organization"}');
insert into public.assignment_submissions values
 ('77000000-0000-0000-0000-000000000002','79000000-0000-0000-0000-000000000001','accepted','{"answer":"Other"}'),
 ('77000000-0000-0000-0000-000000000003','79000000-0000-0000-0000-000000000001','submitted','{"answer":"Selected"}');
set role authenticated;
do $$ begin
 if not public.workspace_supports_org('77000000-0000-0000-0000-000000000003') then raise exception 'fixture support missing: actor %, grant %, headers %', auth.uid(),public.has_workspace_support_access(),current_setting('request.headers'); end if;
 if (select notes->>'content' from public.module_progress where user_id='77000000-0000-0000-0000-000000000003') <> 'Selected organization' then raise exception 'selected notes unavailable'; end if;
 if exists(select 1 from public.module_progress where user_id='77000000-0000-0000-0000-000000000002') then raise exception 'unselected progress leaked'; end if;
 if exists(select 1 from public.assignment_submissions where user_id='77000000-0000-0000-0000-000000000002') then raise exception 'unselected answers leaked'; end if;
 begin
  insert into public.module_progress values('77000000-0000-0000-0000-000000000003','79000000-0000-0000-0000-000000000002','completed',null);
  raise exception 'expired presence allowed insert';
 exception when insufficient_privilege then null; end;
end $$;
select public.sync_workspace_support_presence('77000000-0000-0000-0000-000000000003','78000000-0000-0000-0000-000000000001','/workspace',null,true);
update public.module_progress set notes='{"content":"Edited selected"}',status='completed' where user_id='77000000-0000-0000-0000-000000000003';
insert into public.module_progress values('77000000-0000-0000-0000-000000000003','79000000-0000-0000-0000-000000000002','completed',null);
update public.assignment_submissions set answers='{"answer":"Edited selected"}' where user_id='77000000-0000-0000-0000-000000000003';
insert into public.assignment_submissions values('77000000-0000-0000-0000-000000000003','79000000-0000-0000-0000-000000000002','submitted','{}');
do $$ begin
 if (select count(*) from public.module_progress where user_id='77000000-0000-0000-0000-000000000003')<>2 then raise exception 'support progress write missing'; end if;
 if (select answers->>'answer' from public.assignment_submissions where user_id='77000000-0000-0000-0000-000000000003' and module_id='79000000-0000-0000-0000-000000000001')<>'Edited selected' then raise exception 'support answer write missing'; end if;
 delete from public.assignment_submissions where user_id='77000000-0000-0000-0000-000000000003';
 if (select count(*) from public.assignment_submissions where user_id='77000000-0000-0000-0000-000000000003')<>2 then raise exception 'support received delete access'; end if;
end $$;
reset role;
do $$ begin
 if not exists(select 1 from public.workspace_support_audit where actor_id='77000000-0000-0000-0000-000000000001' and org_id='77000000-0000-0000-0000-000000000003' and action='module_progress.update') then raise exception 'progress audit missing'; end if;
 if not exists(select 1 from public.workspace_support_audit where actor_id='77000000-0000-0000-0000-000000000001' and org_id='77000000-0000-0000-0000-000000000003' and action='assignment_submissions.update') then raise exception 'assignment audit missing'; end if;
 if (select notes->>'content' from public.module_progress where user_id='77000000-0000-0000-0000-000000000001')<>'Staff seed' then raise exception 'staff data overwritten'; end if;
end $$;
update public.workspace_support_grants set revoked_at=now() where user_id='77000000-0000-0000-0000-000000000001';
set role authenticated;
do $$ begin
 if exists(select 1 from public.module_progress where user_id='77000000-0000-0000-0000-000000000003') then raise exception 'revoked progress read'; end if;
 if exists(select 1 from public.assignment_submissions where user_id='77000000-0000-0000-0000-000000000003') then raise exception 'revoked answer read'; end if;
 begin
  insert into public.assignment_submissions values('77000000-0000-0000-0000-000000000003','79000000-0000-0000-0000-000000000003','submitted','{}');
  raise exception 'revoked insert allowed';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
-- Ungranted coach / organization member does not acquire someone else's records.
set request.jwt.claim.sub='77000000-0000-0000-0000-000000000002';
set role authenticated;
do $$ begin
 if exists(select 1 from public.module_progress where user_id='77000000-0000-0000-0000-000000000003') then raise exception 'ordinary coach access widened'; end if;
end $$;
reset role;
set request.jwt.claim.sub='77000000-0000-0000-0000-000000000003';
set role authenticated;
update public.assignment_submissions set answers='{"answer":"Owner update"}' where user_id=auth.uid();
do $$ begin
 if (select count(*) from public.assignment_submissions where answers->>'answer'='Owner update')<>2 then raise exception 'owner write regressed'; end if;
 if exists(select 1 from public.module_progress where user_id<>auth.uid()) then raise exception 'owner sees another learner'; end if;
end $$;
reset role;
rollback;
