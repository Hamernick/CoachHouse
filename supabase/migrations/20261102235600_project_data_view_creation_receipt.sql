-- Read-only recovery for one exact projects-view creation. Never replay/create
-- a source effect merely to discover whether its prior request committed.
begin;
create function public.read_project_data_view_creation(p_command jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); org uuid; request uuid; view_id uuid;
 receipt public.organization_data_view_receipts%rowtype; view_row public.organization_data_views%rowtype;
begin
 if actor is null then raise exception 'Creation receipt unavailable' using errcode='42501'; end if;
 if p_command is null or jsonb_typeof(p_command) is distinct from 'object' or octet_length(p_command::text)>2048
  or (p_command-array['action','organizationId','viewId','requestId','name','source'])<>'{}'::jsonb
  or not(p_command ?& array['action','organizationId','viewId','requestId','name','source'])
  or p_command->>'action' is distinct from 'create_view' or p_command->'source' is distinct from '{"kind":"projects"}'::jsonb
  or jsonb_typeof(p_command->'organizationId') is distinct from 'string' or jsonb_typeof(p_command->'viewId') is distinct from 'string'
  or jsonb_typeof(p_command->'requestId') is distinct from 'string' or jsonb_typeof(p_command->'name') is distinct from 'string'
  or length(btrim(p_command->>'name')) not between 1 and 100 then raise exception 'Invalid creation receipt request' using errcode='22023'; end if;
 org:=(p_command->>'organizationId')::uuid; request:=(p_command->>'requestId')::uuid; view_id:=(p_command->>'viewId')::uuid;
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'Read committed required' using errcode='40001'; end if;
 perform 1 from public.organizations where user_id=org for share nowait;
 perform public.guard_organization_closure(org,true);
 perform 1 from public.profiles where id=actor for share nowait;
 if not found then raise exception 'Creation receipt unavailable' using errcode='42501'; end if;
 perform 1 from public.organization_memberships where org_id=org and member_id=actor for share nowait;
 perform 1 from public.subscriptions where user_id=org for share nowait;
 if public.data_view_workspace_access(org,false) is not true or public.can_read_member_workspace_org(org) is not true then
  raise exception 'Creation receipt unavailable' using errcode='42501'; end if;
 select * into receipt from public.organization_data_view_receipts where org_id=org and request_id=request;
 if not found then return jsonb_build_object('receipt',null,'view',null); end if;
 if receipt.actor_id<>actor then raise exception 'Creation receipt unavailable' using errcode='42501'; end if;
 if receipt.command<>p_command then raise exception 'Creation request changed' using errcode='40001'; end if;
 select * into view_row from public.organization_data_views where id=view_id and org_id=org and source='projects';
 return jsonb_build_object('receipt',receipt.result,'view',case when view_row.id is null then null else
  jsonb_build_object('id',view_row.id,'name',view_row.name,'revision',view_row.revision) end);
end $$;
revoke all on function public.read_project_data_view_creation(jsonb) from public,anon,service_role;
grant execute on function public.read_project_data_view_creation(jsonb) to authenticated;
comment on function public.read_project_data_view_creation(jsonb) is 'Read-only exact-command, actor-owned projects-view creation recovery. Current source access and fixed closure export window required; no replay, row query, mutation or response authority.';
commit;
