-- Follow recorded particle dependencies through retained origins. This does not
-- infer missing historical inputs, permit private transitions or grant access.
-- Existing current-actor file readers still authorize every returned file.
begin;
create or replace function public.read_workspace_particle_ai_files(p_org_id uuid,p_actor_id uuid,p_record_ids text[])
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.role() is distinct from 'service_role' or p_actor_id is null
  or p_actor_id is distinct from public.organization_activity_actor_id()
  or not public.can_read_workspace_ai(p_org_id,p_actor_id) then
  raise exception 'Particle source access denied.' using errcode='42501';end if;
 if p_record_ids is null or cardinality(p_record_ids)>500 or exists(select 1 from unnest(p_record_ids) id where id is null or length(id)>125) then
  raise exception 'Invalid particle source request.' using errcode='22023';end if;
 return (with recursive reachable(root_id,record_id) as (
  select distinct record_id,record_id from public.workspace_particle_ai_origins
   where org_id=p_org_id and record_id=any(p_record_ids)
  union
  -- UNION deduplicates each root/record pair, terminating cycles and diamonds.
  -- Every hop stays in this organization. Never resolve a dependency by title.
  select r.root_id,entry->>'id' from reachable r
   join public.workspace_particle_ai_origins o on o.org_id=p_org_id and o.record_id=r.record_id
   cross join lateral jsonb_array_elements(case when jsonb_typeof(o.dependencies->'records')='array' then o.dependencies->'records' else '[]'::jsonb end) entry
   where entry->>'id' like 'particle:%'
 ), origins as (
  select r.root_id as record_id,o.dependencies from reachable r
   join public.workspace_particle_ai_origins o on o.org_id=p_org_id and o.record_id=r.record_id
 ), files as (
  select record_id,value as file_id from origins cross join lateral jsonb_array_elements_text(case when jsonb_typeof(dependencies->'nativeFileIds')='array' then dependencies->'nativeFileIds' else '[]'::jsonb end)
  union
  select record_id,substr(value->>'id',6) from origins cross join lateral jsonb_array_elements(case when jsonb_typeof(dependencies->'records')='array' then dependencies->'records' else '[]'::jsonb end)
   where value->>'id' like 'file:%'
 ), records as (
  select record_id,
   -- Recorded transitive inputs are conservative unions across retained runs.
   -- Missing historical/implicit inputs still prevent completeness claims.
   false as complete,
   coalesce((select jsonb_agg(distinct file_id order by file_id) from files where files.record_id=o.record_id
    and file_id ~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'),'[]'::jsonb) as file_ids
  from origins o group by record_id
 ) select coalesce(jsonb_agg(jsonb_build_object('id',record_id,'fileIds',file_ids,'complete',complete) order by record_id),'[]'::jsonb) from records);
end $$;
revoke all on function public.read_workspace_particle_ai_files(uuid,uuid,text[]) from public,anon,authenticated;
grant execute on function public.read_workspace_particle_ai_files(uuid,uuid,text[]) to service_role;
commit;
