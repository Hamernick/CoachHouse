-- Discover only retained private scopes the current actor can manage. This is
-- not a trash restore command and never changes privacy or audience membership.
begin;
create function public.list_retained_workspace_access(p_org_id uuid,p_actor_id uuid,p_after text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare rows jsonb; result jsonb; cursor text;
begin
 if auth.role() is distinct from 'service_role' or p_actor_id is null
  or p_actor_id is distinct from public.organization_activity_actor_id()
  or not public.can_read_workspace_particle_origins(p_org_id,p_actor_id) then
  raise exception 'Workspace access required.' using errcode='42501'; end if;
 if p_after is not null and not (p_after='default' or p_after ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') then
  raise exception 'Invalid workspace cursor.' using errcode='22023'; end if;
 if current_setting('transaction_isolation')<>'read committed' then
  raise exception 'Access changed. Reload and try again.' using errcode='40001'; end if;
 perform 1 from public.organizations where user_id=p_org_id for share nowait;
 perform 1 from public.organization_workspace_boards where org_id=p_org_id for share nowait;
 select coalesce(jsonb_agg(jsonb_build_object('canvasId',canvas_id) order by canvas_id),'[]'::jsonb) into rows
 from (
  select a.canvas_id from public.workspace_source_audiences a
  where a.org_id=p_org_id and a.canvas_private
   and (p_after is null or a.canvas_id>p_after)
   and not public.workspace_source_scope_exists(p_org_id,a.canvas_id)
   and public.workspace_canvas_actor_can(p_org_id,a.canvas_id,p_actor_id,'manage')
  order by a.canvas_id limit 51
 ) candidates;
 select coalesce(jsonb_agg(value order by ordinal),'[]'::jsonb) into result
 from jsonb_array_elements(rows) with ordinality as item(value,ordinal) where ordinal<=50;
 if jsonb_array_length(rows)>50 then cursor:=rows->49->>'canvasId'; end if;
 return jsonb_build_object('items',result,'nextAfter',cursor);
exception when lock_not_available then
 raise exception 'Access is changing. Retry.' using errcode='40001';
end $$;
revoke all on function public.list_retained_workspace_access(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.list_retained_workspace_access(uuid,uuid,text) to service_role;
commit;
