begin;
-- Keep first-save source provenance: the immutable previous-version copy does
-- not account for the original library object that preceded that first Save.
alter table public.document_version_operations add column source_storage_path text,
 add column source_size_bytes bigint check(source_size_bytes between 0 and 52428800);

create table public.document_file_purges (
 file_id uuid primary key,
 org_id uuid not null references public.organizations(user_id) on delete restrict,
 actor_id uuid not null,
 paths text[] not null check(cardinality(paths) between 1 and 151),
 state text not null default 'reserved' check(state in('reserved','finishing','complete')),
 created_at timestamptz not null default clock_timestamp(),
 completed_at timestamptz,
 check((state='complete')=(completed_at is not null))
);
alter table public.document_file_purges enable row level security;
alter table public.document_file_purges force row level security;
revoke all on public.document_file_purges from public,anon,authenticated;
grant select,insert,update on public.document_file_purges to service_role;

-- This is the existing Documents route's authority, rechecked for every phase.
-- Only the service-role caller may supply its server-verified actor/context.
create function public.assert_document_cleanup_authority(p_org uuid,p_actor uuid,p_support boolean) returns void
language plpgsql security definer set search_path='' as $$
declare level text; member_role text; support_granted boolean;
begin
 if auth.role()<>'service_role' or p_actor is null or public.organization_activity_actor_id() is distinct from p_actor then
  raise exception 'Verified document actor required' using errcode='42501'; end if;
 perform public.guard_uploaded_document_organization(p_org);
 perform pg_advisory_xact_lock(hashtextextended(p_org::text,141600));
 perform 1 from public.profiles where id=p_actor for share;
 perform 1 from public.subscriptions where user_id=p_org for share;
 if p_support then perform 1 from public.workspace_support_grants where user_id=p_actor for share;end if;
 select access_level into level from public.platform_staff_members where user_id=p_actor for share;
 if level is null and exists(select 1 from public.profiles where id=p_actor and role='admin') then level:='developer';end if;
 select role into member_role from public.organization_memberships where org_id=p_org and member_id=p_actor for share;
 select exists(select 1 from public.workspace_support_grants g join public.platform_staff_members s on s.user_id=g.user_id
  join auth.users u on u.id=g.user_id where g.user_id=p_actor and g.revoked_at is null
  and s.access_level in('developer','coach') and (u.banned_until is null or u.banned_until<now())) into support_granted;
 if p_support then
  if not support_granted then raise exception 'Document support access changed' using errcode='42501';end if;
 elsif not public.has_workspace_paid_features(p_org) then
  raise exception 'Document storage access required' using errcode='42501';
 end if;
 if p_org=p_actor or member_role in('admin','staff') or p_support then return;end if;
 if member_role is not null then raise exception 'Document editing required' using errcode='42501';end if;
 if level='developer' then return;end if;
 if level='coach' then
  perform 1 from public.organization_coach_scope_settings where id=true for share;
  perform 1 from public.organization_coach_assignments where organization_id=p_org for share;
  if not coalesce((select assigned_only_enabled from public.organization_coach_scope_settings where id=true),false)
   or exists(select 1 from public.organization_coach_assignments where organization_id=p_org and coach_user_id=p_actor)
   or (exists(select 1 from public.platform_staff_members where user_id=p_actor and can_access_unassigned_organizations)
    and not exists(select 1 from public.organization_coach_assignments where organization_id=p_org)) then return;end if;
 end if;
 raise exception 'Document editing required' using errcode='42501';
end $$;
revoke all on function public.assert_document_cleanup_authority(uuid,uuid,boolean) from public,anon,authenticated,service_role;

create function public.guard_document_purge_mutation() returns trigger
language plpgsql security definer set search_path='' as $$
declare item jsonb; org uuid; file uuid; status text;
begin
 item:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 org:=(item->>'org_id')::uuid;file:=case when tg_table_name='organization_document_files' then (item->>'id')::uuid else (item->>'file_id')::uuid end;
 if not pg_try_advisory_xact_lock(hashtextextended(org::text,141600)) then
  raise exception 'Document operation is busy; retry unchanged' using errcode='55P03';end if;
 select state into status from public.document_file_purges where file_id=file;
 if status is not null and not(status='finishing' and (tg_op='DELETE' or (tg_table_name='document_file_versions' and tg_op='UPDATE' and (to_jsonb(new)->>'restored_from') is null and (to_jsonb(new)-'restored_from')=(to_jsonb(old)-'restored_from')))) then
  raise exception 'Document permanent deletion is reserved' using errcode='PT409';end if;
 if tg_table_name='organization_document_files' and tg_op<>'DELETE' and exists(select 1 from public.document_file_purges where (item->>'storage_path')=any(paths)) then
  raise exception 'Purged document path cannot be reused' using errcode='PT409';end if;
 if tg_table_name='document_version_operations' then
  if tg_op='INSERT' then
   select storage_path,size_bytes into new.source_storage_path,new.source_size_bytes from public.organization_document_files where id=new.file_id and org_id=new.org_id;
   if new.source_storage_path is null then raise exception 'Document source unavailable' using errcode='42501';end if;
  elsif tg_op='UPDATE' and (new.source_storage_path is distinct from old.source_storage_path or new.source_size_bytes is distinct from old.source_size_bytes) then
   raise exception 'Document source provenance is immutable' using errcode='42501';end if;
 end if;
 if tg_op='DELETE' then return old;end if;return new;
end $$;
revoke all on function public.guard_document_purge_mutation() from public,anon,authenticated,service_role;
create trigger document_purge_fence before insert or update or delete on public.organization_document_files for each row execute function public.guard_document_purge_mutation();
create trigger document_purge_fence before insert or update or delete on public.document_file_versions for each row execute function public.guard_document_purge_mutation();
create trigger document_purge_fence before insert or update or delete on public.document_version_operations for each row execute function public.guard_document_purge_mutation();
create trigger document_purge_fence before insert or update or delete on public.document_collaboration_rooms for each row execute function public.guard_document_purge_mutation();

-- Check both insertion and finalization/rename; service Storage bypasses RLS.
create function public.guard_document_version_upload() returns trigger
language plpgsql security definer set search_path='' as $$
declare org uuid; file uuid; request uuid; parts text[];
begin
 if tg_op='UPDATE' and old.bucket_id='org-documents' and (old.bucket_id<>new.bucket_id or old.name<>new.name) and
  (old.name ~ '^[0-9a-f-]{36}/library/versions/' or exists(select 1 from public.document_file_purges where old.name=any(paths))) then
  raise exception 'Reserved document paths cannot be renamed' using errcode='42501';end if;
 if new.bucket_id<>'org-documents' then return new;end if;
 if split_part(new.name,'/',1)!~'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return new;end if;
 org:=split_part(new.name,'/',1)::uuid;
 if not pg_try_advisory_xact_lock(hashtextextended(org::text,141600)) then
  raise exception 'Document operation is busy; retry unchanged' using errcode='55P03';end if;
 if exists(select 1 from public.document_file_purges where org_id=org and new.name=any(paths)) then
  raise exception 'Purged document object cannot be recreated' using errcode='42501';end if;
 if exists(select 1 from public.document_version_operations where org_id=org and source_storage_path=new.name) then
  raise exception 'Retained document source bytes are immutable' using errcode='42501';end if;
 if new.name not like org::text||'/library/versions/%' then return new;end if;
 parts:=regexp_match(new.name,'^([0-9a-f-]{36})/library/versions/([0-9a-f-]{36})/([0-9a-f-]{36})(-previous)?\.md$');
 if parts is null then raise exception 'Invalid reserved document path' using errcode='42501';end if;
 file:=parts[2]::uuid;request:=parts[3]::uuid;
 if not exists(select 1 from public.document_version_operations o join public.organization_document_files f on f.id=o.file_id
  where o.org_id=org and o.file_id=file and o.request_id=request and o.state='staged' and f.org_id=org and f.deleted_at is null)
  or exists(select 1 from public.document_file_purges where file_id=file) then
  raise exception 'Document stage is no longer available' using errcode='42501';end if;
 if tg_op='UPDATE' and (old.bucket_id<>new.bucket_id or old.name<>new.name) then
  raise exception 'Reserved document paths cannot be renamed' using errcode='42501';end if;
 return new;
end $$;
revoke all on function public.guard_document_version_upload() from public,anon,authenticated,service_role;
create trigger document_version_upload_fence before insert or update on storage.objects for each row execute function public.guard_document_version_upload();

create function public.reserve_document_file_purge(p_org uuid,p_file uuid,p_actor uuid,p_support boolean default false,p_expired_only boolean default false) returns jsonb
language plpgsql security definer set search_path='' as $$
declare f public.organization_document_files%rowtype;r public.document_file_purges%rowtype;paths text[];
begin
 perform public.assert_document_cleanup_authority(p_org,p_actor,p_support);
 select * into r from public.document_file_purges where file_id=p_file for update;
 if found then
  if r.org_id<>p_org then raise exception 'Document unavailable' using errcode='42501';end if;
  return jsonb_build_object('fileId',r.file_id,'paths',r.paths,'complete',r.state='complete');
 end if;
 select * into f from public.organization_document_files where id=p_file and org_id=p_org and document_kind is null for update;
 if not found then raise exception 'Document unavailable' using errcode='42501';end if;
 if f.deleted_at is null then raise exception 'Move the file to Recently Deleted first.' using errcode='PT409';end if;
 if p_expired_only and f.deleted_at>=clock_timestamp()-interval '30 days' then raise exception 'Document retention window remains active' using errcode='PT409';end if;
 if exists(select 1 from public.document_version_operations where file_id=p_file and state='committed' and (source_storage_path is null or source_size_bytes is null)) then
  raise exception 'Legacy document source provenance requires reconciliation' using errcode='PT409';end if;
 if exists(select 1 from public.document_file_versions v join public.document_file_versions source on source.id=v.restored_from where source.file_id=p_file and v.file_id<>p_file) then
  raise exception 'Document version references require reconciliation' using errcode='PT409';end if;
 select array_agg(distinct path order by path) into paths from (
  select f.storage_path path
  union select storage_path from public.document_file_versions where file_id=p_file and org_id=p_org
  union select source_storage_path from public.document_version_operations where file_id=p_file and org_id=p_org and state<>'cleaned' and source_storage_path is not null
  union select p_org::text||'/library/versions/'||p_file::text||'/'||request_id::text||'.md' from public.document_version_operations where file_id=p_file and org_id=p_org and state<>'cleaned'
  union select p_org::text||'/library/versions/'||p_file::text||'/'||request_id::text||'-previous.md' from public.document_version_operations where file_id=p_file and org_id=p_org and state<>'cleaned'
 ) owned;
 if cardinality(paths)>151 or exists(select 1 from unnest(paths)p where p not like p_org::text||'/library/%' or p ~ '(^|/)\.\.(/|$)')
  or exists(select 1 from public.organization_document_files where id<>p_file and storage_path=any(paths))
  or exists(select 1 from public.document_file_versions where file_id<>p_file and storage_path=any(paths)) then
  raise exception 'Document object ownership requires reconciliation' using errcode='PT409';end if;
 -- Fence every uncommitted request before Storage begins; committed history is
 -- retained until the complete frozen object set is confirmed absent.
 update public.document_version_operations set state='abandoned' where file_id=p_file and state='staged';
 insert into public.document_file_purges(file_id,org_id,actor_id,paths) values(p_file,p_org,p_actor,paths) returning * into r;
 return jsonb_build_object('fileId',r.file_id,'paths',r.paths,'complete',false);
end $$;

create function public.finish_document_file_purge(p_org uuid,p_file uuid,p_actor uuid,p_support boolean default false) returns boolean
language plpgsql security definer set search_path='' as $$
declare r public.document_file_purges%rowtype;
begin
 perform public.assert_document_cleanup_authority(p_org,p_actor,p_support);
 select * into r from public.document_file_purges where file_id=p_file and org_id=p_org for update;
 if not found then raise exception 'Document purge reservation required' using errcode='42501';end if;
 if r.state='complete' then return true;end if;
 if exists(select 1 from storage.objects where bucket_id='org-documents' and name=any(r.paths)) then
  raise exception 'Document objects remain; retry deletion' using errcode='PT409';end if;
 update public.document_file_purges set state='finishing' where file_id=p_file;
 update public.document_file_versions set restored_from=null where file_id=p_file and restored_from is not null;
 delete from public.document_file_versions where file_id=p_file;
 delete from public.organization_document_files where id=p_file and org_id=p_org;
 update public.document_file_purges set state='complete',completed_at=clock_timestamp() where file_id=p_file;
 return true;
end $$;

-- Only explicitly abandoned stages qualify. An unresolved staged operation may
-- still be active/unknown and is retained for same-request reconciliation.
create function public.read_abandoned_document_stages(p_org uuid,p_actor uuid,p_support boolean default false) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 perform public.assert_document_cleanup_authority(p_org,p_actor,p_support);
 return coalesce((select jsonb_agg(jsonb_build_object('fileId',file_id,'requestId',request_id,'actorId',actor_id,'paths',jsonb_build_array(
  org_id::text||'/library/versions/'||file_id::text||'/'||request_id::text||'.md',
  org_id::text||'/library/versions/'||file_id::text||'/'||request_id::text||'-previous.md')))
 from (select * from public.document_version_operations o where org_id=p_org and state='abandoned'
  and not exists(select 1 from public.document_file_purges p where p.file_id=o.file_id) order by created_at,file_id,request_id limit 4 for update) stages),'[]'::jsonb);
end $$;

-- Finishing is idempotent and proves metadata absence under the upload fence;
-- failed physical Storage calls must never call this owner.
create or replace function public.finish_abandoned_document_version(p_file_id uuid,p_actor_id uuid,p_request_id uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare op public.document_version_operations%rowtype;prefix text;
begin
 select * into op from public.document_version_operations where file_id=p_file_id and request_id=p_request_id;
 if not found or op.actor_id<>p_actor_id then return false;end if;
 perform pg_advisory_xact_lock(hashtextextended(op.org_id::text,141600));
 select * into op from public.document_version_operations where file_id=p_file_id and request_id=p_request_id for update;
 if op.state='cleaned' then return true;end if;
 if op.state<>'abandoned' then return false;end if;
 prefix:=op.org_id::text||'/library/versions/'||p_file_id::text||'/'||p_request_id::text;
 if exists(select 1 from storage.objects where bucket_id='org-documents' and name in(prefix||'.md',prefix||'-previous.md')) then return false;end if;
 update public.document_version_operations set state='cleaned',staged_bytes=0 where file_id=p_file_id and request_id=p_request_id;
 return true;
end $$;
revoke all on function public.reserve_document_file_purge(uuid,uuid,uuid,boolean,boolean),public.finish_document_file_purge(uuid,uuid,uuid,boolean),public.read_abandoned_document_stages(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.reserve_document_file_purge(uuid,uuid,uuid,boolean,boolean),public.finish_document_file_purge(uuid,uuid,uuid,boolean),public.read_abandoned_document_stages(uuid,uuid,boolean) to service_role;

-- Count retained original objects once when neither current metadata nor history
-- already accounts for their path. Replacing-file parameters see the proposed
-- canonical path during its BEFORE quota trigger.
create function public.document_retained_source_bytes(p_org uuid,p_replacing_file uuid default null,p_replacing_path text default null) returns bigint
language plpgsql stable security definer set search_path='' as $$
declare bytes bigint;
begin
 if exists(select 1 from public.document_version_operations where org_id=p_org and state='committed' and (source_storage_path is null or source_size_bytes is null)) then
  raise exception 'Legacy document storage accounting requires reconciliation' using errcode='PT409';end if;
 select coalesce(sum(size),0) into bytes from (
  select o.source_storage_path,max(o.source_size_bytes) size from public.document_version_operations o
  where o.org_id=p_org and o.state='committed' and o.source_storage_path is not null
   and o.source_storage_path is distinct from p_replacing_path
   and not exists(select 1 from public.organization_document_files f where f.org_id=p_org and f.id is distinct from p_replacing_file and f.storage_path=o.source_storage_path)
   and not exists(select 1 from public.document_file_versions v where v.org_id=p_org and v.storage_path=o.source_storage_path)
  group by o.source_storage_path
 ) retained;
 return bytes;
end $$;
revoke all on function public.document_retained_source_bytes(uuid,uuid,text) from public,anon,authenticated,service_role;

do $$
declare body text; previous text; replacement text;
begin
 body:=pg_get_functiondef('public.enforce_organization_document_storage_quota()'::regprocedure);
 previous:='if current_bytes+history_bytes+new.size_bytes>5368709120';
 replacement:='if current_bytes+history_bytes+new.size_bytes+public.document_retained_source_bytes(new.org_id,new.id,new.storage_path)>5368709120';
 if (length(body)-length(replace(body,previous,'')))/length(previous)<>1 then raise exception 'Expected upload quota boundary';end if;
 execute replace(body,previous,replacement);
 body:=pg_get_functiondef('public.commit_uploaded_document_version(uuid,uuid,uuid,uuid,text,timestamptz,bigint,text,text,bigint,uuid,text)'::regprocedure);
 previous:='if used_bytes+f.size_bytes+p_new_size>67108864';
 replacement:='if used_bytes+f.size_bytes+p_new_size+public.document_retained_source_bytes(f.org_id)+(case when not exists(select 1 from public.document_file_versions where file_id=f.id and storage_path=f.storage_path) then f.size_bytes else 0 end)>67108864';
 if (length(body)-length(replace(body,previous,'')))/length(previous)<>1 then raise exception 'Expected version budget boundary';end if;
 body:=replace(body,previous,replacement);
 previous:='if used_bytes+(select coalesce(sum(size_bytes),0) from public.document_file_versions where org_id=f.org_id)+p_new_size>5368709120';
 replacement:='if used_bytes+(select coalesce(sum(size_bytes),0) from public.document_file_versions where org_id=f.org_id)+p_new_size+public.document_retained_source_bytes(f.org_id)+(case when not exists(select 1 from public.document_file_versions where file_id=f.id and storage_path=f.storage_path) then f.size_bytes else 0 end)>5368709120';
 if (length(body)-length(replace(body,previous,'')))/length(previous)<>1 then raise exception 'Expected canonical quota boundary';end if;
 execute replace(body,previous,replacement);
end $$;

-- Retained original sources receive the same authenticated Storage protection
-- as copied history. The verified service purge still owns physical deletion.
create or replace function public.is_document_version_object(p_bucket text,p_path text) returns boolean
language sql stable security definer set search_path='' as $$
 select p_bucket='org-documents' and (
  p_path ~ '^[0-9a-f-]{36}/library/versions/'
  or exists(select 1 from public.document_file_versions where storage_path=p_path)
  or exists(select 1 from public.document_version_operations where source_storage_path=p_path)
 );
$$;
commit;
