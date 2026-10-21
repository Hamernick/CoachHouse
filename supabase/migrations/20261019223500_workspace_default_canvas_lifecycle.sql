-- New organizations start with Build. A deleted original canvas is a durable
-- tombstone so stale/root-only clients cannot recreate it or calendar events.
create or replace function public.preserve_workspace_canvas_catalog()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if not (coalesce(new.state, '{}'::jsonb) ? 'workspaceCatalog') then
      new.state = jsonb_set(coalesce(new.state, '{}'::jsonb), '{workspaceCatalog}',
        '{"version":1,"defaultName":"Build","entries":[]}'::jsonb);
    end if;
  else
    if old.state ? 'workspaceCatalog' and not (new.state ? 'workspaceCatalog') then
      new.state = jsonb_set(new.state, '{workspaceCatalog}', old.state->'workspaceCatalog');
    end if;
    if old.state#>>'{workspaceCatalog,defaultDeleted}' = 'true' then
      new.state = jsonb_set(new.state, '{workspaceCatalog}', jsonb_set(
        case when jsonb_typeof(new.state->'workspaceCatalog') = 'object'
          then new.state->'workspaceCatalog' else old.state->'workspaceCatalog' end,
        '{defaultDeleted}', 'true'::jsonb));
    end if;
  end if;
  if new.state#>>'{workspaceCatalog,defaultDeleted}' = 'true' then
    new.state = jsonb_build_object(
      'nodes', '[]'::jsonb, 'connections', '[]'::jsonb,
      'visibility', '{"allCardsHiddenExplicitly":true,"organizationHiddenExplicitly":true}'::jsonb,
      'workspaceCatalog', new.state->'workspaceCatalog'
    );
  end if;
  return new;
end;
$$;
revoke all on function public.preserve_workspace_canvas_catalog() from public, anon, authenticated, service_role;
drop trigger if exists preserve_workspace_canvas_catalog on public.organization_workspace_boards;
create trigger preserve_workspace_canvas_catalog before insert or update of state on public.organization_workspace_boards
  for each row execute function public.preserve_workspace_canvas_catalog();
create or replace function public.workspace_canvas_storage_version()
returns integer language sql immutable set search_path = '' as $$ select 2; $$;
revoke all on function public.workspace_canvas_storage_version() from public, anon;
grant execute on function public.workspace_canvas_storage_version() to authenticated, service_role;
