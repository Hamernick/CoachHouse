-- Finite remaining modern media/core/policy owners. Physical removal uses the
-- existing local Storage operator; no ordinary API gains cleanup authority.
begin;

-- Existing320 library machinery already supports the emitted core subfolder.
-- Its independent profile/history/session reference blockers remain unchanged.
do $migration$
declare definition text;needle text;replacement text;
begin
 definition:=pg_get_functiondef('public.assert_closure_document_paths(uuid,uuid,text[])'::regprocedure);
 needle:='or path ~ (''^''||p_org::text||''/library/versions/''';
 replacement:='or (path ~ (''^''||p_org::text||''/library/core/[a-z_]+/''||uuid_pattern||''-[a-zA-Z0-9._-]+$'') and split_part(path,''/'',4)=any(public.closure_core_section_ids()))'||chr(10)||'   '||needle;
 if (length(definition)-length(replace(definition,needle,'')))/length(needle)<>1 then raise exception 'Unexpected core library cleanup predecessor';end if;
 definition:=replace(definition,needle,replacement);
 needle:=' foreach path in array p_paths loop';
 if strpos(definition,needle)=0 then raise exception 'Unexpected document path iteration';end if;
 execute replace(definition,needle,needle||chr(10)||'  perform pg_advisory_xact_lock(hashtextextended(''org-documents/''||path,400000));');
end $migration$;

create table public.organization_closure_asset_cleanups(
 object_id uuid primary key,org_id uuid not null,closure_request_id uuid not null,
 closure_revision integer not null check(closure_revision>0),operation_id uuid not null,
 operator_role text not null,bucket_id text not null,path text not null,storage_origin text not null,
 source_kind text not null check(source_kind in('media','tracked_document','policy')),
 source_key text,file_id uuid,object_created_at timestamptz not null,
 state text not null check(state in('reserved','finishing','complete')),transaction_id bigint,
 created_at timestamptz not null default clock_timestamp(),completed_at timestamptz,
 unique(bucket_id,path),unique(org_id,closure_request_id,operation_id),
 check((state='complete')=(completed_at is not null)),
 check((state='finishing')=(transaction_id is not null))
);
alter table public.organization_closure_asset_cleanups enable row level security;
revoke all on public.organization_closure_asset_cleanups from public,anon,authenticated,service_role;
create function public.guard_closure_asset_cleanup_receipt() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if tg_op<>'UPDATE' then raise exception 'Asset cleanup receipts are retained' using errcode='42501';end if;
 if (to_jsonb(new)-array['state','transaction_id','completed_at']) is distinct from (to_jsonb(old)-array['state','transaction_id','completed_at'])
  or not(old.state='reserved' and new.state='finishing' and new.transaction_id=txid_current() and new.completed_at is null
   or old.state='finishing' and new.state='complete' and new.transaction_id is null and new.completed_at is not null) then
  raise exception 'Asset cleanup receipt is immutable' using errcode='42501';end if;
 return new;
end $$;
revoke all on function public.guard_closure_asset_cleanup_receipt() from public,anon,authenticated,service_role;
create trigger closure_asset_cleanup_immutable before update or delete on public.organization_closure_asset_cleanups for each row execute function public.guard_closure_asset_cleanup_receipt();
create trigger closure_asset_cleanup_retained before truncate on public.organization_closure_asset_cleanups for each statement execute function public.guard_closure_asset_cleanup_receipt();

-- Normalize safe ASCII URI/HTML escapes emitted inside structured rich text.
-- Non-ASCII and unknown legacy path shapes never become deletion authority.
create function public.closure_asset_reference_text(p_text text) returns text
language plpgsql immutable set search_path='' as $$
declare result text:=coalesce(p_text,'');i integer;
begin
 if result !~ '(%[0-9a-fA-F]{2}|&#[xX]?[0-9a-fA-F]+;|&sol;|&period;|&colon;)' then return result;end if;
 for i in 32..126 loop
  result:=regexp_replace(result,'%'||lpad(to_hex(i),2,'0'),replace(chr(i),chr(92),chr(92)||chr(92)),'gi');
  result:=regexp_replace(result,'&#0*'||i::text||';',replace(chr(i),chr(92),chr(92)||chr(92)),'gi');
  result:=regexp_replace(result,'&#x0*'||to_hex(i)||';',replace(chr(i),chr(92),chr(92)||chr(92)),'gi');
 end loop;
 return replace(replace(replace(result,'&sol;','/'),'&period;','.'),'&colon;',':');
end $$;
revoke all on function public.closure_asset_reference_text(text) from public,anon,authenticated,service_role;
create function public.closure_asset_has_reference(p_row jsonb,p_path text) returns boolean
language sql immutable set search_path='' as $$select strpos(public.closure_asset_reference_text(p_row::text),p_path)>0$$;
revoke all on function public.closure_asset_has_reference(jsonb,text) from public,anon,authenticated,service_role;
create function public.closure_asset_matches_binding(p_value text,p_bucket text,p_path text,p_origin text) returns boolean
language plpgsql immutable set search_path='' as $$
declare value text:=public.closure_asset_reference_text(p_value);prefix text;
begin
 if value=p_path then return true;end if;
 foreach prefix in array array[p_origin||'/storage/v1/object/public/',p_origin||'/storage/v1/object/sign/',p_origin||'/storage/v1/render/image/public/'] loop
  if split_part(value,'?',1)=prefix||p_bucket||'/'||p_path then return true;end if;
 end loop;
 return false;
end $$;
revoke all on function public.closure_asset_matches_binding(text,text,text,text) from public,anon,authenticated,service_role;

create function public.project_retired_asset_profile(p_profile jsonb,p_bucket text,p_path text,p_origin text,p_kind text,p_key text) returns jsonb
language plpgsql immutable set search_path='' as $$
declare result jsonb:=p_profile;key text;
begin
 if jsonb_typeof(result)<>'object' then raise exception 'Asset profile ownership requires reconciliation' using errcode='42501';end if;
 if p_kind='media' then
  foreach key in array array['logoUrl','brandMarkUrl','headerUrl'] loop
   if public.closure_asset_matches_binding(result->>key,p_bucket,p_path,p_origin) then result:=result-key;end if;
  end loop;
 elsif p_kind='tracked_document' then
  if jsonb_typeof(result->'documents')='object' and result#>>array['documents',p_key,'path']=p_path then
   result:=jsonb_set(result,'{documents}',(result->'documents')-p_key);
  end if;
 elsif p_kind='policy' then
  if jsonb_typeof(result->'policies')='array' then
   result:=jsonb_set(result,'{policies}',coalesce((select jsonb_agg(v order by n) from jsonb_array_elements(result->'policies') with ordinality a(v,n)
    where not(v->>'id'=p_key and v#>>'{document,path}'=p_path)),'[]'::jsonb));
  end if;
 end if;
 return result;
end $$;
revoke all on function public.project_retired_asset_profile(jsonb,text,text,text,text,text) from public,anon,authenticated,service_role;

-- Writers take the same path lock even BEFORE a reservation exists, so a
-- committed new reference cannot slip between reservation lookup and deletion.
-- Only modern emitted path shapes participate; unrelated writes are unchanged.
create function public.guard_closure_asset_reference() returns trigger
language plpgsql security definer set search_path='' as $$
declare payload text:=public.closure_asset_reference_text(to_jsonb(new)::text);asset_path text;bucket text;
begin
 for asset_path in select distinct m[1] from regexp_matches(payload,
  '([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/(?:logo|logo-mark|header|cover|roadmap|roadmap-inline|email|verificationLetter|articlesOfIncorporation|bylaws|stateRegistration|goodStandingCertificate|w9|taxExemptCertificate|ueiConfirmation|samActiveStatus|grantsGovRegistration|gataPreQualification|einConfirmationLetter|irs990s|auditedFinancials|policies/[0-9a-f-]{36})/[0-9]{13}(?:\.[a-z+]+|-[a-zA-Z0-9._-]+))','g') m loop
  if tg_op='UPDATE' and public.closure_asset_has_reference(to_jsonb(old),asset_path) then continue;end if;
  foreach bucket in array array['org-media','program-media','roadmap-media','org-documents'] loop
   perform pg_advisory_xact_lock_shared(hashtextextended(bucket||'/'||asset_path,400000));
   if exists(select 1 from public.organization_closure_asset_cleanups where bucket_id=bucket and organization_closure_asset_cleanups.path=asset_path) then
    raise exception 'Asset is reserved for retirement' using errcode='PT409';end if;
  end loop;
 end loop;
 for asset_path in select distinct m[1] from regexp_matches(payload,
  '([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/library/(?:core/[a-z_]+/)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-[a-zA-Z0-9._-]+|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/library/versions/[0-9a-f-]{36}/[0-9a-f-]{36}(?:-previous)?\.md)','g')m loop
  if tg_op='UPDATE' and public.closure_asset_has_reference(to_jsonb(old),asset_path) then continue;end if;
  perform pg_advisory_xact_lock_shared(hashtextextended('org-documents/'||asset_path,400000));
  if exists(select 1 from public.organization_closure_document_cleanups where asset_path=any(paths)) then raise exception 'Document is reserved for retirement' using errcode='PT409';end if;
 end loop;
 return new;
end $$;
revoke all on function public.guard_closure_asset_reference() from public,anon,authenticated,service_role;
do $$declare relation text;begin
 foreach relation in array array['organizations','programs','organization_core_document_versions','organization_core_document_sessions',
  'organization_workspace_boards','organization_workspace_pages','organization_project_assets','fiscal_sponsorship_documents',
  'fiscal_sponsorship_applications','fiscal_sponsorship_signature_packets','fiscal_sponsorship_signatures','fiscal_sponsorship_signing_drafts','fiscal_guest_submissions','organization_document_files','document_file_versions','document_version_operations','organization_data_rows','organization_brand_kits'] loop
  execute format('create trigger closure_asset_reference before insert or update on public.%I for each row execute function public.guard_closure_asset_reference()',relation);
 end loop;
end $$;

-- This check intentionally retains actual financial/signing/shared references,
-- irrespective of a policy's title or a planning file's name.
create function public.assert_closure_asset_references(p_org uuid,p_bucket text,p_path text,p_origin text,p_kind text,p_key text,p_file uuid) returns void
language plpgsql security definer set search_path='' as $$
declare row record;relation text;found_ref boolean;projected jsonb;
begin
 for row in select user_id,profile from public.organizations where public.closure_asset_has_reference(profile,p_path) loop
  if row.user_id<>p_org then raise exception 'Shared organization asset reference requires reconciliation' using errcode='PT409';end if;
  projected:=public.project_retired_asset_profile(row.profile,p_bucket,p_path,p_origin,p_kind,p_key);
  if public.closure_asset_has_reference(projected,p_path) then raise exception 'Unknown or external profile asset reference requires reconciliation' using errcode='PT409';end if;
 end loop;
 for row in select * from public.programs where public.closure_asset_has_reference(to_jsonb(programs),p_path) loop
  if row.user_id<>p_org or p_kind<>'media' or not public.closure_asset_matches_binding(row.image_url,p_bucket,p_path,p_origin)
   or public.closure_asset_has_reference(to_jsonb(row)-'image_url',p_path) then raise exception 'Shared or external program asset reference requires reconciliation' using errcode='PT409';end if;
 end loop;
 foreach relation in array array['organization_core_document_versions','organization_core_document_sessions','organization_workspace_boards','organization_workspace_pages',
  'organization_project_assets','fiscal_sponsorship_documents','fiscal_sponsorship_applications','fiscal_sponsorship_signature_packets','fiscal_sponsorship_signatures','fiscal_sponsorship_signing_drafts','fiscal_guest_submissions','document_file_versions','document_version_operations','organization_data_rows','organization_brand_kits'] loop
  execute format('select exists(select 1 from public.%I t where public.closure_asset_has_reference(to_jsonb(t),$1))',relation) into found_ref using p_path;
  if found_ref then raise exception 'Independent asset source reference requires reconciliation' using errcode='PT409';end if;
 end loop;
 if exists(select 1 from public.organization_document_files f where public.closure_asset_has_reference(to_jsonb(f),p_path) and (p_file is null or f.id<>p_file or f.org_id<>p_org)) then
  raise exception 'Independent tracked file reference requires reconciliation' using errcode='PT409';end if;
end $$;
revoke all on function public.assert_closure_asset_references(uuid,text,text,text,text,text,uuid) from public,anon,authenticated,service_role;

create function public.reserve_expired_closure_asset_purge(p_org uuid,p_object uuid,p_request uuid,p_revision integer,p_operation uuid,p_origin text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare object storage.objects;receipt public.organization_closure_asset_cleanups;kind text;key text;file uuid;uuid_pattern text:='[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
begin
 if session_user<>current_user or not exists(select 1 from pg_catalog.pg_roles where rolname=current_user and rolsuper) then raise exception 'Actual asset cleanup operator required' using errcode='42501';end if;
 if p_object is null or p_operation is null or p_origin is null or p_origin !~ '^http://127\.0\.0\.1:55321$' then raise exception 'Exact owned local asset identity required' using errcode='22023';end if;
 perform 1 from public.organizations where user_id=p_org for update;
 if not found then raise exception 'Organization unavailable' using errcode='42501';end if;
 perform public.assert_expired_document_closure(p_org,p_request,p_revision);
 select * into receipt from public.organization_closure_asset_cleanups where object_id=p_object for update;
 if found then
  if receipt.org_id<>p_org or receipt.closure_request_id<>p_request or receipt.closure_revision<>p_revision or receipt.operation_id<>p_operation or receipt.storage_origin<>p_origin then raise exception 'Asset cleanup retry changed' using errcode='23505';end if;
  if receipt.state='complete' and exists(select 1 from storage.objects where bucket_id=receipt.bucket_id and name=receipt.path) then raise exception 'Completed asset reappeared; reconcile recovery' using errcode='PT409';end if;
  return jsonb_build_object('objectId',p_object,'bucket',receipt.bucket_id,'paths',jsonb_build_array(receipt.path),'complete',receipt.state='complete');
 end if;
 select * into object from storage.objects where id=p_object for update nowait;
 if not found or object.created_at is null then raise exception 'Storage object unavailable' using errcode='42501';end if;
 if object.bucket_id='org-media' and object.name ~ ('^'||p_org::text||'/(logo|logo-mark|header|cover|roadmap|email)/[0-9]{13}\.(png|jpeg|webp|svg)$')
  or object.bucket_id='program-media' and object.name ~ ('^'||p_org::text||'/cover/[0-9]{13}\.(png|jpeg|webp|svg\+xml)$')
  or object.bucket_id='roadmap-media' and object.name ~ ('^'||p_org::text||'/roadmap-inline/[0-9]{13}\.(png|jpeg|webp|svg)$') then kind:='media';
 elsif object.bucket_id='org-documents' and object.name ~ ('^'||p_org::text||'/policies/'||uuid_pattern||'/[0-9]{13}-[a-zA-Z0-9._-]+$') then kind:='policy';key:=split_part(object.name,'/',3);
  select id into file from public.organization_document_files where org_id=p_org and document_kind='policy:'||key and storage_path=object.name for update nowait;
 elsif object.bucket_id='org-documents' and object.name ~ ('^'||p_org::text||'/(verificationLetter|articlesOfIncorporation|bylaws|stateRegistration|goodStandingCertificate|w9|taxExemptCertificate|ueiConfirmation|samActiveStatus|grantsGovRegistration|gataPreQualification|einConfirmationLetter|irs990s|auditedFinancials)/[0-9]{13}-[a-zA-Z0-9._-]+$') then
  kind:='tracked_document';key:=split_part(object.name,'/',2);
  select id into file from public.organization_document_files where org_id=p_org and document_kind=key and storage_path=object.name for update nowait;
 else raise exception 'Legacy or unproven asset ownership requires reconciliation' using errcode='PT409';end if;
 if not exists(select 1 from storage.buckets where id=object.bucket_id and public=(object.bucket_id in('org-media','program-media'))) then raise exception 'Asset bucket visibility requires reconciliation' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(object.bucket_id||'/'||object.name,400000));
 perform public.assert_closure_asset_references(p_org,object.bucket_id,object.name,p_origin,kind,key,file);
 insert into public.organization_closure_asset_cleanups(object_id,org_id,closure_request_id,closure_revision,operation_id,operator_role,bucket_id,path,storage_origin,source_kind,source_key,file_id,object_created_at,state)
 values(p_object,p_org,p_request,p_revision,p_operation,session_user,object.bucket_id,object.name,p_origin,kind,key,file,object.created_at,'reserved');
 return jsonb_build_object('objectId',p_object,'bucket',object.bucket_id,'paths',jsonb_build_array(object.name),'complete',false);
end $$;
revoke all on function public.reserve_expired_closure_asset_purge(uuid,uuid,uuid,integer,uuid,text) from public,anon,authenticated,service_role;

create function public.closure_asset_storage_delete_admitted(p_object uuid,p_bucket text,p_path text) returns boolean
language plpgsql security definer set search_path='' as $$
declare receipt public.organization_closure_asset_cleanups;
begin
 if auth.role() is distinct from 'service_role' or current_setting('transaction_isolation')<>'read committed' or current_setting('session_replication_role')<>'origin' then return false;end if;
 select * into receipt from public.organization_closure_asset_cleanups where object_id=p_object and bucket_id=p_bucket and path=p_path and state='reserved';
 if not found then return false;end if;
 perform 1 from public.organizations where user_id=receipt.org_id for share nowait;
 if not found or not pg_try_advisory_xact_lock(hashtextextended(receipt.org_id::text,141600)) then return false;end if;
 perform pg_advisory_xact_lock(hashtextextended(p_bucket||'/'||p_path,400000));
 perform public.assert_expired_document_closure(receipt.org_id,receipt.closure_request_id,receipt.closure_revision);
 perform public.assert_closure_asset_references(receipt.org_id,p_bucket,p_path,receipt.storage_origin,receipt.source_kind,receipt.source_key,receipt.file_id);
 return true;
exception when lock_not_available then return false;
end $$;
revoke all on function public.closure_asset_storage_delete_admitted(uuid,text,text) from public,anon,authenticated,service_role;

create function public.closure_asset_finalization_receipt(p_org uuid) returns public.organization_closure_asset_cleanups
language plpgsql security definer set search_path='' as $$
declare receipt public.organization_closure_asset_cleanups;
begin
 if coalesce(nullif(current_setting('role',true),'none'),session_user)<>session_user or not exists(select 1 from pg_catalog.pg_roles where rolname=session_user and rolsuper) then return null;end if;
 select * into receipt from public.organization_closure_asset_cleanups where org_id=p_org and state='finishing' and transaction_id=txid_current() and operator_role=session_user;
 if not found then return null;end if;
 perform public.assert_expired_document_closure(p_org,receipt.closure_request_id,receipt.closure_revision);
 if exists(select 1 from storage.objects where bucket_id=receipt.bucket_id and name=receipt.path) then return null;end if;
 return receipt;
end $$;
revoke all on function public.closure_asset_finalization_receipt(uuid) from public,anon,authenticated,service_role;
create function public.closure_asset_profile_finalization_allowed(p_old jsonb,p_new jsonb) returns boolean
language plpgsql security definer set search_path='' as $$
declare r public.organization_closure_asset_cleanups;
begin
 r:=public.closure_asset_finalization_receipt((p_old->>'user_id')::uuid);
 return r.object_id is not null and (p_old-array['profile','updated_at'])=(p_new-array['profile','updated_at'])
  and p_new->'profile'=public.project_retired_asset_profile(p_old->'profile',r.bucket_id,r.path,r.storage_origin,r.source_kind,r.source_key);
end $$;
revoke all on function public.closure_asset_profile_finalization_allowed(jsonb,jsonb) from public,anon,authenticated,service_role;
create function public.closure_asset_program_finalization_allowed(p_old jsonb,p_new jsonb) returns boolean
language plpgsql security definer set search_path='' as $$
declare r public.organization_closure_asset_cleanups;
begin
 r:=public.closure_asset_finalization_receipt((p_old->>'user_id')::uuid);
 return r.object_id is not null and r.source_kind='media' and p_new->>'image_url' is null
  and public.closure_asset_matches_binding(p_old->>'image_url',r.bucket_id,r.path,r.storage_origin)
  and (p_old-array['image_url','updated_at'])=(p_new-array['image_url','updated_at']);
end $$;
revoke all on function public.closure_asset_program_finalization_allowed(jsonb,jsonb) from public,anon,authenticated,service_role;
create function public.closure_asset_file_finalization_allowed(p_org uuid,p_file uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare r public.organization_closure_asset_cleanups;
begin r:=public.closure_asset_finalization_receipt(p_org);return r.object_id is not null and r.file_id=p_file and r.source_kind in('tracked_document','policy');end $$;
revoke all on function public.closure_asset_file_finalization_allowed(uuid,uuid) from public,anon,authenticated,service_role;

do $migration$
declare definition text;needle text;replacement text;target text;
begin
 foreach target in array array['guard_organization_row_closure','guard_free_workspace_documents','capture_core_document_versions','record_organization_document_activity','track_organization_policy_document_files'] loop
  definition:=pg_get_functiondef(('public.'||target||'()')::regprocedure);needle:='begin'||chr(10);
  replacement:=needle||' if tg_op=''UPDATE'' and public.closure_asset_profile_finalization_allowed(to_jsonb(old),to_jsonb(new)) then return new;end if;'||chr(10);
  if (length(definition)-length(replace(definition,needle,'')))/length(needle)<>1 then raise exception 'Unexpected asset profile predecessor: %',target;end if;execute replace(definition,needle,replacement);
 end loop;
 foreach target in array array['guard_project_task_closure','record_organization_program_activity'] loop
  definition:=pg_get_functiondef(('public.'||target||'()')::regprocedure);needle:='begin'||chr(10);
  replacement:=needle||' if tg_table_name=''programs'' and tg_op=''UPDATE'' and public.closure_asset_program_finalization_allowed(to_jsonb(old),to_jsonb(new)) then return new;end if;'||chr(10);
  if (length(definition)-length(replace(definition,needle,'')))/length(needle)<>1 then raise exception 'Unexpected asset program predecessor: %',target;end if;execute replace(definition,needle,replacement);
 end loop;
 definition:=pg_get_functiondef('public.guard_uploaded_document_closure()'::regprocedure);needle:=' perform public.guard_uploaded_document_organization(org);';
 replacement:=' if tg_table_name=''organization_document_files'' and tg_op=''DELETE'' and public.closure_asset_file_finalization_allowed(org,(row_data->>''id'')::uuid) then return old;end if;'||chr(10)||needle;
 if (length(definition)-length(replace(definition,needle,'')))/length(needle)<>1 then raise exception 'Unexpected tracked asset predecessor';end if;execute replace(definition,needle,replacement);
 definition:=pg_get_functiondef('public.guard_organization_storage_mutation()'::regprocedure);needle:='begin'||chr(10);
 replacement:=needle||' if tg_op=''DELETE'' and public.closure_asset_storage_delete_admitted(old.id,old.bucket_id,old.name) then return old;end if;'||chr(10)||
  ' if tg_op in(''INSERT'',''UPDATE'') and exists(select 1 from public.organization_closure_asset_cleanups where bucket_id=new.bucket_id and path=new.name) then raise exception ''Retired asset path cannot be reused'' using errcode=''PT409'';end if;'||chr(10);
 if (length(definition)-length(replace(definition,needle,'')))/length(needle)<>1 then raise exception 'Unexpected asset Storage predecessor';end if;execute replace(definition,needle,replacement);
end $migration$;

create function public.finish_expired_closure_asset_purge(p_org uuid,p_object uuid,p_request uuid,p_revision integer,p_operation uuid,p_origin text) returns boolean
language plpgsql security invoker set search_path='' as $$
declare r public.organization_closure_asset_cleanups;profile jsonb;projected jsonb;
begin
 if session_user<>current_user or not exists(select 1 from pg_catalog.pg_roles where rolname=current_user and rolsuper) then raise exception 'Actual asset cleanup operator required' using errcode='42501';end if;
 select o.profile into profile from public.organizations o where user_id=p_org for update;
 if not found then raise exception 'Organization unavailable' using errcode='42501';end if;
 perform public.assert_expired_document_closure(p_org,p_request,p_revision);
 select * into r from public.organization_closure_asset_cleanups where object_id=p_object for update;
 if not found or r.org_id<>p_org or r.closure_request_id<>p_request or r.closure_revision<>p_revision or r.operation_id<>p_operation or r.storage_origin<>p_origin then raise exception 'Exact asset reservation required' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(r.bucket_id||'/'||r.path,400000));
 if exists(select 1 from storage.objects where bucket_id=r.bucket_id and name=r.path) then raise exception 'Asset bytes remain or reappeared' using errcode='PT409';end if;
 if r.state='complete' then return true;end if;
 perform public.assert_closure_asset_references(p_org,r.bucket_id,r.path,p_origin,r.source_kind,r.source_key,r.file_id);
 perform 1 from public.programs where user_id=p_org and public.closure_asset_matches_binding(image_url,r.bucket_id,r.path,p_origin) order by id for update nowait;
 if r.file_id is not null then perform 1 from public.organization_document_files where id=r.file_id for update nowait;end if;
 update public.organization_closure_asset_cleanups set state='finishing',transaction_id=txid_current() where object_id=p_object;
 projected:=public.project_retired_asset_profile(profile,r.bucket_id,r.path,p_origin,r.source_kind,r.source_key);
 if projected is distinct from profile then update public.organizations set profile=projected where user_id=p_org;end if;
 if r.source_kind='media' then update public.programs set image_url=null where user_id=p_org and public.closure_asset_matches_binding(image_url,r.bucket_id,r.path,p_origin);end if;
 if r.file_id is not null then delete from public.organization_document_files where id=r.file_id and org_id=p_org and storage_path=r.path and document_kind=case when r.source_kind='policy' then 'policy:'||r.source_key else r.source_key end;end if;
 update public.organization_closure_asset_cleanups set state='complete',transaction_id=null,completed_at=clock_timestamp() where object_id=p_object;
 return true;
end $$;
revoke all on function public.finish_expired_closure_asset_purge(uuid,uuid,uuid,integer,uuid,text) from public,anon,authenticated,service_role;
comment on table public.organization_closure_asset_cleanups is
 'Private exact local object retirement receipt. Preserves operator/object/source identities without content snapshots. Physical effect uses Storage API and independent absence verification; no hosted CDN/version-retention or whole-organization completion claim.';
commit;
