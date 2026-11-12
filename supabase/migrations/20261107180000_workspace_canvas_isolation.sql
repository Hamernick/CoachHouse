-- Canonical canvas boundary. No application command enables canvas_private yet:
-- history, derived copies, sharing and cache cutover remain activation gates.
begin;
alter table public.workspace_source_audiences add column canvas_private boolean not null default false;

create function public.workspace_canvas_actor_can(p_org uuid,p_canvas text,p_actor uuid,p_capability text)
returns boolean language sql stable security definer set search_path='' as $$
 select p_actor is not null and p_capability in ('view','edit','manage')
  and public.can_read_workspace_particle_origins(p_org,p_actor)
  and (not exists(select 1 from public.workspace_source_audiences where org_id=p_org and canvas_id=p_canvas and canvas_private)
   or p_actor=p_org
   or exists(select 1 from public.workspace_source_audience_members a
    join public.organization_memberships m on m.org_id=a.org_id and m.member_id=a.member_id and m.created_at=a.membership_created_at
    where a.org_id=p_org and a.canvas_id=p_canvas and a.member_id=p_actor
     and case p_capability when 'view' then true when 'edit' then a.capability in ('edit','manage') else a.capability='manage' end));
$$;

create function public.project_workspace_canvas_audience(p_org uuid,p_state jsonb,p_actor uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare catalog jsonb; entries jsonb; root jsonb;
begin
 if not public.can_read_workspace_particle_origins(p_org,p_actor) then
  raise exception 'Workspace access required.' using errcode='42501'; end if;
 if not exists(select 1 from public.workspace_source_audiences a where a.org_id=p_org and a.canvas_private
  and not public.workspace_canvas_actor_can(p_org,a.canvas_id,p_actor,'view')) then return p_state; end if;
 if jsonb_typeof(p_state) is distinct from 'object' then
  raise exception 'Invalid workspace catalog.' using errcode='22023'; end if;
 catalog:=p_state->'workspaceCatalog';
 if catalog is null then catalog:='{"version":1,"defaultName":"Main workspace","entries":[]}'; end if;
 if jsonb_typeof(catalog) is distinct from 'object' or catalog->'version' is distinct from '1'::jsonb
  or jsonb_typeof(catalog->'entries') is distinct from 'array' then
  raise exception 'Invalid workspace catalog.' using errcode='22023'; end if;
 if exists(select 1 from jsonb_array_elements(catalog->'entries') e
  where jsonb_typeof(e) is distinct from 'object' or e->>'id' is null)
  or exists(select 1 from jsonb_array_elements(catalog->'entries') e group by e->>'id' having count(*)>1) then
  raise exception 'Invalid workspace catalog.' using errcode='22023'; end if;
 select coalesce(jsonb_agg(e order by n),'[]'::jsonb) into entries
  from jsonb_array_elements(catalog->'entries') with ordinality x(e,n)
  where public.workspace_canvas_actor_can(p_org,e->>'id',p_actor,'view');
 root:=p_state-'workspaceCatalog';
 if not public.workspace_canvas_actor_can(p_org,'default',p_actor,'view') then
  -- Remove all default-canvas fields and its name; a tombstone prevents seeding.
  root:='{"nodes":[],"connections":[],"visibility":{"allCardsHiddenExplicitly":true,"organizationHiddenExplicitly":true}}';
  catalog:=jsonb_build_object('version',1,'defaultName','Workspace','defaultDeleted',true,'entries',entries);
 else
  -- Catalog extensions may contain cross-canvas metadata; expose only its contract.
  catalog:=jsonb_build_object('version',1,'defaultName',catalog->'defaultName','defaultDeleted',coalesce(catalog->'defaultDeleted','false'::jsonb),'entries',entries);
 end if;
 return root||jsonb_build_object('workspaceCatalog',catalog);
end $$;

create function public.read_workspace_canvas_projection(p_org_id uuid,p_actor_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare canonical jsonb;
begin
 -- Reuse exact verified-actor/parent admission; canonical RPC remains separate
 -- for trusted CAS compilers. This projection must never become a save snapshot.
 canonical:=public.read_workspace_particle_board_for_projection(p_org_id,p_actor_id);
 if canonical is null then return null; end if;
 return jsonb_build_object('state',public.project_workspace_canvas_audience(p_org_id,canonical->'state',p_actor_id));
end $$;

create function public.can_read_workspace_canvas_board(p_org uuid,p_state jsonb)
returns boolean language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.can_read_workspace_particle_origins(p_org,auth.uid()) then return false; end if;
 if public.project_workspace_canvas_audience(p_org,p_state,auth.uid()) is distinct from p_state then
  raise exception 'Workspace audience access required.' using errcode='42501'; end if;
 return true;
end $$;
create policy workspace_canvas_read on public.organization_workspace_boards as restrictive for select to authenticated
 using(public.can_read_workspace_canvas_board(org_id,state));

create function public.guard_workspace_canvas_write() returns trigger
language plpgsql security definer set search_path='' as $$
declare org uuid; actor uuid; scope record; before_canvas jsonb; after_canvas jsonb; next_state jsonb; required text;
begin
 if tg_op='INSERT' then org:=new.org_id; else org:=old.org_id; end if;
 if not exists(select 1 from public.workspace_source_audiences where org_id=org and canvas_private) then
  if tg_op='DELETE' then return old; else return new; end if;
 end if;
 -- Database administration is not an application actor. App/service writes all
 -- require verified actor headers and current parent access, including no-ops.
 if auth.role() not in ('authenticated','service_role') then
  if tg_op='DELETE' then return old; else return new; end if;
 end if;
 actor:=public.organization_activity_actor_id();
 if actor is null or not public.can_read_workspace_particle_origins(org,actor) then
  raise exception 'Workspace access required.' using errcode='42501'; end if;
 if tg_op='UPDATE' and new.org_id is distinct from old.org_id then
  raise exception 'Workspace audience access required.' using errcode='42501'; end if;
 if current_setting('transaction_isolation')<>'read committed' then
  raise exception 'Workspace permission changed; retry.' using errcode='40001'; end if;
 perform 1 from public.organizations where user_id=org for share nowait;
 next_state:=case when tg_op='DELETE' then null else new.state end;
 if next_state is not null and exists(select 1 from jsonb_array_elements(coalesce(next_state#>'{workspaceCatalog,entries}','[]'::jsonb)) e
  group by e->>'id' having count(*)>1 or e->>'id' is null) then
  raise exception 'Invalid workspace catalog.' using errcode='22023'; end if;
 for scope in select canvas_id from public.workspace_source_audiences where org_id=org and canvas_private loop
  if scope.canvas_id='default' then
   before_canvas:=case when tg_op='INSERT' then null else old.state-'workspaceCatalog' end;
   after_canvas:=next_state-'workspaceCatalog';
   required:=case when tg_op='DELETE' or
    old.state#>'{workspaceCatalog,defaultName}' is distinct from next_state#>'{workspaceCatalog,defaultName}' or
    old.state#>'{workspaceCatalog,defaultDeleted}' is distinct from next_state#>'{workspaceCatalog,defaultDeleted}' then 'manage' else 'edit' end;
  else
   select e into before_canvas from jsonb_array_elements(coalesce(old.state#>'{workspaceCatalog,entries}','[]'::jsonb)) e where e->>'id'=scope.canvas_id;
   select e into after_canvas from jsonb_array_elements(coalesce(next_state#>'{workspaceCatalog,entries}','[]'::jsonb)) e where e->>'id'=scope.canvas_id;
   required:=case when after_canvas is null or before_canvas is null or
    (before_canvas-array['state','updatedAt']) is distinct from (after_canvas-array['state','updatedAt']) then 'manage' else 'edit' end;
  end if;
  if (before_canvas is distinct from after_canvas or required='manage')
   and not public.workspace_canvas_actor_can(org,scope.canvas_id,actor,required) then
   raise exception 'Workspace audience access required.' using errcode='42501'; end if;
 end loop;
 if tg_op='DELETE' then return old; else return new; end if;
exception when lock_not_available then
 raise exception 'Workspace permission is changing; retry.' using errcode='40001';
end $$;
-- AFTER sees final state; alphabetical ordering precedes scope cleanup. DELETE
-- uses BEFORE so cascading cleanup cannot erase the permissions being checked.
create trigger a_workspace_canvas_write after insert or update on public.organization_workspace_boards
 for each row execute function public.guard_workspace_canvas_write();
create trigger a_workspace_canvas_delete before delete on public.organization_workspace_boards
 for each row execute function public.guard_workspace_canvas_write();

revoke all on function public.workspace_canvas_actor_can(uuid,text,uuid,text),public.project_workspace_canvas_audience(uuid,jsonb,uuid),
 public.read_workspace_canvas_projection(uuid,uuid),public.can_read_workspace_canvas_board(uuid,jsonb),public.guard_workspace_canvas_write()
 from public,anon,authenticated,service_role;
grant execute on function public.read_workspace_canvas_projection(uuid,uuid) to service_role;
grant execute on function public.can_read_workspace_canvas_board(uuid,jsonb) to authenticated;
comment on column public.workspace_source_audiences.canvas_private is
 'Inactive by default; no application setter. Source audience membership alone does not change canvas visibility. Activation requires remaining derived-history/sharing/cache qualification.';
commit;
