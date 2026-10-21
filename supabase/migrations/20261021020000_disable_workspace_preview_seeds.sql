-- Retire persisted workspace previews. Returning NULL keeps older deployed
-- loaders/upserts compatible while preventing new dummy projects and tasks.
-- Existing records and ordinary user/system/import inserts are unaffected.
create function public.suppress_workspace_preview_seed_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.created_source = 'starter_seed' then
    return null;
  end if;
  return new;
end;
$$;

revoke all on function public.suppress_workspace_preview_seed_insert()
  from public, anon, authenticated;

create trigger suppress_workspace_preview_seed_insert
before insert on public.organization_projects
for each row execute function public.suppress_workspace_preview_seed_insert();

create trigger suppress_workspace_preview_seed_insert
before insert on public.organization_tasks
for each row execute function public.suppress_workspace_preview_seed_insert();
