-- Preserve core/policy identities through removal and re-upload.
begin;

create or replace function public.sync_organization_core_document_files(target_org uuid, documents jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare entry record; doc jsonb; path text;
begin
  perform pg_advisory_xact_lock(hashtextextended(target_org::text,0));
  for entry in select key,value from jsonb_each(case when jsonb_typeof(documents)='object' then documents else '{}'::jsonb end)
    where key=any(array['verificationLetter','articlesOfIncorporation','bylaws','stateRegistration',
      'goodStandingCertificate','w9','taxExemptCertificate','ueiConfirmation','samActiveStatus',
      'grantsGovRegistration','gataPreQualification','einConfirmationLetter','irs990s','auditedFinancials'])
  loop
    doc:=entry.value;
    if doc is null or doc='null'::jsonb then continue;end if;
    path:=doc->>'path';
    -- Full-account examples are not uploaded objects and do not acquire IDs.
    if path like 'seed/%' then continue;end if;
    if jsonb_typeof(doc)<>'object' or nullif(path,'') is null
      or not starts_with(path,target_org::text||'/'||entry.key||'/')
      or path ~ '[\\[:cntrl:]]'
      or exists(select 1 from unnest(string_to_array(path,'/')) segment where segment in('','.','..')) then
      raise exception 'Invalid organization document source.' using errcode='23514';
    end if;
    insert into public.organization_document_files(org_id,document_kind,storage_path,name,mime_type,size_bytes,created_by)
    values(target_org,entry.key,path,coalesce(nullif(doc->>'name',''),'Document'),
      coalesce(nullif(doc->>'mime',''),'application/pdf'),
      case when coalesce(doc->>'size','') ~ '^[0-9]+$' then (doc->>'size')::bigint else 0 end,
      coalesce(public.organization_activity_actor_id(),target_org))
    on conflict(org_id,document_kind) do update set storage_path=excluded.storage_path,
      name=excluded.name,mime_type=excluded.mime_type,size_bytes=excluded.size_bytes,deleted_at=null
    where (organization_document_files.storage_path,organization_document_files.name,
      organization_document_files.mime_type,organization_document_files.size_bytes,organization_document_files.deleted_at)
      is distinct from (excluded.storage_path,excluded.name,excluded.mime_type,excluded.size_bytes,null::timestamptz);
  end loop;
  -- Retire missing bindings without losing identity or releasing stored bytes.
  update public.organization_document_files file set deleted_at=now()
  where file.org_id=target_org and file.document_kind is not null
    and file.document_kind not like 'policy:%' and file.deleted_at is null
    and (documents->file.document_kind->>'path') is distinct from file.storage_path;
end;
$$;
revoke all on function public.sync_organization_core_document_files(uuid,jsonb) from public,anon,authenticated,service_role;


create or replace function public.sync_organization_policy_document_files(
  target_org uuid, policy_entries jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  entries jsonb := case when jsonb_typeof(policy_entries) = 'array'
    then policy_entries else '[]'::jsonb end;
begin
  perform pg_advisory_xact_lock(hashtextextended(target_org::text, 0));



  insert into public.organization_document_files (
    org_id, document_kind, storage_path, name, mime_type, size_bytes, created_by
  )
  select target_org, 'policy:' || (policy->>'id'), policy->'document'->>'path',
    coalesce(nullif(policy->'document'->>'name', ''), 'Policy document'),
    coalesce(nullif(policy->'document'->>'mime', ''), 'application/pdf'),
    case when coalesce(policy->'document'->>'size', '') ~ '^[0-9]+$'
      then (policy->'document'->>'size')::bigint else 0 end,
    target_org
  from jsonb_array_elements(entries) policy
  where nullif(policy->>'id', '') is not null
    and starts_with(policy->'document'->>'path',
      target_org::text || '/policies/' || (policy->>'id') || '/')
  on conflict (org_id, document_kind) do update set
    storage_path = excluded.storage_path, name = excluded.name,
    mime_type = excluded.mime_type, size_bytes = excluded.size_bytes,
    deleted_at = null;

  update public.organization_document_files file set deleted_at=now()
  where file.org_id = target_org and file.document_kind like 'policy:%' and file.deleted_at is null
    and not exists (
      select 1 from jsonb_array_elements(entries) policy
      where file.document_kind = 'policy:' || (policy->>'id')
        and policy->'document'->>'path' = file.storage_path
    );
end;
$$;
revoke all on function public.sync_organization_policy_document_files(uuid, jsonb)
  from public, anon, authenticated, service_role;


-- Retain the canonical row and every dependent identity. Existing RLS, paid
-- storage, organization closure and folder-write guards remain authoritative.
create function public.guard_legacy_document_retirement() returns trigger
language plpgsql security definer set search_path='' as $$
declare profile jsonb; current_document jsonb; current_path text; expected_size bigint;
begin
  if old.document_kind is null then
    if tg_op='UPDATE' and new.document_kind is not null then
      raise exception 'Document identity cannot change.' using errcode='42501';
    end if;
    if tg_op='DELETE' then return old;end if;return new;
  end if;
  select o.profile into profile from public.organizations o where o.user_id=old.org_id for share nowait;
  if tg_op='DELETE' then
    -- Parent deletion and the existing exact closure receipt remain supported.
    if not found or public.closure_asset_file_finalization_allowed(old.org_id,old.id) then return old;end if;
    raise exception 'Legacy document identity must be retained.' using errcode='42501';
  end if;
  if (new.id,new.org_id,new.document_kind,new.created_by) is distinct from
     (old.id,old.org_id,old.document_kind,old.created_by) then
    raise exception 'Document identity cannot change.' using errcode='42501';
  end if;
  if old.document_kind like 'policy:%' then
    select p->'document' into current_document from jsonb_array_elements(
      case when jsonb_typeof(profile->'policies')='array' then profile->'policies' else '[]'::jsonb end) p
      where 'policy:'||(p->>'id')=old.document_kind;
  else current_document:=profile->'documents'->old.document_kind;end if;
  current_path:=current_document->>'path';
  if new.deleted_at is null then
    if old.deleted_at is not null and exists(select 1 from storage.objects where bucket_id='org-documents' and name=old.storage_path) then
      raise exception 'Previous document cleanup must finish before re-upload.' using errcode='42501';end if;
    expected_size:=case when coalesce(current_document->>'size','') ~ '^[0-9]+$' then (current_document->>'size')::bigint else 0 end;
    if current_path is distinct from new.storage_path or new.size_bytes<>expected_size then
      raise exception 'Current document binding required.' using errcode='42501';end if;
  else
    if new.storage_path is distinct from old.storage_path or current_path=new.storage_path then
      raise exception 'Retired document binding cannot change.' using errcode='42501';end if;
    if new.size_bytes is distinct from old.size_bytes then
      if new.size_bytes<>0 or exists(select 1 from storage.objects where bucket_id='org-documents' and name=old.storage_path)
        or public.closure_asset_has_reference(profile,old.storage_path)
        or exists(select 1 from public.document_file_versions where storage_path=old.storage_path)
        or exists(select 1 from public.document_version_operations where source_storage_path=old.storage_path and state='committed') then
        raise exception 'Stored document bytes are still retained.' using errcode='42501';end if;
    end if;
  end if;
  return new;
exception when lock_not_available then
  raise exception 'Document changed; retry cleanup.' using errcode='40001';
end;
$$;
revoke all on function public.guard_legacy_document_retirement() from public,anon,authenticated,service_role;
create trigger legacy_document_retirement before update or delete on public.organization_document_files
for each row execute function public.guard_legacy_document_retirement();

-- Metadata-only retirement; never recreate missing identities or release bytes.
update public.organization_document_files f set deleted_at=now()
from public.organizations o where f.org_id=o.user_id and f.document_kind is not null and f.deleted_at is null
  and not exists(select 1 from public.organization_closures c where c.org_id=o.user_id and c.state='closing')
  and case when f.document_kind like 'policy:%' then not exists(
    select 1 from jsonb_array_elements(case when jsonb_typeof(o.profile->'policies')='array' then o.profile->'policies' else '[]'::jsonb end) p
    where 'policy:'||(p->>'id')=f.document_kind and p->'document'->>'path'=f.storage_path)
  else (o.profile->'documents'->f.document_kind->>'path') is distinct from f.storage_path end;

commit;
