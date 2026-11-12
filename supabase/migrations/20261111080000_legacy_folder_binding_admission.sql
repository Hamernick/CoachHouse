-- Internal admission only. No binding writer, cutover row or privacy activation.
-- Historical-copy reconciliation and old-link/cache qualification remain
-- independent release gates; a catalog path is never deletion authorization.
begin;

create function public.assert_legacy_folder_binding_admission(p_file uuid) returns void
language plpgsql security definer set search_path='' as $$
declare f public.organization_document_files%rowtype; organization_id uuid;
 profile jsonb; prefix text; paths text[]; current_paths text[];
begin
 select org_id into organization_id from public.organization_document_files where id=p_file;
 -- Same parent/advisory serialization as canonical profile saves, upload
 -- reservation and cleanup. Never wait while reversing another writer's locks.
 select o.profile into profile from public.organizations o where o.user_id=organization_id for update nowait;
 if not found then raise exception 'Document organization unavailable.' using errcode='23514';end if;
 if exists(select 1 from public.organization_closures where org_id=organization_id and state='closing') then
  raise exception 'Organization is closing.' using errcode='42501';end if;
 if current_setting('transaction_isolation')<>'read committed'
  or not pg_try_advisory_xact_lock(hashtextextended(organization_id::text,0))
  or not pg_try_advisory_xact_lock(hashtextextended(organization_id::text,141600)) then
  raise exception 'Document changed; retry.' using errcode='40001';end if;
 select * into f from public.organization_document_files where id=p_file and org_id=organization_id for share nowait;
 if not found or f.document_kind is null then raise exception 'Legacy document unavailable.' using errcode='23514';end if;
 perform 1 from public.organization_private_storage_cutovers where org_id=f.org_id for share nowait;
 if not found then raise exception 'Legacy Storage cutover is not qualified.' using errcode='42501';end if;

 if (profile ? 'documents' and jsonb_typeof(profile->'documents') not in('object','null'))
  or (profile ? 'policies' and jsonb_typeof(profile->'policies') not in('array','null')) then
  raise exception 'Legacy profile references require reconciliation.' using errcode='23514';end if;
 if f.document_kind=any(array['verificationLetter','articlesOfIncorporation','bylaws','stateRegistration','goodStandingCertificate','w9','taxExemptCertificate','ueiConfirmation','samActiveStatus','grantsGovRegistration','gataPreQualification','einConfirmationLetter','irs990s','auditedFinancials']) then
  prefix:=f.org_id::text||'/'||f.document_kind||'/';
  current_paths:=case when profile->'documents'->f.document_kind->>'path' is null then '{}'::text[]
    else array[profile->'documents'->f.document_kind->>'path'] end;
 elsif f.document_kind ~ '^policy:[a-zA-Z0-9_-]+$' then
  prefix:=f.org_id::text||'/policies/'||substr(f.document_kind,8)||'/';
  if (select count(*) from jsonb_array_elements(case when jsonb_typeof(profile->'policies')='array' then profile->'policies' else '[]'::jsonb end) p
    where p->>'id'=substr(f.document_kind,8))>1 then
   raise exception 'Legacy policy identity is ambiguous.' using errcode='23514';end if;
  select coalesce(array_agg(p->'document'->>'path'),'{}') into current_paths
   from jsonb_array_elements(case when jsonb_typeof(profile->'policies')='array' then profile->'policies' else '[]'::jsonb end) p
   where p->>'id'=substr(f.document_kind,8) and p->'document'->>'path' is not null;
 else raise exception 'Unsupported legacy document kind.' using errcode='23514';end if;
 if (f.deleted_at is null and current_paths is distinct from array[f.storage_path])
  or (f.deleted_at is not null and cardinality(current_paths)<>0) then
  raise exception 'Current legacy identity could not be verified.' using errcode='23514';end if;

 -- Lock every retained source, including reservations created before a
 -- canonical identity existed. Null/foreign pending ownership is held, never
 -- guessed or rewritten into this file's audience.
 perform 1 from public.document_file_versions where file_id=f.id for share nowait;
 perform 1 from public.document_version_operations where file_id=f.id for share nowait;
 perform 1 from public.legacy_document_upload_stages
  where file_id=f.id or (org_id=f.org_id and document_kind=f.document_kind) for share nowait;
 perform 1 from public.legacy_document_cleanup
  where file_id=f.id or (org_id=f.org_id and document_kind=f.document_kind) for share nowait;
 if exists(select 1 from public.document_file_versions where file_id=f.id and org_id<>f.org_id)
  or exists(select 1 from public.document_version_operations where file_id=f.id
    and (org_id<>f.org_id or (state='committed' and (source_storage_path is null or source_size_bytes is null))))
  or exists(select 1 from public.legacy_document_upload_stages s
    where (s.file_id=f.id or (s.org_id=f.org_id and s.document_kind=f.document_kind))
    and (s.org_id<>f.org_id or s.document_kind<>f.document_kind
      or (s.file_id is distinct from f.id and (s.state<>'cleaned' or s.file_id is not null))))
  or exists(select 1 from public.legacy_document_cleanup q
    where (q.file_id=f.id or (q.org_id=f.org_id and q.document_kind=f.document_kind))
    and (q.file_id<>f.id or q.org_id<>f.org_id or q.document_kind<>f.document_kind)) then
  raise exception 'Legacy source identity is ambiguous.' using errcode='23514';end if;
 select array_agg(distinct path) into paths from (
  select f.storage_path path
  union all select storage_path from public.document_file_versions where file_id=f.id
  union all select source_storage_path from public.document_version_operations where file_id=f.id and source_storage_path is not null
  union all select f.org_id::text||'/library/versions/'||f.id::text||'/'||o.request_id::text||suffix
    from public.document_version_operations o cross join unnest(array['.md','-previous.md']) suffix where o.file_id=f.id
  union all select storage_path from public.legacy_document_upload_stages where file_id=f.id or (org_id=f.org_id and document_kind=f.document_kind)
  union all select storage_path from public.legacy_document_cleanup where file_id=f.id
 ) sources;
 if not starts_with(f.storage_path,prefix) or length(f.storage_path)<=length(prefix)
  or exists(select 1 from unnest(paths) path where path is null or path ~ '[\\[:cntrl:]]'
    or exists(select 1 from unnest(string_to_array(path,'/')) part where part in('','.','..'))
    or not ((starts_with(path,prefix) and length(path)>length(prefix))
      or (starts_with(path,f.org_id::text||'/library/versions/'||f.id::text||'/')
        and length(path)>length(f.org_id::text||'/library/versions/'||f.id::text||'/')))) then
  raise exception 'Legacy source path could not be verified.' using errcode='23514';end if;
 if exists(select 1 from public.organization_document_files where storage_path=any(paths) and id<>f.id)
  or exists(select 1 from public.document_file_versions where storage_path=any(paths) and (file_id<>f.id or org_id<>f.org_id))
  or exists(select 1 from public.document_version_operations where source_storage_path=any(paths) and (file_id<>f.id or org_id<>f.org_id))
  or exists(select 1 from public.legacy_document_upload_stages where storage_path=any(paths)
    and (org_id<>f.org_id or document_kind<>f.document_kind or (file_id is distinct from f.id and (state<>'cleaned' or file_id is not null))))
  or exists(select 1 from public.legacy_document_cleanup where storage_path=any(paths) and (file_id<>f.id or org_id<>f.org_id or document_kind<>f.document_kind))
  or exists(select 1 from jsonb_each(case when jsonb_typeof(profile->'documents')='object' then profile->'documents' else '{}'::jsonb end) d
    where d.value->>'path'=any(paths) and d.key<>f.document_kind)
  or exists(select 1 from jsonb_array_elements(case when jsonb_typeof(profile->'policies')='array' then profile->'policies' else '[]'::jsonb end) p
    where p->'document'->>'path'=any(paths) and ('policy:'||(p->>'id')) is distinct from f.document_kind) then
  raise exception 'Legacy source path has conflicting ownership.' using errcode='23514';end if;
 perform 1 from storage.objects where bucket_id='org-documents' and name=any(paths) for share nowait;
 if exists(select 1 from storage.objects o where o.bucket_id='org-documents' and o.name=any(paths)
   and (exists(select 1 from public.legacy_document_upload_stages s where s.storage_path=o.name and s.state='cleaned')
     or exists(select 1 from public.legacy_document_cleanup q where q.storage_path=o.name and q.completed_at is not null))) then
  raise exception 'Retired Storage bytes require reconciliation.' using errcode='23514';end if;
 -- No copy/page/grant/Storage mutation: independently published and guest
 -- snapshots retain their own authority and withdrawal path.
exception when lock_not_available then raise exception 'Document changed; retry.' using errcode='40001';
end $$;
revoke all on function public.assert_legacy_folder_binding_admission(uuid) from public,anon,authenticated,service_role;

create or replace function public.guard_document_file_folder_authority() returns trigger
language plpgsql security definer set search_path='' as $$
declare f public.organization_document_files%rowtype;
begin
 select * into f from public.organization_document_files where id=new.file_id;
 if not found then raise exception 'Document unavailable.' using errcode='23514';end if;
 if f.document_kind is not null then perform public.assert_legacy_folder_binding_admission(f.id);end if;
 perform 1 from public.organization_projects p join public.project_asset_folders d on d.project_id=p.id
  where p.org_id=f.org_id and p.id=new.project_id and d.id=new.folder_id for share of p,d nowait;
 if not found or (f.document_kind is null and f.storage_path not like f.org_id::text||'/library/%') then
  raise exception 'Document and folder must have the same source organization.' using errcode='23514';end if;
 return new;
exception when lock_not_available then raise exception 'Document changed; retry.' using errcode='40001';
end $$;
revoke all on function public.guard_document_file_folder_authority() from public,anon,authenticated,service_role;
comment on function public.assert_legacy_folder_binding_admission(uuid) is
 'Internal legacy binding admission with retained identity/path checks and existing Storage cutover gate. No activation, binding writer, copy reconciliation claim or deletion authorization.';

-- The cutover dependency cannot be withdrawn underneath an admitted legacy
-- binding: that would reopen direct Storage reads. Parent deletion still owns
-- its existing cascade. This does not create or enable a cutover for any org.
create function public.guard_legacy_folder_storage_cutover() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if tg_op='UPDATE' and new.org_id=old.org_id then return new;end if;
 if current_setting('transaction_isolation')<>'read committed' then
  raise exception 'Document changed; retry.' using errcode='40001';end if;
 perform 1 from public.organizations where user_id=old.org_id for update nowait;
 if found and exists(select 1 from public.document_file_folder_authorities a
    join public.organization_document_files f on f.id=a.file_id
    where f.org_id=old.org_id and f.document_kind is not null) then
  raise exception 'Legacy folder bindings require the Storage cutover.' using errcode='42501';end if;
 if tg_op='DELETE' then return old;end if;return new;
exception when lock_not_available then raise exception 'Document changed; retry.' using errcode='40001';
end $$;
revoke all on function public.guard_legacy_folder_storage_cutover() from public,anon,authenticated,service_role;
create trigger legacy_folder_storage_cutover before update or delete on public.organization_private_storage_cutovers
 for each row execute function public.guard_legacy_folder_storage_cutover();
commit;
