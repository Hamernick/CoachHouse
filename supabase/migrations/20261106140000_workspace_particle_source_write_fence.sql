-- Additive source-audience fence for canonical board writes. Raw read projection,
-- unknown historical copies and private-folder activation remain separate gates.
begin;
create function public.workspace_particle_array(value jsonb) returns jsonb
language sql immutable set search_path='' as $$
 select case when jsonb_typeof(value)='array' then value else '[]'::jsonb end;
$$;
create function public.workspace_particle_board_graphs(p_state jsonb)
returns table(canvas text,graph jsonb) language sql immutable set search_path='' as $$
 select 'root',p_state->'particleGraph'
 union all select 'canvas:'||(value->>'id'),value#>'{state,particleGraph}'
 from jsonb_array_elements(public.workspace_particle_array(p_state#>'{workspaceCatalog,entries}'));
$$;
-- Compare full records, incident connections and roots on both sides. Revisions
-- and replay receipts are canonical bookkeeping, not a grant to edit a record.
create function public.workspace_particle_board_items(p_state jsonb)
returns table(item_key text,record_id text,body jsonb) language sql immutable set search_path='' as $$
 with graphs as (select * from public.workspace_particle_board_graphs(p_state))
 select canvas||':particle:'||(value->>'id'),'particle:'||(value->>'id'),value
 from graphs cross join lateral jsonb_array_elements(public.workspace_particle_array(graph->'particles'))
 union all
 select canvas||':edge:'||(value->>'id'),'particle:'||endpoint,value
 from graphs cross join lateral jsonb_array_elements(public.workspace_particle_array(graph->'connections'))
 cross join lateral (values(value->>'source'),(value->>'target')) ends(endpoint)
 union all select canvas||':root','particle:'||(graph->>'rootId'),graph->'rootId' from graphs where graph->>'rootId' is not null;
$$;
-- Build a deterministic dependency relation from current content and immutable
-- receipts. Follow same-org retained references even after a member is detached.
create function public.workspace_particle_board_files(p_org uuid,p_state jsonb)
returns table(record_id text,file_id uuid) language sql stable security definer set search_path='' as $$
 with recursive particles as materialized (
  select value as body,'particle:'||(value->>'id') as id
  from public.workspace_particle_board_graphs(p_state)
  cross join lateral jsonb_array_elements(public.workspace_particle_array(graph->'particles'))
 ), plans as materialized (
  select p.id as parent,p.id||':'||kind||':'||(value->>'id') as id,value as body
  from particles p cross join (values('plan','plans'),('proposal','proposals')) kinds(kind,field)
  cross join lateral jsonb_array_elements(public.workspace_particle_array(p.body#>array['data','planning',field]))
  where p.body->>'type'='objective'
 ), origins as materialized (
  select record_id,dependencies from public.workspace_particle_ai_origins where org_id=p_org
  union all
  select b.record_id,public.workspace_particle_ai_snapshot(p_org,b.run_id)
  from public.workspace_particle_ai_bindings(p_state) b
  where not exists(select 1 from public.workspace_particle_ai_origins o where o.org_id=p_org and o.record_id=b.record_id and o.run_id=b.run_id)
 ), refs(source,target) as materialized (
  select id,'file:'||(body#>>'{data,widget,fileId}') from particles
   where body->>'type'='activity' and body#>>'{data,widget,kind}' in ('document','image') and body#>>'{data,widget,fileId}' is not null
  union select parent,id from plans
  union select id,parent from plans
  union select id,'particle:'||value from plans cross join lateral jsonb_array_elements_text(public.workspace_particle_array(body->'particleIds'))
  union select 'particle:'||value,id from plans cross join lateral jsonb_array_elements_text(public.workspace_particle_array(body->'particleIds')) where body->>'researchRunId' is not null
  union select id,value->>'id' from plans cross join lateral jsonb_array_elements(public.workspace_particle_array(body->'sources')) where value->>'kind'='workspace' and value->>'id' like 'file:%'
  union select id,'particle:'||(value->>'particleId') from particles cross join lateral jsonb_array_elements(public.workspace_particle_array(body#>array['data',case when body->>'type'='decision' then 'criteria' else 'steps' end])) where body->>'type' in ('activity','workflow','decision') and value->>'particleId' is not null
  union select id,'particle:'||(value->>'activityId') from particles cross join lateral jsonb_array_elements(public.workspace_particle_array(body#>'{data,entries}')) where body->>'type'='calendar' and value->>'activityId' is not null
  union select id,'particle:'||value from particles cross join lateral jsonb_array_elements_text(public.workspace_particle_array(body#>'{data,outcomeConfirmation,workIds}')) where body->>'type'='objective'
  union select id,'particle:'||(body#>>'{data,widget,source,id}') from particles where body->>'type'='activity' and body#>>'{data,widget,kind}'='document' and body#>>'{data,widget,source,kind}'='workspace_note'
  union select record_id,'file:'||value from origins cross join lateral jsonb_array_elements_text(public.workspace_particle_array(dependencies->'nativeFileIds'))
  union select record_id,value->>'id' from origins cross join lateral jsonb_array_elements(public.workspace_particle_array(dependencies->'records')) where value->>'id' like 'particle:%' or value->>'id' like 'file:%'
  union select record_id,value from origins cross join lateral jsonb_array_elements_text(public.workspace_particle_array(dependencies->'contextParticleIds')) where value like 'particle:%'
 ), reachable(root,node) as (
  select id,id from particles
  union select r.root,refs.target from reachable r join refs on refs.source=r.node
 )
 select distinct root,substr(node,6)::uuid from reachable where node like 'file:%';
$$;
-- Bind checks to the verified JWT/service actor. Lock actual authority rows and
-- check a fresh READ COMMITTED snapshot. NOWAIT avoids lock-order deadlocks.
create function public.assert_workspace_particle_source_view(p_org uuid,p_file uuid,p_actor uuid) returns void
language plpgsql security definer set search_path='' as $$
declare binding public.document_file_folder_authorities%rowtype; source_org uuid; project_org uuid;
begin
 if p_actor is null or p_actor is distinct from public.organization_activity_actor_id() then
  raise exception 'Verified board actor required.' using errcode='42501';end if;
 if current_setting('transaction_isolation')<>'read committed' then
  raise exception 'Board source permission changed; retry.' using errcode='40001';end if;
 select org_id into source_org from public.organization_document_files where id=p_file for share nowait;
 if not found or source_org is distinct from p_org then raise exception 'Board source access required.' using errcode='42501';end if;
 perform 1 from public.organizations where user_id=source_org for share nowait;
 perform 1 from public.organization_memberships where org_id=source_org and member_id=p_actor for share nowait;
 perform 1 from public.platform_staff_members where user_id=p_actor for share nowait;
 select * into binding from public.document_file_folder_authorities where file_id=p_file for share nowait;
 if found then
  select org_id into project_org from public.organization_projects where id=binding.project_id for share nowait;
  perform 1 from public.organization_memberships where org_id=project_org and member_id=p_actor for share nowait;
  perform 1 from public.project_asset_folders where project_id=binding.project_id and id=binding.folder_id for share nowait;
  perform 1 from public.project_asset_folder_grants where project_id=binding.project_id and folder_id=binding.folder_id and member_id=p_actor for share nowait;
 end if;
 if not public.can_read_workspace_particle_origins(source_org,p_actor)
  or not public.document_file_folder_actor_can(p_file,p_actor,'view') then
  raise exception 'Board source access required.' using errcode='42501';end if;
exception when lock_not_available then
 raise exception 'Board source permission is changing; retry.' using errcode='40001';
end;
$$;
create function public.guard_workspace_particle_source_write() returns trigger
language plpgsql security definer set search_path='' as $$
declare before_state jsonb:='{}'; after_state jsonb:='{}'; organization_id uuid; actor uuid; file uuid; changed_ids text[];
begin
 if tg_op<>'INSERT' then before_state:=old.state;organization_id:=old.org_id;end if;
 if tg_op<>'DELETE' then after_state:=new.state;organization_id:=new.org_id;end if;
 if tg_op='UPDATE' and old.org_id is distinct from new.org_id then
  raise exception 'Board organization cannot change.' using errcode='42501';end if;
 actor:=public.organization_activity_actor_id();
 with before_items as (select item_key,record_id,jsonb_agg(body order by body::text) body from public.workspace_particle_board_items(before_state) group by item_key,record_id),
  after_items as (select item_key,record_id,jsonb_agg(body order by body::text) body from public.workspace_particle_board_items(after_state) group by item_key,record_id),
  changed as (select distinct coalesce(a.record_id,b.record_id) id from before_items a full join after_items b using(item_key,record_id) where a.body is distinct from b.body)
 select array_agg(id) into changed_ids from changed;
 if cardinality(changed_ids)>0 then
 for file in
  with dependencies as (select * from public.workspace_particle_board_files(organization_id,before_state) union select * from public.workspace_particle_board_files(organization_id,after_state))
  select distinct file_id from dependencies where record_id=any(changed_ids) order by file_id
 loop perform public.assert_workspace_particle_source_view(organization_id,file,actor);end loop;
 end if;
 if tg_op='DELETE' then return old;end if;return new;
end;
$$;
revoke all on function public.workspace_particle_array(jsonb),public.workspace_particle_board_graphs(jsonb),public.workspace_particle_board_items(jsonb),public.workspace_particle_board_files(uuid,jsonb),public.assert_workspace_particle_source_view(uuid,uuid,uuid),public.guard_workspace_particle_source_write() from public,anon,authenticated,service_role;
create trigger workspace_particle_source_write before insert or update or delete on public.organization_workspace_boards
 for each row execute function public.guard_workspace_particle_source_write();
comment on function public.guard_workspace_particle_source_write() is
 'Additive atomic native-file audience fence for changed board records and references. Preserves full-state CAS. Does not qualify raw reads, unknown origins, or private authority transitions.';
commit;
