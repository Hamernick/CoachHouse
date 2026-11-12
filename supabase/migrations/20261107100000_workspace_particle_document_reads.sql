-- Known document-bearing boards use the existing authenticated server audience
-- projection. No canonical state, source grants or private-folder flags change.
begin;
create or replace function public.can_read_workspace_particle_board(p_org uuid,p_state jsonb)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=auth.uid();
begin
 -- Never accept a caller-supplied actor or the service actor header here.
 -- Parent RLS still applies. A direct helper call cannot probe another org.
 if actor is null or not public.can_read_workspace_particle_origins(p_org,actor) then return false;end if;
 if exists (
  select 1 from public.workspace_particle_board_files(p_org,p_state) dependency
  left join public.organization_document_files file on file.id=dependency.file_id and file.org_id=p_org
  where file.id is null or not public.document_file_folder_actor_can(dependency.file_id,actor,'view')
 ) then
  raise exception 'Board source access required.' using errcode='42501';
 end if;
 -- Document resolution (IDs, slugs, active editor source and retained copies)
 -- belongs to the existing server projection. Raw JSON cannot safely filter a
 -- board, so require that path whenever a current document dependency exists.
 -- Do not return false: an absent row can trigger empty-board initialization.
 if exists (
  with particles as (
   select value as body from public.workspace_particle_board_graphs(p_state)
   cross join lateral jsonb_array_elements(public.workspace_particle_array(graph->'particles'))
  ), plans as (
   select value as body from particles
   cross join (values ('plans'),('proposals')) fields(name)
   cross join lateral jsonb_array_elements(public.workspace_particle_array(body#>array['data','planning',name]))
   where body->>'type'='objective'
  )
  select 1 from particles where body->>'type'='activity'
   and body#>>'{data,widget,kind}'='document'
   and body#>>'{data,widget,source,kind}'='roadmap'
  union all
  select 1 from plans cross join lateral jsonb_array_elements(public.workspace_particle_array(body->'sources'))
   where value->>'kind'='workspace' and value->>'id' ~ '^(document|roadmap):'
 ) then
  raise exception 'Board source access required.' using errcode='42501';
 end if;
 return true;
end;
$$;
comment on function public.can_read_workspace_particle_board(uuid,jsonb) is
 'Authenticated raw-board native-file fence and current document projection gate. Owner/member access continues through verified server projection. Unknown historical copies and private activation remain unqualified.';
commit;
