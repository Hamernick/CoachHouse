-- Private checkpoints never enter graph JSON, public projections or model context.
create table public.workspace_research_drafts (
  run_id uuid primary key references public.workspace_ai_runs(id) on delete cascade,
  base_hash text not null check (base_hash ~ '^[a-f0-9]{64}$'),
  revision integer not null default 0 check (revision >= 0),
  draft jsonb check (draft is null or (jsonb_typeof(draft)='object' and octet_length(draft::text)<=65536)),
  attempted boolean not null default false,
  edit_id uuid, edit_revision integer,
  updated_at timestamptz not null default clock_timestamp(),
  check (not attempted or draft is not null)
);
alter table public.workspace_research_drafts enable row level security;
revoke all on public.workspace_research_drafts from public,anon,authenticated,service_role;

-- Server-only: source authorization and strict draft validation precede this call.
-- The run lock serializes first inserts, compare-and-swap and duplicate requests.
create function public.access_workspace_research_draft(
  p_run_id uuid,p_org_id uuid,p_actor_id uuid,p_base text,
  p_edit_id uuid,p_revision integer,p_draft jsonb,p_attempted boolean
) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.workspace_ai_runs; d public.workspace_research_drafts;
begin
  if p_org_id is null or p_actor_id is null or public.can_use_workspace_ai(p_org_id,p_actor_id) is not true then
    raise exception 'Draft access denied' using errcode='42501';
  end if;
  select * into r from public.workspace_ai_runs where id=p_run_id for update;
  if r.id is null or r.org_id<>p_org_id or r.actor_id<>p_actor_id or r.status<>'succeeded'
    or r.task<>'plan' or r.target->>'kind' is distinct from 'particle_research' then
    raise exception 'Draft access denied' using errcode='42501';
  end if;
  if p_base is null or p_base !~ '^[a-f0-9]{64}$' then raise exception 'Invalid draft base'; end if;
  select * into d from public.workspace_research_drafts where run_id=p_run_id;
  if d.run_id is not null and d.base_hash<>p_base then
    raise exception 'Draft base changed' using errcode='40001';
  end if;
  if p_edit_id is not null then
    if p_revision is null or p_revision<0 or p_attempted is null or (p_attempted and p_draft is null) then raise exception 'Invalid draft write'; end if;
    if d.edit_id=p_edit_id then
      if d.edit_revision<>p_revision or d.draft is distinct from p_draft or d.attempted<>p_attempted then
        raise exception 'Draft retry changed' using errcode='40001';
      end if;
    else
      if coalesce(d.revision,0)<>p_revision then raise exception 'Draft revision changed' using errcode='40001'; end if;
      -- A save attempt pins the exact retry payload until explicit discard.
      if d.attempted and p_draft is not null and (d.draft is distinct from p_draft or not p_attempted) then
        raise exception 'Draft application pending' using errcode='40001';
      end if;
      insert into public.workspace_research_drafts(run_id,base_hash,revision,draft,attempted,edit_id,edit_revision)
        values(p_run_id,p_base,p_revision+1,p_draft,p_attempted,p_edit_id,p_revision)
      on conflict(run_id) do update set revision=excluded.revision,draft=excluded.draft,attempted=excluded.attempted,
        edit_id=excluded.edit_id,edit_revision=excluded.edit_revision,updated_at=clock_timestamp()
      returning * into d;
    end if;
  end if;
  return jsonb_build_object('revision',coalesce(d.revision,0),'draft',d.draft,'attempted',coalesce(d.attempted,false));
end $$;
revoke all on function public.access_workspace_research_draft(uuid,uuid,uuid,text,uuid,integer,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.access_workspace_research_draft(uuid,uuid,uuid,text,uuid,integer,jsonb,boolean) to service_role;
