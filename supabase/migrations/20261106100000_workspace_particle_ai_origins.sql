-- Retain the link between generated board records and immutable AI receipts.
-- This is additive provenance, not a board privacy cutover. Older, detached
-- outputs without an identifiable run remain an explicit activation blocker.
begin;
create table public.workspace_particle_ai_origins (
 org_id uuid not null,
 record_id text not null check(length(record_id) between 45 and 125),
 run_id uuid not null,
 dependencies jsonb,
 captured_at timestamptz not null default clock_timestamp(),
 primary key(org_id,record_id,run_id),
 check(dependencies is null or (jsonb_typeof(dependencies)='object' and octet_length(dependencies::text)<=150000))
);
alter table public.workspace_particle_ai_origins enable row level security;
alter table public.workspace_particle_ai_origins force row level security;
revoke all on public.workspace_particle_ai_origins from public,anon,authenticated,service_role;
-- No cascade from mutable plan membership, chat presentation, or source rows.
create trigger workspace_particle_ai_origins_immutable before update or delete on public.workspace_particle_ai_origins
 for each row execute function public.ai_credit_immutable();
create trigger workspace_particle_ai_origins_retained before truncate on public.workspace_particle_ai_origins
 for each statement execute function public.ai_credit_immutable();

create function public.workspace_particle_ai_bindings(p_state jsonb)
returns table(record_id text,run_id uuid) language sql immutable set search_path='' as $$
 with states as (
  select p_state as state
  union all
  select value->'state' from jsonb_array_elements(case when jsonb_typeof(p_state#>'{workspaceCatalog,entries}')='array' then p_state#>'{workspaceCatalog,entries}' else '[]'::jsonb end)
 ), particles as (
  select value as particle from states cross join lateral jsonb_array_elements(case when jsonb_typeof(state#>'{particleGraph,particles}')='array' then state#>'{particleGraph,particles}' else '[]'::jsonb end)
 ), plans as (
  select particle,kind,value as plan from particles cross join (values ('plan','plans'),('proposal','proposals')) kinds(kind,field)
  cross join lateral jsonb_array_elements(case when jsonb_typeof(particle#>array['data','planning',field])='array' then particle#>array['data','planning',field] else '[]'::jsonb end)
  where particle->>'type'='objective' and particle->>'id' ~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
 ), valid as (
  select * from plans where plan->>'researchRunId' ~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
   and plan->>'id' ~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
 )
 select distinct binding.id,(plan->>'researchRunId')::uuid from valid cross join lateral (
  select 'particle:'||(particle->>'id') as id
  union all select 'particle:'||(particle->>'id')||':'||kind||':'||(plan->>'id')
  union all select 'particle:'||member from jsonb_array_elements_text(case when jsonb_typeof(plan->'particleIds')='array' then plan->'particleIds' else '[]'::jsonb end) members(member)
   where member ~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
 ) binding;
$$;
revoke all on function public.workspace_particle_ai_bindings(jsonb) from public,anon,authenticated,service_role;

-- Historical proposals may be absent, retired or not parseable. Preserve an
-- unresolved binding rather than inventing an empty dependency set. Only the
-- server's immutable receipt supplies dependency metadata, never board JSON.
create function public.workspace_particle_ai_snapshot(p_org uuid,p_run uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare raw text; proposal jsonb;
begin
 select receipt.result->>'proposal' into raw from public.workspace_ai_result_receipts receipt
 join public.workspace_ai_runs run on run.id=receipt.run_id
 where run.id=p_run and run.org_id=p_org and run.target->>'kind'='particle_research'
  and receipt.result->>'status'='succeeded';
 if raw is null then return null;end if;
 begin proposal:=raw::jsonb; exception when invalid_text_representation then return null;end;
 if proposal->>'runId' is distinct from p_run::text or proposal#>>'{target,organizationId}' is distinct from p_org::text
  or jsonb_typeof(proposal->'dependencies') is distinct from 'object' then return null;end if;
 return proposal->'dependencies';
end $$;
revoke all on function public.workspace_particle_ai_snapshot(uuid,uuid) from public,anon,authenticated,service_role;

create function public.capture_workspace_particle_ai_origins(p_org uuid,p_state jsonb) returns void
language sql security definer set search_path='' as $$
 with missing as materialized (
  select b.* from public.workspace_particle_ai_bindings(p_state) b where not exists (
   select 1 from public.workspace_particle_ai_origins o where o.org_id=p_org and o.record_id=b.record_id and o.run_id=b.run_id)
 ), snapshots as materialized (
  select run_id,public.workspace_particle_ai_snapshot(p_org,run_id) as dependencies from (select distinct run_id from missing) runs
 )
 insert into public.workspace_particle_ai_origins(org_id,record_id,run_id,dependencies)
  select p_org,m.record_id,m.run_id,s.dependencies from missing m join snapshots s using(run_id) on conflict do nothing;
$$;
revoke all on function public.capture_workspace_particle_ai_origins(uuid,jsonb) from public,anon,authenticated,service_role;

create function public.retain_workspace_particle_ai_origins() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 -- Capture the previous graph as well: the first post-upgrade edit may remove
 -- a member or its objective. Both snapshots commit with the board's CAS write.
 if tg_op in ('UPDATE','DELETE') then
  perform public.capture_workspace_particle_ai_origins(old.org_id,old.state);
 end if;
 if tg_op in ('INSERT','UPDATE') then
  perform public.capture_workspace_particle_ai_origins(new.org_id,new.state);
 end if;
 return null;
end $$;
revoke all on function public.retain_workspace_particle_ai_origins() from public,anon,authenticated,service_role;
create trigger workspace_particle_ai_origins after insert or update of state or delete on public.organization_workspace_boards
 for each row execute function public.retain_workspace_particle_ai_origins();
select public.capture_workspace_particle_ai_origins(org_id,state) from public.organization_workspace_boards;

-- Internal metadata only: no prompt, answer, source title or private transcript.
-- Known file IDs include uncited observations. Unknown historical lineage is
-- reported explicitly; callers must not interpret it as proof of no sources.
create function public.read_workspace_particle_ai_files(p_org_id uuid,p_actor_id uuid,p_record_ids text[])
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.role() is distinct from 'service_role' or p_actor_id is null
  or p_actor_id is distinct from public.organization_activity_actor_id()
  or not public.can_read_workspace_ai(p_org_id,p_actor_id) then
  raise exception 'Particle source access denied.' using errcode='42501';end if;
 if p_record_ids is null or cardinality(p_record_ids)>500 or exists(select 1 from unnest(p_record_ids) id where id is null or length(id)>125) then
  raise exception 'Invalid particle source request.' using errcode='22023';end if;
 return (with origins as (
  select record_id,dependencies from public.workspace_particle_ai_origins where org_id=p_org_id and record_id=any(p_record_ids)
 ), files as (
  select record_id,value as file_id from origins cross join lateral jsonb_array_elements_text(case when jsonb_typeof(dependencies->'nativeFileIds')='array' then dependencies->'nativeFileIds' else '[]'::jsonb end)
  union
  select record_id,substr(value->>'id',6) from origins cross join lateral jsonb_array_elements(case when jsonb_typeof(dependencies->'records')='array' then dependencies->'records' else '[]'::jsonb end)
   where value->>'id' like 'file:%'
 ), records as (
  select record_id,
   -- All historical results still require an audit of implicit/transitive
   -- inputs. This version deliberately makes no completeness assertion.
   false as complete,
   coalesce((select jsonb_agg(distinct file_id order by file_id) from files where files.record_id=o.record_id
    and file_id ~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'),'[]'::jsonb) as file_ids
  from origins o group by record_id
 ) select coalesce(jsonb_agg(jsonb_build_object('id',record_id,'fileIds',file_ids,'complete',complete) order by record_id),'[]'::jsonb) from records);
end $$;
revoke all on function public.read_workspace_particle_ai_files(uuid,uuid,text[]) from public,anon,authenticated;
grant execute on function public.read_workspace_particle_ai_files(uuid,uuid,text[]) to service_role;
comment on table public.workspace_particle_ai_origins is 'Append-only, server-owned source observations for generated board records. Not complete historical provenance; raw board/profile, transitive inputs, retirement and privacy cutover remain gated.';
commit;
