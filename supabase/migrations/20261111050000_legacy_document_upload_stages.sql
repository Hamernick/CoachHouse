-- Durable pre-upload intents. No private-folder binding writer or orphan deletion.
begin;
create table public.legacy_document_upload_stages (
 storage_path text primary key,
 org_id uuid not null references public.organizations(user_id) on delete cascade,
 document_kind text not null,
 file_id uuid references public.organization_document_files(id) on delete cascade,
 actor_id uuid not null,
 support boolean not null default false,
 size_bytes bigint not null check(size_bytes between 0 and 52428800),
 state text not null default 'staged' check(state in('staged','committed','abandoned','cleaned')),
 created_at timestamptz not null default clock_timestamp(),
 expires_at timestamptz not null default clock_timestamp()+interval '15 minutes',
 claimed_actor_id uuid,
 claimed_support boolean not null default false,
 check(state<>'cleaned' or size_bytes=0)
);
create index legacy_upload_stage_pending on public.legacy_document_upload_stages(org_id,created_at)
 where state in('staged','abandoned');
alter table public.legacy_document_upload_stages enable row level security;
alter table public.legacy_document_upload_stages force row level security;
revoke all on public.legacy_document_upload_stages from public,anon,authenticated,service_role;
grant select on public.legacy_document_upload_stages to service_role;

create function public.assert_legacy_document_upload(p_org uuid,p_kind text,p_actor uuid,p_support boolean)
returns uuid language plpgsql security definer set search_path='' as $$
declare file uuid;
begin
 perform 1 from public.organizations where user_id=p_org for share nowait;
 if not found then raise exception 'Organization unavailable.' using errcode='42501';end if;
 perform public.assert_document_cleanup_authority(p_org,p_actor,p_support);
 perform pg_advisory_xact_lock(hashtextextended(p_org::text,0));
 select id into file from public.organization_document_files where org_id=p_org and document_kind=p_kind;
 if file is not null then perform public.assert_document_file_folder_edit(file,p_actor);end if;
 return file;
exception when lock_not_available then raise exception 'Document changed; retry.' using errcode='40001';
end $$;

-- Retain all prior history/source accounting and add pending upload reservations.
alter function public.document_retained_source_bytes(uuid,uuid,text) rename to document_retained_source_bytes_before_upload_stages;
revoke all on function public.document_retained_source_bytes_before_upload_stages(uuid,uuid,text) from public,anon,authenticated,service_role;
create function public.document_retained_source_bytes(p_org uuid,p_replacing_file uuid default null,p_replacing_path text default null)
returns bigint language sql stable security definer set search_path='' as $$
 select public.document_retained_source_bytes_before_upload_stages(p_org,p_replacing_file,p_replacing_path)
 +coalesce((select sum(s.size_bytes) from public.legacy_document_upload_stages s
 where s.org_id=p_org and s.state in('staged','abandoned') and s.storage_path is distinct from p_replacing_path
 and not exists(select 1 from public.organization_document_files f where f.org_id=p_org and f.id is distinct from p_replacing_file and f.storage_path=s.storage_path)
 and not exists(select 1 from public.document_file_versions v where v.storage_path=s.storage_path)),0);
$$;

create function public.reserve_legacy_document_upload(p_org uuid,p_kind text,p_path text,p_size bigint,p_actor uuid,p_support boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare file uuid; item public.legacy_document_upload_stages%rowtype; bytes bigint; prefix text;
begin
 file:=public.assert_legacy_document_upload(p_org,p_kind,p_actor,p_support);
 if p_kind=any(array['verificationLetter','articlesOfIncorporation','bylaws','stateRegistration','goodStandingCertificate','w9','taxExemptCertificate','ueiConfirmation','samActiveStatus','grantsGovRegistration','gataPreQualification','einConfirmationLetter','irs990s','auditedFinancials']) then
  prefix:=p_org::text||'/'||p_kind||'/';
 elsif p_kind ~ '^policy:[a-zA-Z0-9_-]+$' then
  prefix:=p_org::text||'/policies/'||substr(p_kind,8)||'/';
  if not exists(select 1 from public.organizations o,jsonb_array_elements(case when jsonb_typeof(o.profile->'policies')='array' then o.profile->'policies' else '[]'::jsonb end) p where o.user_id=p_org and p->>'id'=substr(p_kind,8)) then
   raise exception 'Policy unavailable.' using errcode='42501';end if;
 else raise exception 'Invalid document kind.' using errcode='22023';end if;
 if p_size is null or p_size<0 or p_size>(case when p_kind like 'policy:%' then 15728640 else 52428800 end)
  or p_path is null or not starts_with(p_path,prefix) or length(p_path)>1024
  or substr(p_path,length(prefix)+1)!~'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-[^/]+$'
  or p_path ~ '[\\[:cntrl:]]' then raise exception 'Invalid document upload.' using errcode='22023';end if;
 select * into item from public.legacy_document_upload_stages where storage_path=p_path for update;
 if found then
  if (item.org_id,item.document_kind,item.actor_id,item.support,item.size_bytes) is distinct from (p_org,p_kind,p_actor,p_support,p_size) then
   raise exception 'Upload reservation conflicts.' using errcode='42501';end if;
  return jsonb_build_object('path',p_path,'state',item.state);
 end if;
 if exists(select 1 from storage.objects where bucket_id='org-documents' and name=p_path)
  or public.legacy_document_cleanup_has_reference(p_org,p_path)
  or exists(select 1 from public.legacy_document_cleanup where storage_path=p_path) then
  raise exception 'Document path already used.' using errcode='42501';end if;
 select coalesce(sum(size_bytes),0) into bytes from public.organization_document_files where org_id=p_org;
 bytes:=bytes+coalesce((select sum(v.size_bytes) from public.document_file_versions v where v.org_id=p_org
  and not exists(select 1 from public.organization_document_files f where f.storage_path=v.storage_path)),0)
  +public.document_retained_source_bytes(p_org);
 if bytes+p_size>5368709120 then raise exception 'Organization document storage quota exceeded.' using errcode='23514';end if;
 insert into public.legacy_document_upload_stages(storage_path,org_id,document_kind,file_id,actor_id,support,size_bytes)
 values(p_path,p_org,p_kind,file,p_actor,p_support,p_size);
 return jsonb_build_object('path',p_path,'state','staged');
end $$;

create function public.abandon_legacy_document_upload(p_org uuid,p_path text,p_actor uuid,p_support boolean default false)
returns text language plpgsql security definer set search_path='' as $$
declare item public.legacy_document_upload_stages%rowtype;
begin
 select * into item from public.legacy_document_upload_stages where storage_path=p_path and org_id=p_org;
 if not found then
  perform public.assert_document_cleanup_authority(p_org,p_actor,p_support);
  return 'missing';
 end if;
 perform public.assert_legacy_document_upload(p_org,item.document_kind,p_actor,p_support);
 select * into item from public.legacy_document_upload_stages where storage_path=p_path for update;
 if item.actor_id<>p_actor then raise exception 'Only uploading actor may abandon this stage.' using errcode='42501';end if;
 if item.state in('committed','cleaned') then return item.state;end if;
 if public.legacy_document_cleanup_has_reference(p_org,p_path) then
  raise exception 'Referenced upload cannot be abandoned.' using errcode='42501';end if;
 update public.legacy_document_upload_stages set state='abandoned' where storage_path=p_path;
 return 'abandoned';
end $$;

create function public.reserve_legacy_document_stage_cleanup(p_org uuid,p_actor uuid,p_support boolean default false,p_path text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare item public.legacy_document_upload_stages%rowtype; result jsonb:='[]';
begin
 perform 1 from public.organizations where user_id=p_org for share nowait;
 perform public.assert_document_cleanup_authority(p_org,p_actor,p_support);
 perform pg_advisory_xact_lock(hashtextextended(p_org::text,0));
 for item in select * from public.legacy_document_upload_stages s where s.org_id=p_org
  and (p_path is null or s.storage_path=p_path)
  and (s.state='abandoned' or (s.state='staged' and s.expires_at<clock_timestamp()))
  and (s.file_id is null or public.document_file_folder_actor_can(s.file_id,p_actor,'edit'))
  and not public.legacy_document_cleanup_has_reference(p_org,s.storage_path)
  order by s.created_at,s.storage_path limit 4 for update
 loop
  perform public.assert_legacy_document_upload(p_org,item.document_kind,p_actor,p_support);
  update public.legacy_document_upload_stages set state='abandoned',claimed_actor_id=p_actor,claimed_support=p_support where storage_path=item.storage_path;
  result:=result||jsonb_build_array(jsonb_build_object('path',item.storage_path,'kind',item.document_kind));
 end loop;
 return result;
exception when lock_not_available then raise exception 'Document changed; retry cleanup.' using errcode='40001';
end $$;

create function public.finish_legacy_document_stage_cleanup(p_org uuid,p_path text,p_actor uuid,p_support boolean default false)
returns boolean language plpgsql security definer set search_path='' as $$
declare item public.legacy_document_upload_stages%rowtype;
begin
 select * into item from public.legacy_document_upload_stages where storage_path=p_path and org_id=p_org;
 if not found then perform public.assert_document_cleanup_authority(p_org,p_actor,p_support);return false;end if;
 perform public.assert_legacy_document_upload(p_org,item.document_kind,p_actor,p_support);
 select * into item from public.legacy_document_upload_stages where storage_path=p_path for update;
 if item.state='cleaned' then return true;end if;
 if item.state<>'abandoned' or item.claimed_actor_id is distinct from p_actor
  or public.legacy_document_cleanup_has_reference(p_org,p_path)
  or exists(select 1 from storage.objects where bucket_id='org-documents' and name=p_path) then return false;end if;
 update public.legacy_document_upload_stages set state='cleaned',size_bytes=0 where storage_path=p_path;
 return true;
end $$;

-- Canonical commit holds the same reservation lock as Storage and cleanup. AFTER
-- transfer preserves the stage reservation until quota validation has succeeded.
create function public.guard_legacy_document_upload_commit() returns trigger
language plpgsql security definer set search_path='' as $$
declare item public.legacy_document_upload_stages%rowtype; object_size text;
begin
 if new.document_kind is null or new.deleted_at is not null then return new;end if;
 select * into item from public.legacy_document_upload_stages where storage_path=new.storage_path for update;
 if not found then
  if exists(select 1 from public.organization_document_files f join public.document_file_folder_authorities a on a.file_id=f.id
    where f.org_id=new.org_id and f.document_kind=new.document_kind and f.storage_path is distinct from new.storage_path) then
   raise exception 'Folder document replacement requires an upload reservation.' using errcode='42501';end if;
  return new;
 end if;
 if item.state='committed' and item.file_id=new.id then return new;end if;
 if item.state<>'staged' or item.expires_at<clock_timestamp()
  or (item.org_id,item.document_kind,item.actor_id,item.size_bytes) is distinct from
    (new.org_id,new.document_kind,public.organization_activity_actor_id(),new.size_bytes) then
  raise exception 'Document upload stage is not available.' using errcode='42501';end if;
 perform public.assert_legacy_document_upload(item.org_id,item.document_kind,item.actor_id,item.support);
 select metadata->>'size' into object_size from storage.objects where bucket_id='org-documents' and name=new.storage_path;
 if object_size is null or object_size!~'^[0-9]+$' or object_size::numeric<>item.size_bytes then
  raise exception 'Uploaded document bytes do not match reservation.' using errcode='23514';end if;
 if tg_when='AFTER' then
  update public.legacy_document_upload_stages set state='committed',file_id=new.id where storage_path=new.storage_path;
 end if;
 return new;
end $$;
create trigger b_legacy_upload_commit before insert or update on public.organization_document_files for each row execute function public.guard_legacy_document_upload_commit();
create trigger legacy_upload_committed after insert or update on public.organization_document_files for each row execute function public.guard_legacy_document_upload_commit();

-- Fences the provider's metadata INSERT/UPDATE, including a delayed upload after
-- cleanup confirmed absence. Tombstones are retained; paths can never be reused.
create function public.guard_legacy_document_upload_storage() returns trigger
language plpgsql security definer set search_path='' as $$
declare item public.legacy_document_upload_stages%rowtype; path text; bucket text; actual_size text;
begin
 path:=case when tg_op='DELETE' then old.name else new.name end;
 bucket:=case when tg_op='DELETE' then old.bucket_id else new.bucket_id end;
 if tg_op='UPDATE' and exists(select 1 from public.legacy_document_upload_stages where storage_path=old.name)
  and (old.name,old.bucket_id) is distinct from(new.name,new.bucket_id) then
  raise exception 'Reserved document paths cannot change.' using errcode='42501';end if;
 if bucket<>'org-documents' then if tg_op='DELETE' then return old;end if;return new;end if;
 select * into item from public.legacy_document_upload_stages where storage_path=path;
 if not found then if tg_op='DELETE' then return old;end if;return new;end if;
 -- Match existing profile/Storage lock order; fail rather than deadlock.
 perform 1 from public.organizations where user_id=item.org_id for share nowait;
 if not pg_try_advisory_xact_lock(hashtextextended(item.org_id::text,0)) then
  raise exception 'Document changed; retry.' using errcode='40001';end if;
 select * into item from public.legacy_document_upload_stages where storage_path=path for update nowait;
 if tg_op='DELETE' and item.state='committed' then
  -- Normal committed deletion is owned by the existing exact outgoing receipt.
  if not exists(select 1 from public.legacy_document_cleanup q where q.storage_path=path and q.completed_at is null and q.claimed_at is not null)
   then raise exception 'Committed upload requires cleanup reservation.' using errcode='42501';end if;
  return old;
 end if;
 if tg_op='DELETE' then
  if item.state<>'abandoned' or item.claimed_actor_id is null or item.claimed_actor_id is distinct from public.organization_activity_actor_id()
   or public.legacy_document_cleanup_has_reference(item.org_id,path) then
   raise exception 'Document stage cleanup is not reserved.' using errcode='42501';end if;
  perform public.assert_legacy_document_upload(item.org_id,item.document_kind,item.claimed_actor_id,item.claimed_support);
  return old;
 end if;
 if item.state<>'staged' or item.expires_at<clock_timestamp() or item.actor_id is distinct from public.organization_activity_actor_id() then
  raise exception 'Document upload stage is not available.' using errcode='42501';end if;
 perform public.assert_legacy_document_upload(item.org_id,item.document_kind,item.actor_id,item.support);
 actual_size:=new.metadata->>'size';
 if actual_size is null or actual_size!~'^[0-9]+$' or actual_size::numeric>item.size_bytes then
  raise exception 'Uploaded document bytes exceed reservation.' using errcode='23514';end if;
 return new;
exception when lock_not_available then raise exception 'Document changed; retry.' using errcode='40001';
end $$;
create trigger legacy_upload_storage before insert or update or delete on storage.objects for each row execute function public.guard_legacy_document_upload_storage();

-- Existing native folder rules remain intact. Legacy writes use retained identity
-- and canonical commit guards; legacy bytes use their own exact reservation.
do $$
declare body text; previous text; replacement text;
begin
 body:=pg_get_functiondef('public.guard_document_file_folder_write()'::regprocedure);
 previous:=$old$      or new.document_kind is not null or new.storage_path not like new.org_id::text||'/library/%'$old$;
 replacement:=$new$      or (old.document_kind is null and (new.document_kind is not null or new.storage_path not like new.org_id::text||'/library/%'))
      or (old.document_kind is not null and new.document_kind is distinct from old.document_kind)$new$;
 if (length(body)-length(replace(body,previous,'')))/length(previous)<>1 then raise exception 'Expected native folder write guard';end if;
 execute replace(body,previous,replacement);
 body:=pg_get_functiondef('public.guard_document_file_folder_storage()'::regprocedure);
 previous:=$old$      or exists(select 1 from public.document_version_operations o where o.file_id=a.file_id and o.source_storage_path=any(paths))$old$;
 replacement:=previous||$new$
      or exists(select 1 from public.legacy_document_cleanup q where q.file_id=a.file_id and q.storage_path=any(paths))
      or exists(select 1 from public.legacy_document_upload_stages s where s.file_id=a.file_id and s.storage_path=any(paths))$new$;
 if (length(body)-length(replace(body,previous,'')))/length(previous)<>1 then raise exception 'Expected folder path coverage';end if;
 body:=replace(body,previous,replacement);
 previous:=$old$    actor:=public.organization_activity_actor_id();$old$;
 replacement:=previous||$new$
    if exists(select 1 from public.organization_document_files where id=file and document_kind is not null) then
      perform public.assert_document_file_folder_edit(file,actor);
      if tg_op='DELETE' and exists(select 1 from public.legacy_document_cleanup q where q.file_id=file and q.storage_path=old.name and q.claimed_at is not null and q.completed_at is null)
        then continue;end if;
      if exists(select 1 from public.legacy_document_upload_stages s where s.file_id=file and s.storage_path=any(paths)
        and ((tg_op='DELETE' and s.state='abandoned' and s.claimed_actor_id=actor)
          or (tg_op<>'DELETE' and s.state='staged' and s.actor_id=actor and s.expires_at>clock_timestamp()))) then continue;end if;
      raise exception 'Legacy folder bytes require an exact stage or cleanup reservation.' using errcode='42501';
    end if;$new$;
 if (length(body)-length(replace(body,previous,'')))/length(previous)<>1 then raise exception 'Expected folder actor boundary';end if;
 execute replace(body,previous,replacement);
end $$;

revoke all on function public.assert_legacy_document_upload(uuid,text,uuid,boolean),
 public.document_retained_source_bytes(uuid,uuid,text),public.guard_legacy_document_upload_commit(),
 public.guard_legacy_document_upload_storage(),
 public.reserve_legacy_document_upload(uuid,text,text,bigint,uuid,boolean),
 public.abandon_legacy_document_upload(uuid,text,uuid,boolean),
 public.reserve_legacy_document_stage_cleanup(uuid,uuid,boolean,text),
 public.finish_legacy_document_stage_cleanup(uuid,text,uuid,boolean) from public,anon,authenticated,service_role;
grant execute on function public.reserve_legacy_document_upload(uuid,text,text,bigint,uuid,boolean),
 public.abandon_legacy_document_upload(uuid,text,uuid,boolean),
 public.reserve_legacy_document_stage_cleanup(uuid,uuid,boolean,text),
 public.finish_legacy_document_stage_cleanup(uuid,text,uuid,boolean) to service_role;
comment on table public.legacy_document_upload_stages is 'Exact pre-upload intents and permanent path tombstones. Unknown historical Storage objects are not adopted or deleted. No private-folder activation.';
commit;
