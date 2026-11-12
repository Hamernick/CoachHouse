-- Retain explicit document dependencies even after current citations disappear.
-- This is recorded lineage only; unknown historical copies remain unqualified.
begin;
create function public.workspace_particle_document_origins(p_org uuid,p_record_ids text[])
returns table(record_id text,section_id text) language sql stable security definer set search_path='' as $$
 with recursive reachable(root_id,record_id) as (
  select distinct record_id,record_id from public.workspace_particle_ai_origins
   where org_id=p_org and record_id=any(p_record_ids)
  union
  select r.root_id,dependency.id from reachable r
   join public.workspace_particle_ai_origins o on o.org_id=p_org and o.record_id=r.record_id
   cross join lateral (
    select entry->>'id' id from jsonb_array_elements(public.workspace_particle_array(o.dependencies->'records')) entry
    union select value from jsonb_array_elements_text(public.workspace_particle_array(o.dependencies->'contextParticleIds'))
   ) dependency where dependency.id like 'particle:%'
 )
 select distinct r.root_id,regexp_replace(entry->>'id','^(document|roadmap):','')
 from reachable r join public.workspace_particle_ai_origins o on o.org_id=p_org and o.record_id=r.record_id
 cross join lateral jsonb_array_elements(public.workspace_particle_array(o.dependencies->'records')) entry
 where entry->>'id' ~ '^(document|roadmap):';
$$;
revoke all on function public.workspace_particle_document_origins(uuid,text[]) from public,anon,authenticated,service_role;

create function public.read_workspace_particle_ai_documents(p_org_id uuid,p_actor_id uuid,p_record_ids text[])
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.role() is distinct from 'service_role' or p_actor_id is null
  or p_actor_id is distinct from public.organization_activity_actor_id()
  or not public.can_read_workspace_particle_origins(p_org_id,p_actor_id) then
  raise exception 'Particle source access denied.' using errcode='42501';end if;
 if p_record_ids is null or cardinality(p_record_ids)>500
  or exists(select 1 from unnest(p_record_ids) id where id is null or length(id)>125 or length(id)=0) then
  raise exception 'Invalid particle source request.' using errcode='22023';end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('id',record_id,'documentIds',ids,'complete',false) order by record_id),'[]'::jsonb)
  from (select record_id,jsonb_agg(section_id order by section_id) ids
   from public.workspace_particle_document_origins(p_org_id,p_record_ids) group by record_id) sources);
end $$;
revoke all on function public.read_workspace_particle_ai_documents(uuid,uuid,text[]) from public,anon,authenticated;
grant execute on function public.read_workspace_particle_ai_documents(uuid,uuid,text[]) to service_role;

-- Preserve the existing direct-reference/native-source gate and exact fallback
-- error. Add retained roots, including plans no longer bearing a run/citation.
do $$ declare definition text; begin
 definition:=pg_get_functiondef('public.can_read_workspace_particle_board(uuid,jsonb)'::regprocedure);
 if strpos(definition,'return true;')=0 then raise exception 'Unexpected board source reader';end if;
 execute replace(definition,'return true;', $body$
 if exists (
  with particles as (
   select value body from public.workspace_particle_board_graphs(p_state)
   cross join lateral jsonb_array_elements(public.workspace_particle_array(graph->'particles'))
  ), roots as (
   select 'particle:'||(body->>'id') id from particles
   union select 'particle:'||(body->>'id')||':'||kind||':'||(value->>'id')
   from particles cross join (values('plan','plans'),('proposal','proposals')) fields(kind,name)
   cross join lateral jsonb_array_elements(public.workspace_particle_array(body#>array['data','planning',name]))
   where body->>'type'='objective'
  )
  select 1 from public.workspace_particle_document_origins(p_org,(select array_agg(id) from roots))
 ) then raise exception 'Board source access required.' using errcode='42501';end if;
 return true;
 $body$);
end $$;
comment on function public.can_read_workspace_particle_board(uuid,jsonb) is
 'Raw-board native-file fence and current/retained document projection gate. Verified projection preserves owner/member access; unknown historical copies remain unqualified.';
commit;
