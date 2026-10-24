-- Explicit canonical saves only. Native drafts still live in the room ledger.
-- Previous private objects remain referenced; no file/canvas UUID changes.
create table public.document_file_versions (
  id uuid primary key default gen_random_uuid(),
  file_id uuid not null references public.organization_document_files(id) on delete restrict,
  org_id uuid not null references public.organizations(user_id) on delete restrict,
  request_id uuid,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  storage_path text not null unique,
  name text not null check (length(name) between 1 and 1024),
  mime_type text not null check (length(mime_type) between 1 and 255),
  size_bytes bigint not null check (size_bytes between 0 and 1048576),
  content_hash text not null check (content_hash ~ '^[a-f0-9]{64}$'),
  revision text not null check (length(revision) between 1 and 256),
  source_updated_at timestamptz not null,
  generation uuid not null,
  sequence bigint not null check (sequence >= 0),
  restored_from uuid references public.document_file_versions(id) on delete restrict,
  request_fingerprint text,
  request_context jsonb,
  created_at timestamptz not null default now(),
  unique(file_id, request_id),
  constraint document_file_versions_scope check (storage_path like org_id::text || '/library/%' and storage_path !~ '(^|/)\.\.(/|$)')
);
create index document_file_versions_file_created_idx on public.document_file_versions(file_id, created_at desc, id);
create index document_file_versions_org_idx on public.document_file_versions(org_id);
alter table public.document_file_versions enable row level security;
alter table public.document_file_versions force row level security;
revoke all on public.document_file_versions from public, anon, authenticated;
grant select on public.document_file_versions to authenticated;
grant all on public.document_file_versions to service_role;
create policy document_file_versions_read on public.document_file_versions
for select to authenticated using (exists (
  select 1 from public.organization_document_files f where f.id=file_id
    and f.org_id=document_file_versions.org_id and f.document_kind is null and f.deleted_at is null
));

-- Bounded reservations fence Storage API staging/cleanup against a concurrent
-- commit. No client can create operations or write the reserved object prefix.
create table public.document_version_operations (
  file_id uuid not null references public.organization_document_files(id) on delete cascade,
  request_id uuid not null, org_id uuid not null references public.organizations(user_id) on delete cascade,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  fingerprint text not null, staged_bytes bigint not null check (staged_bytes between 0 and 2097152),
  state text not null default 'staged' check (state in ('staged','committed','abandoned','cleaned')),
  created_at timestamptz not null default now(),
  primary key(file_id,request_id)
);
create index document_version_operations_org_state_idx on public.document_version_operations(org_id,state);
alter table public.document_version_operations enable row level security;
alter table public.document_version_operations force row level security;
revoke all on public.document_version_operations from public,anon,authenticated;
grant all on public.document_version_operations to service_role;

-- Existing user storage policies must not permit overwrite/removal of history.
-- Service cleanup needs a separate verified version-purge operation before rollout.
create function public.is_document_version_object(p_bucket text, p_path text)
returns boolean language sql stable security definer set search_path='' as $$
  select p_bucket='org-documents' and (
    p_path ~ '^[0-9a-f-]{36}/library/versions/' or exists (
      select 1 from public.document_file_versions v where v.storage_path=p_path
    )
  );
$$;
revoke all on function public.is_document_version_object(text,text) from public, anon;
grant execute on function public.is_document_version_object(text,text) to authenticated;
create policy document_versions_reserved_insert on storage.objects as restrictive
for insert to authenticated with check (not public.is_document_version_object(bucket_id,name));
create policy document_versions_immutable_update on storage.objects as restrictive
for update to authenticated using (not public.is_document_version_object(bucket_id,name))
with check (not public.is_document_version_object(bucket_id,name));
create policy document_versions_immutable_delete on storage.objects as restrictive
for delete to authenticated using (not public.is_document_version_object(bucket_id,name));

create function public.document_version_actor_can_edit(p_file_id uuid, p_actor_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists (
    select 1 from public.organization_document_files f where f.id=p_file_id
      and p_actor_id is not null and f.document_kind is null and f.deleted_at is null
      and f.storage_path like f.org_id::text || '/library/%' and f.name ~* '\.(md|markdown)$'
      and public.has_workspace_paid_features(f.org_id)
      and (f.org_id=p_actor_id or exists (
        select 1 from public.organization_memberships m where m.org_id=f.org_id
          and m.member_id=p_actor_id and m.role in ('admin','staff')
      ) or exists (
        select 1 from public.platform_staff_members s where s.user_id=p_actor_id and s.access_level='developer'
      ))
  );
$$;
revoke all on function public.document_version_actor_can_edit(uuid,uuid) from public,anon,authenticated;
grant execute on function public.document_version_actor_can_edit(uuid,uuid) to service_role;

create function public.reserve_uploaded_document_version(
  p_file_id uuid, p_actor_id uuid, p_request_id uuid, p_generation uuid,
  p_expected_revision text, p_expected_updated_at timestamptz, p_sequence bigint,
  p_previous_hash text, p_new_hash text, p_new_size bigint, p_restore_version_id uuid default null
) returns boolean language plpgsql security definer set search_path='' as $$
declare
  f public.organization_document_files%rowtype;
  r public.document_collaboration_rooms%rowtype;
  op public.document_version_operations%rowtype;
  fingerprint text; reserve_bytes bigint;
begin
  if not public.document_version_actor_can_edit(p_file_id,p_actor_id)
    then raise exception 'Document access denied.' using errcode='42501'; end if;
  select * into f from public.organization_document_files where id=p_file_id;
  perform pg_advisory_xact_lock(hashtextextended(f.org_id::text,141600));
  if p_request_id is null or p_generation is null or p_expected_revision is null
    or length(p_expected_revision) not between 1 and 256 or p_expected_updated_at is null
    or p_sequence is null or p_sequence<0 or p_new_size is null or p_new_size not between 0 and 1048576
    or p_previous_hash is null or p_previous_hash !~ '^[a-f0-9]{64}$'
    or p_new_hash is null or p_new_hash !~ '^[a-f0-9]{64}$'
    then raise exception 'Invalid document stage.' using errcode='22023'; end if;
  fingerprint:=encode(sha256(convert_to(jsonb_build_array(p_actor_id,p_generation,p_expected_revision,
    p_expected_updated_at,p_sequence,p_previous_hash,p_new_hash,p_new_size,p_restore_version_id)::text,'UTF8')),'hex');
  select * into op from public.document_version_operations where file_id=p_file_id and request_id=p_request_id;
  if found then
    if op.fingerprint<>fingerprint or op.actor_id<>p_actor_id
      then raise exception 'Document stage does not match.' using errcode='22023'; end if;
    if op.state in ('abandoned','cleaned') then raise exception 'Document stage was canceled.' using errcode='40001'; end if;
    return op.state='staged';
  end if;
  select * into r from public.document_collaboration_rooms where file_id=p_file_id;
  select * into f from public.organization_document_files where id=p_file_id;
  if r.id is null or r.generation<>p_generation or r.base_revision<>p_expected_revision
    or r.base_updated_at<>p_expected_updated_at or f.updated_at<>p_expected_updated_at
    or p_sequence<r.canonical_sequence or p_sequence>r.last_sequence
    then raise exception 'Document source changed.' using errcode='40001'; end if;
  if not public.document_version_actor_can_edit(p_file_id,p_actor_id)
    then raise exception 'Document access denied.' using errcode='42501'; end if;
  reserve_bytes:=p_new_size+case when exists(select 1 from public.document_file_versions
    where file_id=f.id and storage_path=f.storage_path) then 0 else f.size_bytes end;
  if reserve_bytes>2097152 or (select count(*) from public.document_version_operations
    where file_id=f.id and state in ('staged','abandoned'))>=8 or
    (select coalesce(sum(staged_bytes),0) from public.document_version_operations where org_id=f.org_id and state in ('staged','abandoned'))+reserve_bytes>33554432
    then raise exception 'Document staging capacity reached.' using errcode='54000'; end if;
  insert into public.document_version_operations(file_id,request_id,org_id,actor_id,fingerprint,staged_bytes)
    values(f.id,p_request_id,f.org_id,p_actor_id,fingerprint,reserve_bytes);
  return true;
end;
$$;
revoke all on function public.reserve_uploaded_document_version(uuid,uuid,uuid,uuid,text,timestamptz,bigint,text,text,bigint,uuid) from public,anon,authenticated;
grant execute on function public.reserve_uploaded_document_version(uuid,uuid,uuid,uuid,text,timestamptz,bigint,text,text,bigint,uuid) to service_role;

-- First fence the operation under the same lock, then use the Storage API to
-- remove staged bytes. A committed request can never be abandoned or deleted.
create function public.abandon_uploaded_document_version(p_file_id uuid,p_actor_id uuid,p_request_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare op public.document_version_operations%rowtype;
begin
  select * into op from public.document_version_operations where file_id=p_file_id and request_id=p_request_id;
  if not found or op.actor_id<>p_actor_id then return false; end if;
  perform pg_advisory_xact_lock(hashtextextended(op.org_id::text,141600));
  select * into op from public.document_version_operations where file_id=p_file_id and request_id=p_request_id for update;
  if op.state in ('committed','cleaned') then return false; end if;
  update public.document_version_operations set state='abandoned' where file_id=p_file_id and request_id=p_request_id;
  return true;
end;
$$;
revoke all on function public.abandon_uploaded_document_version(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.abandon_uploaded_document_version(uuid,uuid,uuid) to service_role;

create function public.finish_abandoned_document_version(p_file_id uuid,p_actor_id uuid,p_request_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  update public.document_version_operations set state='cleaned',staged_bytes=0
    where file_id=p_file_id and request_id=p_request_id and actor_id=p_actor_id and state='abandoned';
  return found;
end;
$$;
revoke all on function public.finish_abandoned_document_version(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.finish_abandoned_document_version(uuid,uuid,uuid) to service_role;

-- Called only after the authenticated server validates and serializes the
-- authoritative Yjs prefix, and uploads immutable bytes through Storage's API.
create function public.commit_uploaded_document_version(
  p_file_id uuid, p_actor_id uuid, p_request_id uuid, p_generation uuid,
  p_expected_revision text, p_expected_updated_at timestamptz, p_sequence bigint,
  p_previous_hash text, p_new_hash text, p_new_size bigint, p_restore_version_id uuid default null,
  p_restore_checkpoint_base64 text default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  f public.organization_document_files%rowtype;
  r public.document_collaboration_rooms%rowtype;
  v public.document_file_versions%rowtype;
  restored public.document_file_versions%rowtype;
  new_path text;
  previous_path text;
  new_revision text;
  request_hash text;
  committed_time timestamptz;
  next_generation uuid;
  next_sequence bigint;
  new_checkpoint bytea;
  used_bytes bigint;
begin
  if not public.document_version_actor_can_edit(p_file_id,p_actor_id)
    then raise exception 'Document access denied.' using errcode='42501'; end if;
  select * into f from public.organization_document_files where id=p_file_id;
  -- Match the room writer's org lock before any row lock. Include the existing
  -- file-quota lock before changing size/history accounting.
  perform pg_advisory_xact_lock(hashtextextended(f.org_id::text,141600));
  perform pg_advisory_xact_lock(hashtextextended(f.org_id::text,0));
  select * into f from public.organization_document_files where id=p_file_id for update;
  select * into r from public.document_collaboration_rooms where file_id=p_file_id for update;
  if not found or not public.document_version_actor_can_edit(p_file_id,p_actor_id)
    then raise exception 'Document access denied.' using errcode='42501'; end if;
  if p_request_id is null or p_generation is null or p_expected_revision is null
    or length(p_expected_revision) not between 1 and 256 or p_expected_updated_at is null
    or p_sequence is null or p_sequence<0 or p_new_size is null or p_new_size not between 0 and 1048576
    or p_previous_hash is null or p_previous_hash !~ '^[a-f0-9]{64}$'
    or p_new_hash is null or p_new_hash !~ '^[a-f0-9]{64}$'
    then raise exception 'Invalid document version.' using errcode='22023'; end if;
  request_hash := encode(sha256(convert_to(jsonb_build_array(p_actor_id,p_generation,p_expected_revision,
    p_expected_updated_at,p_sequence,p_previous_hash,p_new_hash,p_new_size,p_restore_version_id)::text,'UTF8')),'hex');
  select * into v from public.document_file_versions where file_id=p_file_id and request_id=p_request_id;
  if found then
    if v.request_fingerprint is distinct from request_hash
      then raise exception 'Document receipt does not match.' using errcode='22023'; end if;
  else
    if not exists(select 1 from public.document_version_operations where file_id=p_file_id
      and request_id=p_request_id and actor_id=p_actor_id and state='staged' and document_version_operations.fingerprint=request_hash)
      then raise exception 'Document stage is unavailable.' using errcode='40001'; end if;
    if r.generation<>p_generation or r.base_revision<>p_expected_revision
      or r.base_updated_at<>p_expected_updated_at or f.updated_at<>p_expected_updated_at
      or p_sequence<r.canonical_sequence or p_sequence>r.last_sequence
      or (p_restore_version_id is null and p_sequence<r.checkpoint_sequence)
      then raise exception 'Document source changed.' using errcode='40001'; end if;
    next_generation:=r.generation; next_sequence:=p_sequence;
    if p_restore_version_id is not null then
      -- Restore is a new generation and never silently discards shared drafts.
      if r.last_sequence<>r.canonical_sequence or p_sequence<>r.last_sequence
        then raise exception 'Save the shared draft before restoring.' using errcode='40001'; end if;
      select * into restored from public.document_file_versions where id=p_restore_version_id
        and file_id=f.id and org_id=f.org_id;
      if not found or restored.content_hash<>p_new_hash or restored.size_bytes<>p_new_size
        then raise exception 'Invalid restore version.' using errcode='22023'; end if;
      if p_restore_checkpoint_base64 is null or length(p_restore_checkpoint_base64)>2796204
        then raise exception 'Invalid restore checkpoint.' using errcode='22023'; end if;
      new_checkpoint:=decode(p_restore_checkpoint_base64,'base64');
      if octet_length(new_checkpoint) not between 1 and 2097152
        then raise exception 'Invalid restore checkpoint.' using errcode='22023'; end if;
      select coalesce(sum(octet_length(checkpoint)+recovery_bytes),0) into used_bytes
        from public.document_collaboration_rooms where org_id=f.org_id and id<>r.id;
      if used_bytes+octet_length(new_checkpoint)>67108864
        then raise exception 'Recovery capacity reached.' using errcode='54000'; end if;
      next_generation:=gen_random_uuid(); next_sequence:=0;
    elsif p_restore_checkpoint_base64 is not null then
      raise exception 'Unexpected restore checkpoint.' using errcode='22023';
    end if;
    if exists (select 1 from public.document_file_versions where file_id=f.id and storage_path=f.storage_path
      and (content_hash<>p_previous_hash or revision<>r.base_revision))
      then raise exception 'Document history changed.' using errcode='40001'; end if;
    -- Explicit budgets stop growth visibly. Never silently delete old versions.
    if (select count(*) from public.document_file_versions where file_id=f.id)>=49
      then raise exception 'Document version capacity reached.' using errcode='54000'; end if;
    select coalesce(sum(size_bytes),0) into used_bytes from public.document_file_versions where org_id=f.org_id;
    if used_bytes+f.size_bytes+p_new_size>67108864
      then raise exception 'Document version capacity reached.' using errcode='54000'; end if;
    select coalesce(sum(size_bytes),0) into used_bytes from public.organization_document_files where org_id=f.org_id;
    -- Conservatively count history, including current versions, against storage.
    if used_bytes+(select coalesce(sum(size_bytes),0) from public.document_file_versions where org_id=f.org_id)+p_new_size>5368709120
      then raise exception 'Document storage quota exceeded.' using errcode='54000'; end if;
    new_path:=f.org_id::text || '/library/versions/' || f.id::text || '/' || p_request_id::text || '.md';
    new_revision:=encode(sha256(convert_to(new_path,'UTF8') || decode('00','hex') || convert_to(p_new_hash,'UTF8')),'hex');
    -- Storage API owns object bytes. SQL checks the uploaded object's existence
    -- and metadata but never mutates storage.objects directly.
    if not exists (select 1 from storage.objects where bucket_id='org-documents' and name=new_path
      and (metadata->>'size')::bigint=p_new_size)
      then raise exception 'Staged document is missing.' using errcode='22023'; end if;
    if not exists (select 1 from public.document_file_versions where file_id=f.id and storage_path=f.storage_path) then
      previous_path:=f.org_id::text || '/library/versions/' || f.id::text || '/' || p_request_id::text || '-previous.md';
      if not exists (select 1 from storage.objects where bucket_id='org-documents' and name=previous_path
        and (metadata->>'size')::bigint=f.size_bytes)
        then raise exception 'Previous-version stage is missing.' using errcode='22023'; end if;
      insert into public.document_file_versions(file_id,org_id,actor_id,storage_path,name,mime_type,size_bytes,
        content_hash,revision,source_updated_at,generation,sequence)
      values(f.id,f.org_id,p_actor_id,previous_path,f.name,f.mime_type,f.size_bytes,
        p_previous_hash,r.base_revision,f.updated_at,r.generation,r.canonical_sequence);
    end if;
    update public.organization_document_files set storage_path=new_path,mime_type='text/markdown',size_bytes=p_new_size
      where id=f.id returning updated_at into committed_time;
    insert into public.document_file_versions(file_id,org_id,request_id,actor_id,storage_path,name,mime_type,
      size_bytes,content_hash,revision,source_updated_at,generation,sequence,restored_from,request_fingerprint,request_context)
    values(f.id,f.org_id,p_request_id,p_actor_id,new_path,f.name,'text/markdown',p_new_size,p_new_hash,
      new_revision,committed_time,next_generation,next_sequence,p_restore_version_id,request_hash,
      jsonb_build_object('generation',p_generation,'expectedRevision',p_expected_revision,
        'expectedUpdatedAt',p_expected_updated_at,'sequence',p_sequence,'restoreVersionId',p_restore_version_id)) returning * into v;
    update public.document_version_operations set state='committed'
      where file_id=p_file_id and request_id=p_request_id;
    if p_restore_version_id is not null then
      delete from public.document_collaboration_updates where room_id=r.id;
      update public.document_collaboration_rooms set generation=next_generation,checkpoint=new_checkpoint,
        checkpoint_sequence=0,last_sequence=0,canonical_sequence=0,recovery_bytes=0,
        base_revision=new_revision,base_updated_at=committed_time,updated_at=now() where id=r.id;
    else
      update public.document_collaboration_rooms set canonical_sequence=p_sequence,
        base_revision=new_revision,base_updated_at=committed_time,updated_at=now() where id=r.id;
    end if;
  end if;
  return jsonb_build_object('versionId',v.id,'requestId',v.request_id,'fileId',v.file_id,
    'generation',v.generation,'revision',v.revision,'updatedAt',v.source_updated_at,
    'sequence',v.sequence,'restoredFrom',v.restored_from);
end;
$$;
revoke all on function public.commit_uploaded_document_version(uuid,uuid,uuid,uuid,text,timestamptz,bigint,text,text,bigint,uuid,text) from public,anon,authenticated;
grant execute on function public.commit_uploaded_document_version(uuid,uuid,uuid,uuid,text,timestamptz,bigint,text,text,bigint,uuid,text) to service_role;

-- Include retained history in the existing organization upload quota as well,
-- so a later ordinary upload cannot bypass version storage accounting.
create or replace function public.enforce_organization_document_storage_quota()
returns trigger language plpgsql security definer set search_path='' as $$
declare current_bytes bigint; history_bytes bigint;
begin
  if tg_op='UPDATE' and new.org_id=old.org_id and new.size_bytes=old.size_bytes
    and new.storage_path=old.storage_path then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended(new.org_id::text,0));
  select coalesce(sum(f.size_bytes),0) into current_bytes from public.organization_document_files f
    where f.org_id=new.org_id and (tg_op='INSERT' or f.id<>new.id)
      and (tg_op<>'INSERT' or new.document_kind is null or f.document_kind is distinct from new.document_kind);
  select coalesce(sum(v.size_bytes),0) into history_bytes from public.document_file_versions v
    where v.org_id=new.org_id and not exists (
      select 1 from public.organization_document_files f where f.storage_path=v.storage_path
        and (tg_op='INSERT' or f.id<>new.id)
    );
  if current_bytes+history_bytes+new.size_bytes>5368709120
    then raise exception 'Organization document storage quota exceeded.' using errcode='23514'; end if;
  return new;
end;
$$;
revoke all on function public.enforce_organization_document_storage_quota() from public;
