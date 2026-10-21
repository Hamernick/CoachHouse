-- Working-state recovery for existing uploaded Markdown files. Canonical bytes
-- remain in org-documents; no provider files or workspace graph records move.
create table public.document_collaboration_rooms (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(user_id) on delete cascade,
  file_id uuid not null unique references public.organization_document_files(id) on delete cascade,
  generation uuid not null default gen_random_uuid(),
  base_revision text not null check (length(base_revision) between 1 and 256),
  base_updated_at timestamptz not null,
  checkpoint bytea not null check (octet_length(checkpoint) between 1 and 2097152),
  checkpoint_sequence bigint not null default 0 check (checkpoint_sequence >= 0),
  last_sequence bigint not null default 0 check (last_sequence >= checkpoint_sequence),
  canonical_sequence bigint not null default 0 check (canonical_sequence between 0 and last_sequence),
  recovery_bytes bigint not null default 0 check (recovery_bytes between 0 and 8388608),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index document_collaboration_rooms_org_idx on public.document_collaboration_rooms(org_id);

create table public.document_collaboration_updates (
  room_id uuid not null references public.document_collaboration_rooms(id) on delete cascade,
  sequence bigint not null check (sequence > 0),
  batch_id uuid not null,
  generation uuid not null,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  payload bytea check (payload is null or octet_length(payload) between 1 and 131072),
  payload_hash bytea not null check (octet_length(payload_hash) = 32),
  created_at timestamptz not null default now(),
  primary key (room_id, sequence),
  unique (room_id, batch_id)
);

alter table public.document_collaboration_rooms enable row level security;
alter table public.document_collaboration_rooms force row level security;
alter table public.document_collaboration_updates enable row level security;
alter table public.document_collaboration_updates force row level security;
revoke all on public.document_collaboration_rooms, public.document_collaboration_updates from public, anon, authenticated;
grant select on public.document_collaboration_rooms, public.document_collaboration_updates to authenticated;
grant all on public.document_collaboration_rooms, public.document_collaboration_updates to service_role;

-- Reuse the canonical file's existing RLS instead of granting a room merely
-- because a user knows its UUID or has a canvas collaboration invitation.
create policy document_collaboration_rooms_read on public.document_collaboration_rooms
for select to authenticated using (exists (
  select 1 from public.organization_document_files f
  where f.id = file_id and f.org_id = document_collaboration_rooms.org_id
    and f.document_kind is null and f.deleted_at is null
    and f.storage_path like f.org_id::text || '/library/%'
));
create policy document_collaboration_updates_read on public.document_collaboration_updates
for select to authenticated using (exists (
  select 1 from public.document_collaboration_rooms r where r.id = room_id
));

create function public.can_edit_uploaded_document(p_file_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.organization_document_files f
    where f.id = p_file_id and (select auth.uid()) is not null
      and f.deleted_at is null and f.document_kind is null
      and f.name ~* '\.(md|markdown)$'
      and f.storage_path like f.org_id::text || '/library/%'
      and public.has_workspace_paid_features(f.org_id)
      and (public.is_admin() or f.org_id = (select auth.uid()) or exists (
        select 1 from public.organization_memberships m
        where m.org_id = f.org_id and m.member_id = (select auth.uid())
          and m.role in ('admin', 'staff')
      ))
  );
$$;
revoke all on function public.can_edit_uploaded_document(uuid) from public, anon;
grant execute on function public.can_edit_uploaded_document(uuid) to authenticated;

create function public.can_edit_document_room(p_room_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.document_collaboration_rooms r
    join public.organization_document_files f on f.id = r.file_id and f.org_id = r.org_id
    where r.id = p_room_id and public.can_edit_uploaded_document(f.id)
  );
$$;
revoke all on function public.can_edit_document_room(uuid) from public, anon;
grant execute on function public.can_edit_document_room(uuid) to authenticated, service_role;

-- Server-only bootstrap: clients never supply a competing initial document.
create function public.initialize_document_room(
  p_file_id uuid, p_actor_id uuid, p_base_revision text,
  p_expected_updated_at timestamptz, p_checkpoint_base64 text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  f public.organization_document_files%rowtype;
  r public.document_collaboration_rooms%rowtype;
  initial_state bytea;
  used_bytes bigint;
begin
  select * into f from public.organization_document_files where id = p_file_id;
  if not found or p_actor_id is null or f.deleted_at is not null or f.document_kind is not null
    or f.storage_path not like f.org_id::text || '/library/%'
    or f.name !~* '\.(md|markdown)$'
    or not public.has_workspace_paid_features(f.org_id)
    or not (p_actor_id = f.org_id or exists (
      select 1 from public.organization_memberships m
      where m.org_id = f.org_id and m.member_id = p_actor_id and m.role in ('admin', 'staff')
    ) or exists (
      select 1 from public.platform_staff_members s
      where s.user_id = p_actor_id and s.access_level = 'developer'
    )) then raise exception 'Document access denied.' using errcode = '42501'; end if;
  -- Consistent lock order across initialization, writes and compaction.
  perform pg_advisory_xact_lock(hashtextextended(f.org_id::text, 141600));
  select * into f from public.organization_document_files where id = p_file_id for share;
  if f.updated_at is distinct from p_expected_updated_at or f.deleted_at is not null
    then raise exception 'Document source changed.' using errcode = '40001'; end if;
  select * into r from public.document_collaboration_rooms where file_id = f.id;
  if found then
    if r.base_updated_at is distinct from f.updated_at
      then raise exception 'Document source changed.' using errcode = '40001'; end if;
    return jsonb_build_object('roomId', r.id, 'generation', r.generation);
  end if;
  if p_checkpoint_base64 is null or length(p_checkpoint_base64) > 2796204
    or p_base_revision is null or length(p_base_revision) not between 1 and 256
    then raise exception 'Invalid document checkpoint.' using errcode = '22023'; end if;
  initial_state := decode(p_checkpoint_base64, 'base64');
  if octet_length(initial_state) not between 1 and 2097152
    then raise exception 'Invalid document checkpoint.' using errcode = '22023'; end if;
  select coalesce(sum(octet_length(checkpoint) + recovery_bytes), 0) into used_bytes
    from public.document_collaboration_rooms where org_id = f.org_id;
  if used_bytes + octet_length(initial_state) > 67108864
    then raise exception 'Document recovery capacity reached.' using errcode = '54000'; end if;
  insert into public.document_collaboration_rooms (
    org_id, file_id, base_revision, base_updated_at, checkpoint, created_by
  ) values (f.org_id, f.id, p_base_revision, f.updated_at, initial_state, p_actor_id)
  returning * into r;
  return jsonb_build_object('roomId', r.id, 'generation', r.generation);
end;
$$;
revoke all on function public.initialize_document_room(uuid, uuid, text, timestamptz, text) from public, anon, authenticated;
grant execute on function public.initialize_document_room(uuid, uuid, text, timestamptz, text) to service_role;

create function public.append_document_room_update(
  p_room_id uuid, p_generation uuid, p_batch_id uuid, p_update_base64 text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  r public.document_collaboration_rooms%rowtype;
  previous public.document_collaboration_updates%rowtype;
  update_bytes bytea;
  used_bytes bigint;
  actor uuid := (select auth.uid());
begin
  if actor is null or not public.can_edit_document_room(p_room_id)
    then raise exception 'Document access denied.' using errcode = '42501'; end if;
  if p_batch_id is null or p_update_base64 is null or length(p_update_base64) > 174764
    then raise exception 'Invalid document update.' using errcode = '22023'; end if;
  update_bytes := decode(p_update_base64, 'base64');
  if octet_length(update_bytes) not between 1 and 131072
    then raise exception 'Invalid document update.' using errcode = '22023'; end if;
  select * into r from public.document_collaboration_rooms where id = p_room_id;
  perform pg_advisory_xact_lock(hashtextextended(r.org_id::text, 141600));
  select * into r from public.document_collaboration_rooms where id = p_room_id for update;
  if not found or r.generation is distinct from p_generation
    then raise exception 'Document session changed.' using errcode = '40001'; end if;
  if not public.can_edit_document_room(r.id)
    then raise exception 'Document access denied.' using errcode = '42501'; end if;
  if not exists (select 1 from public.organization_document_files f
    where f.id = r.file_id and f.org_id = r.org_id and f.updated_at = r.base_updated_at and f.deleted_at is null)
    then raise exception 'Document source changed.' using errcode = '40001'; end if;
  select * into previous from public.document_collaboration_updates
    where room_id = r.id and batch_id = p_batch_id;
  if found then
    if previous.generation is distinct from r.generation
      then raise exception 'Document session changed.' using errcode = '40001'; end if;
    if previous.actor_id <> actor or previous.payload_hash <> sha256(update_bytes)
      then raise exception 'Document receipt does not match this update.' using errcode = '22023'; end if;
    return jsonb_build_object('batchId', p_batch_id, 'sequence', previous.sequence, 'generation', r.generation);
  end if;
  select coalesce(sum(octet_length(checkpoint) + recovery_bytes), 0) into used_bytes
    from public.document_collaboration_rooms where org_id = r.org_id;
  if r.last_sequence - r.checkpoint_sequence >= 512
    or r.recovery_bytes + octet_length(update_bytes) > 8388608
    or used_bytes + octet_length(update_bytes) > 67108864
    then raise exception 'Document recovery capacity reached.' using errcode = '54000'; end if;
  insert into public.document_collaboration_updates(room_id, sequence, batch_id, generation, actor_id, payload, payload_hash)
    values(r.id, r.last_sequence + 1, p_batch_id, r.generation, actor, update_bytes, sha256(update_bytes));
  update public.document_collaboration_rooms set last_sequence = r.last_sequence + 1,
    recovery_bytes = r.recovery_bytes + octet_length(update_bytes), updated_at = now() where id = r.id;
  return jsonb_build_object('batchId', p_batch_id, 'sequence', r.last_sequence + 1, 'generation', r.generation);
end;
$$;
revoke all on function public.append_document_room_update(uuid, uuid, uuid, text) from public, anon;
grant execute on function public.append_document_room_update(uuid, uuid, uuid, text) to authenticated;

-- The server verifies and merges the snapshot/tail first. Sequence CAS prevents
-- a concurrent append from being dropped, and archived rows retain retry hashes.
create function public.compact_document_room(
  p_room_id uuid, p_generation uuid, p_expected_sequence bigint, p_checkpoint_base64 text
) returns boolean language plpgsql security definer set search_path = '' as $$
declare
  r public.document_collaboration_rooms%rowtype;
  checkpoint_bytes bytea;
  used_bytes bigint;
begin
  if p_checkpoint_base64 is null or length(p_checkpoint_base64) > 2796204
    then raise exception 'Invalid document checkpoint.' using errcode = '22023'; end if;
  checkpoint_bytes := decode(p_checkpoint_base64, 'base64');
  if octet_length(checkpoint_bytes) not between 1 and 2097152
    then raise exception 'Invalid document checkpoint.' using errcode = '22023'; end if;
  select * into r from public.document_collaboration_rooms where id = p_room_id;
  if not found then return false; end if;
  perform pg_advisory_xact_lock(hashtextextended(r.org_id::text, 141600));
  select * into r from public.document_collaboration_rooms where id = p_room_id for update;
  if r.generation is distinct from p_generation or r.last_sequence is distinct from p_expected_sequence
    then return false; end if;
  select coalesce(sum(octet_length(checkpoint) + recovery_bytes), 0) into used_bytes
    from public.document_collaboration_rooms where org_id = r.org_id and id <> r.id;
  if used_bytes + octet_length(checkpoint_bytes) > 67108864
    then raise exception 'Document recovery capacity reached.' using errcode = '54000'; end if;
  update public.document_collaboration_rooms set checkpoint = checkpoint_bytes,
    checkpoint_sequence = r.last_sequence, recovery_bytes = 0, updated_at = now() where id = r.id;
  update public.document_collaboration_updates set payload = null
    where room_id = r.id and sequence <= r.last_sequence and payload is not null;
  delete from public.document_collaboration_updates where room_id = r.id
    and sequence <= r.last_sequence and (created_at < now() - interval '72 hours' or sequence <= r.last_sequence - 2048);
  return true;
end;
$$;
revoke all on function public.compact_document_room(uuid, uuid, bigint, text) from public, anon, authenticated;
grant execute on function public.compact_document_room(uuid, uuid, bigint, text) to service_role;

-- Realtime is scoped to committed INSERT rows. No DELETE payload subscription.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.document_collaboration_updates;
  end if;
end;
$$;
