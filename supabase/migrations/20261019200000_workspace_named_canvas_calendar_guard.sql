-- Extend the existing calendar projection/authorization trigger to every named
-- canvas. No source data moves, backfills, or permission grants are changed.
create or replace function public.workspace_particle_calendar_projection(p_state jsonb)
returns jsonb language sql immutable set search_path = '' as $$
  select coalesce(jsonb_agg(event order by event->>'id', event::text), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'id', particle->'id', 'canvasId', canvas_id, 'title', particle->'title',
      'description', coalesce(particle->>'description', ''),
      'startsAt', particle#>'{data,widget,startsAt}',
      'location', coalesce(particle#>>'{data,widget,location}', ''),
      'attendees', coalesce(nullif(particle#>'{data,widget,attendees}', 'null'::jsonb), '[]'::jsonb)
    ) as event
    from (
      select null::text as canvas_id, p_state as canvas_state
      union all
      select entry->>'id', entry->'state'
      from jsonb_array_elements(case
        when jsonb_typeof(p_state#>'{workspaceCatalog,entries}') = 'array'
          then p_state#>'{workspaceCatalog,entries}' else '[]'::jsonb end) as entries(entry)
    ) as canvases
    cross join lateral jsonb_array_elements(case
      when jsonb_typeof(canvas_state#>'{particleGraph,particles}') = 'array'
        then canvas_state#>'{particleGraph,particles}' else '[]'::jsonb end) as particles(particle)
    where particle->>'type' = 'activity'
      and particle#>>'{data,widget,kind}' = 'event'
      and jsonb_typeof(particle#>'{data,widget,startsAt}') = 'string'
      and particle#>>'{data,widget,startsAt}' <> ''
      and coalesce(particle#>>'{data,source,kind}', '') <> 'calendar_event'
  ) as scheduled;
$$;
revoke all on function public.workspace_particle_calendar_projection(jsonb) from public, anon, authenticated, service_role;

-- Older deployed clients write only the original canvas. Preserve the new
-- catalog when those clients omit it; explicit catalog edits still use CAS.
create or replace function public.preserve_workspace_canvas_catalog()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.state ? 'workspaceCatalog' and not (new.state ? 'workspaceCatalog') then
    new.state = jsonb_set(new.state, '{workspaceCatalog}', old.state->'workspaceCatalog');
  end if;
  return new;
end;
$$;
revoke all on function public.preserve_workspace_canvas_catalog() from public, anon, authenticated, service_role;
drop trigger if exists preserve_workspace_canvas_catalog on public.organization_workspace_boards;
create trigger preserve_workspace_canvas_catalog before update of state on public.organization_workspace_boards
  for each row execute function public.preserve_workspace_canvas_catalog();

-- App writes remain gated until the database guard understands named canvases.
create or replace function public.workspace_canvas_storage_version()
returns integer language sql immutable set search_path = '' as $$ select 1; $$;
revoke all on function public.workspace_canvas_storage_version() from public, anon;
grant execute on function public.workspace_canvas_storage_version() to authenticated, service_role;
