drop trigger if exists preserve_workspace_canvas_catalog on public.organization_workspace_boards;
drop function if exists public.preserve_workspace_canvas_catalog();
-- Disable named-canvas writes before reverting; saved canvases remain intact.
drop function if exists public.workspace_canvas_storage_version();
create or replace function public.workspace_particle_calendar_projection(p_state jsonb)
returns jsonb language sql immutable set search_path = '' as $$
  select coalesce(jsonb_agg(event order by event->>'id', event::text), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'id', particle->'id', 'title', particle->'title',
      'description', coalesce(particle->>'description', ''),
      'startsAt', particle#>'{data,widget,startsAt}',
      'location', coalesce(particle#>>'{data,widget,location}', ''),
      'attendees', coalesce(nullif(particle#>'{data,widget,attendees}', 'null'::jsonb), '[]'::jsonb)
    ) as event
    from jsonb_array_elements(case
      when jsonb_typeof(p_state#>'{particleGraph,particles}') = 'array'
        then p_state#>'{particleGraph,particles}' else '[]'::jsonb end) as particles(particle)
    where particle->>'type' = 'activity'
      and particle#>>'{data,widget,kind}' = 'event'
      and jsonb_typeof(particle#>'{data,widget,startsAt}') = 'string'
      and particle#>>'{data,widget,startsAt}' <> ''
      and coalesce(particle#>>'{data,source,kind}', '') <> 'calendar_event'
  ) as scheduled;
$$;
revoke all on function public.workspace_particle_calendar_projection(jsonb) from public, anon, authenticated, service_role;
