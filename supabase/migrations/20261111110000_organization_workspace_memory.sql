-- Explicit organization guidance, separate from private personal entries.
-- Additive only: existing personal data, identity and RPC remain unchanged.
-- Roll back application activation first; retain this table to preserve saved data.
begin;
create table public.organization_workspace_memory (
  org_id uuid not null references public.organizations(user_id) on delete cascade,
  enabled boolean not null default false,
  revision integer not null default 0 check (revision >= 0),
  entries jsonb not null default '[]' check (jsonb_typeof(entries)='array' and jsonb_array_length(entries)<=20),
  updated_at timestamptz,
  primary key (org_id)
);
alter table public.organization_workspace_memory enable row level security;
alter table public.organization_workspace_memory force row level security;
revoke all on public.organization_workspace_memory from public,anon,authenticated,service_role;
-- All direct table access is denied. The scoped RPC is the sole reader/writer.

create function public.manage_organization_workspace_memory(p_org_id uuid,p_action text default 'read',p_revision integer default null,
 p_entry_id uuid default null,p_value text default null,p_enabled boolean default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); current_row public.organization_workspace_memory; existing jsonb; stamp timestamptz:=clock_timestamp();
begin
 if actor is null or auth.role() is distinct from 'authenticated' or not public.can_read_workspace_ai(p_org_id,actor) then
  raise exception 'Memory unavailable.' using errcode='42501'; end if;
 if p_action is null or p_action not in ('read','enable','save','delete','clear') then
  raise exception 'Invalid memory action.' using errcode='22023';end if;
 -- Organization settings/spending authority is the actual organization owner.
 if p_action<>'read' then
  if actor<>p_org_id then raise exception 'Only the organization owner can manage shared guidance.' using errcode='42501';end if;
  perform public.guard_organization_closure(p_org_id);
 end if;
 -- One scope lock also serializes first-write races. Reads never create data.
 perform pg_advisory_xact_lock(hashtextextended('organization-memory:'||p_org_id::text,0));
 if not public.can_read_workspace_ai(p_org_id,actor) then raise exception 'Memory unavailable.' using errcode='42501';end if;
 select * into current_row from public.organization_workspace_memory where org_id=p_org_id for update;
 if not found then
  current_row.org_id:=p_org_id;current_row.enabled:=false;current_row.revision:=0;current_row.entries:='[]';
 end if;
 if p_action<>'read' then
  if p_revision is distinct from current_row.revision then raise exception 'Memory changed.' using errcode='40001';end if;
  if p_action='enable' then
   if p_enabled is null then raise exception 'Invalid setting.' using errcode='22023';end if;
   current_row.enabled:=p_enabled;
  elsif p_action='clear' then current_row.entries:='[]';current_row.enabled:=false;
  elsif p_action='delete' then
   if p_entry_id is null or not exists(select 1 from jsonb_array_elements(current_row.entries) e where e->>'id'=p_entry_id::text) then
    raise exception 'Memory changed.' using errcode='40001';end if;
   select coalesce(jsonb_agg(e order by n),'[]') into current_row.entries
    from jsonb_array_elements(current_row.entries) with ordinality a(e,n) where e->>'id'<>p_entry_id::text;
  elsif p_action='save' then
   if not current_row.enabled then raise exception 'Enable memory before saving.' using errcode='42501';end if;
   p_value:=btrim(p_value);
   if p_entry_id is null or p_value is null or length(p_value) not between 1 and 500 then
    raise exception 'Invalid guidance.' using errcode='22023';end if;
   select e into existing from jsonb_array_elements(current_row.entries) e where e->>'id'=p_entry_id::text;
   if existing is null and jsonb_array_length(current_row.entries)>=20 then raise exception 'Memory is full.' using errcode='22023';end if;
   if existing is not null then
    select coalesce(jsonb_agg(e order by n),'[]') into current_row.entries
     from jsonb_array_elements(current_row.entries) with ordinality a(e,n) where e->>'id'<>p_entry_id::text;
   end if;
   current_row.entries:=current_row.entries||jsonb_build_array(jsonb_build_object('id',p_entry_id,'value',p_value,
    'revision',coalesce((existing->>'revision')::integer,0)+1,'createdAt',coalesce(existing->>'createdAt',stamp::text),'updatedAt',stamp,'createdBy',coalesce(existing->>'createdBy',actor::text),'updatedBy',actor));
  end if;
  current_row.revision:=current_row.revision+1;current_row.updated_at:=stamp;
  insert into public.organization_workspace_memory values(current_row.*)
   on conflict (org_id) do update set enabled=excluded.enabled,revision=excluded.revision,entries=excluded.entries,updated_at=excluded.updated_at;
 end if;
 return jsonb_build_object('version',1,'organizationId',p_org_id,'actorId',actor,'scope','organization','canManage',actor=p_org_id,'enabled',current_row.enabled,
  'revision',current_row.revision,'updatedAt',current_row.updated_at,'basis','organization_authored','retention','until_deleted','entries',current_row.entries);
end $$;
revoke all on function public.manage_organization_workspace_memory(uuid,text,integer,uuid,text,boolean) from public,anon,authenticated,service_role;
grant execute on function public.manage_organization_workspace_memory(uuid,text,integer,uuid,text,boolean) to authenticated;
comment on table public.organization_workspace_memory is 'Explicit shared guidance authored by the organization owner. Current AI members may read; only the owner manages. Never populated from personal memory or source ingestion. Off retains entries; clear removes them while retaining revision fencing. No factual or authorization authority.';
commit;
