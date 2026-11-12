begin;
-- Private presentation metadata; accounting runs and saved board records remain intact.
create table public.workspace_research_chats (
  root_id uuid primary key references public.workspace_ai_runs(id) on delete cascade,
  title text check (title is null or (length(btrim(title)) between 1 and 120)),
  pinned boolean not null default false,
  deleted_at timestamptz,
  revision bigint not null default 0 check (revision >= 0),
  updated_at timestamptz not null default now()
);
alter table public.workspace_research_chats enable row level security;
revoke all on public.workspace_research_chats from public,anon,authenticated;

create function public.manage_workspace_research_conversation(p_org_id uuid,p_actor_id uuid,p_canvas_id text,p_root_id uuid,p_operation text,p_revision bigint default 0,p_title text default null,p_pinned boolean default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.workspace_ai_runs; m public.workspace_research_chats;
begin
  if not public.can_read_workspace_ai(p_org_id,p_actor_id) then raise exception 'Chat access denied' using errcode='42501'; end if;
  if p_operation not in ('read','rename','pin','delete') then raise exception 'Invalid chat action'; end if;
  select * into r from public.workspace_ai_runs where id=p_root_id and org_id=p_org_id and actor_id=p_actor_id
    and target->>'kind'='particle_research' and target->>'mode'='new_objective'
    and target->'conversation'->>'id'=id::text and target->'conversation'->>'turn'='1'
    and (target->>'canvasId') is not distinct from p_canvas_id for update;
  if r.id is null then raise exception 'Chat unavailable' using errcode='42501'; end if;
  select * into m from public.workspace_research_chats where root_id=r.id;
  if p_operation='read' then return jsonb_build_object('title',m.title,'pinned',coalesce(m.pinned,false),'revision',coalesce(m.revision,0),'deleted',m.deleted_at is not null); end if;
  if m.deleted_at is not null or p_revision is distinct from coalesce(m.revision,0) then raise exception 'Chat changed. Reload and retry.' using errcode='40001'; end if;
  if p_operation='rename' and (p_title is null or length(btrim(p_title)) not between 1 and 120) then raise exception 'Invalid chat name'; end if;
  if p_operation='pin' and p_pinned is null then raise exception 'Invalid pin state'; end if;
  if p_operation='delete' and exists(select 1 from public.workspace_ai_runs where org_id=p_org_id and actor_id=p_actor_id
    and target->'conversation'->>'id'=r.id::text and status in ('reserved','running','reconciling')) then
    raise exception 'Wait for this chat to finish before deleting it.' using errcode='55000';
  end if;
  insert into public.workspace_research_chats(root_id,title,pinned,deleted_at,revision) values
    (r.id,case when p_operation='rename' then btrim(p_title) else m.title end,
    case when p_operation='pin' then p_pinned else coalesce(m.pinned,false) end,
    case when p_operation='delete' then now() else null end,coalesce(m.revision,0)+1)
  on conflict(root_id) do update set title=excluded.title,pinned=excluded.pinned,deleted_at=excluded.deleted_at,revision=excluded.revision,updated_at=now()
  returning * into m;
  return jsonb_build_object('title',m.title,'pinned',m.pinned,'revision',m.revision,'deleted',m.deleted_at is not null);
end $$;
revoke all on function public.manage_workspace_research_conversation(uuid,uuid,text,uuid,text,bigint,text,boolean) from public,anon,authenticated;
grant execute on function public.manage_workspace_research_conversation(uuid,uuid,text,uuid,text,bigint,text,boolean) to service_role;

create function public.guard_deleted_workspace_chat() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.target->'conversation'->>'parentId' is null then return new; end if;
  perform 1 from public.workspace_ai_runs where id=(new.target->'conversation'->>'id')::uuid for update;
  if exists(select 1 from public.workspace_research_chats where root_id=(new.target->'conversation'->>'id')::uuid and deleted_at is not null) then
    raise exception 'Chat deleted' using errcode='40001';
  end if;
  return new;
end $$;
create trigger workspace_research_conversation_lifecycle before insert on public.workspace_ai_runs for each row execute function public.guard_deleted_workspace_chat();
revoke all on function public.guard_deleted_workspace_chat() from public,anon,authenticated,service_role;

create or replace function public.list_workspace_research_conversation(p_org_id uuid,p_actor_id uuid,p_canvas_id text,p_root_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if not public.can_read_workspace_ai(p_org_id,p_actor_id) then raise exception 'AI access denied' using errcode='42501'; end if;
  return (select coalesce(jsonb_agg(to_jsonb(r) order by r."createdAt",r.turn),'[]'::jsonb) from (
    select run.id,run.target->'conversation'->>'id' as "rootId",(run.target->'conversation'->>'turn')::integer as turn,
      run.created_at as "createdAt",run.status,m.title as "customTitle",coalesce(m.pinned,false) as pinned,coalesce(m.revision,0) as "metadataRevision"
    from public.workspace_ai_runs run left join public.workspace_research_chats m on m.root_id=(run.target->'conversation'->>'id')::uuid
    where run.org_id=p_org_id and run.actor_id=p_actor_id and run.task='plan'
      and run.target->>'kind'='particle_research' and run.target->>'mode'='new_objective'
      and run.target->>'userId'=p_actor_id::text and run.target->>'organizationId'=p_org_id::text
      and run.target ? 'conversation' and run.target ? 'canvasId' and m.deleted_at is null
      and (run.target->>'canvasId') is not distinct from p_canvas_id
      and (p_root_id is null or run.target->'conversation'->>'id'=p_root_id::text)
      and (p_root_id is not null or not exists(select 1 from public.workspace_ai_runs child
        where child.org_id=p_org_id and child.actor_id=p_actor_id and child.target->'conversation'->>'parentId'=run.id::text))
    order by coalesce(m.pinned,false) desc,run.created_at desc,run.id desc limit 12
  ) r);
end $$;
commit;
