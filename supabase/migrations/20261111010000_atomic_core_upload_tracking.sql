-- Core upload metadata and its existing canonical file row commit together.
-- Policy attachments already have their own atomic profile trigger.
begin;

create function public.sync_organization_core_document_files(target_org uuid, documents jsonb)
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
  -- Absence is not physical deletion. Existing cleanup retains the tracked
  -- bytes/quota until Storage confirms removal of that exact path.
end;
$$;
revoke all on function public.sync_organization_core_document_files(uuid,jsonb) from public,anon,authenticated,service_role;

create function public.track_organization_core_document_files()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_op='UPDATE' then
    if public.closure_asset_profile_finalization_allowed(to_jsonb(old),to_jsonb(new)) then return new;end if;
    if old.profile->'documents' is not distinct from new.profile->'documents' then return new;end if;
  end if;
  perform public.sync_organization_core_document_files(new.user_id,new.profile->'documents');
  return new;
end;
$$;
revoke all on function public.track_organization_core_document_files() from public,anon,authenticated,service_role;
create trigger track_organization_core_document_files after insert or update of profile on public.organizations
for each row execute function public.track_organization_core_document_files();

-- Metadata only. Preserve existing IDs, Storage bytes and unrelated file rows.
select public.sync_organization_core_document_files(user_id,profile->'documents')
from public.organizations o where jsonb_typeof(profile->'documents')='object'
  and not exists(select 1 from public.organization_closures c where c.org_id=o.user_id and c.state='closing');
commit;
