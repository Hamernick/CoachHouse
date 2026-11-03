-- Remaining known organization display/contact metadata. Physical bindings and
-- unresolved shapes remain for their owner; no identity/provider deletion.
begin;
create function public.closure_profile_metadata_keys() returns text[]
 language sql immutable set search_path='' as $$select array[
 'name','entity','tagline','programs','reports','formationStatus','formation_status','ein',
 'rep','contactName','contact_name','email','phone','address','addressStreet','addressCity','addressState','addressPostal','addressCountry',
 'address_street','address_city','address_state','address_postal','address_country','locationType','locationUrl','location_type','location_url',
 'publicUrl','public_url','website','donateUrl','donate_url','donationUrl','donation_url','givingUrl','giving_url',
 'twitter','facebook','linkedin','instagram','youtube','tiktok','newsletter','github',
 'onboarding_intent_focus','onboarding_role_interest','publicSlug','isPublic',
 'brandVoiceAudience','brandVoiceTone','brandVoiceStyle','brandVoicePersonality','brandVoiceGuidelines','brandVoiceAvoid',
 'brandPrimary','brand_primary','brandColors','brandThemePresetId','brand_theme_preset_id','brandAccentPresetId','brand_accent_preset_id',
 'brandTypographyPresetId','brand_typography_preset_id','brandTypography','brand_typography',
 'focus','focus_area','focus_areas','map_group','map_groups','category','categories','sector','sectors']::text[]$$;
revoke all on function public.closure_profile_metadata_keys() from public,anon,authenticated,service_role;

create function public.closure_profile_metadata_shape(p_key text,p_value jsonb) returns boolean
 language plpgsql immutable set search_path='' as $$
declare slot text;part jsonb;
begin
 if p_value='null'::jsonb then return true;end if;
 if p_key='isPublic' then return jsonb_typeof(p_value)='boolean';end if;
 if p_key in('brandTypography','brand_typography') then
  if jsonb_typeof(p_value)<>'object' or p_value-array['headings','body','code']<>'{}'::jsonb then return false;end if;
  foreach slot in array array['headings','body','code'] loop
   if not(p_value ? slot) then continue;end if;
   part:=p_value->slot;
   if jsonb_typeof(part)<>'object' or part-(case when slot='code' then array['family'] else array['family','weight','tracking'] end)<>'{}'::jsonb then return false;end if;
   if exists(select 1 from jsonb_each(part) where jsonb_typeof(value)<>'string') then return false;end if;
  end loop;
  return true;
 end if;
 if p_key='brandColors' and jsonb_typeof(p_value)<>'array' then return false;end if;
 if p_key in('brandColors','programs','reports','focus','focus_area','focus_areas','map_group','map_groups','category','categories','sector','sectors') and jsonb_typeof(p_value)='array' then
  return not exists(select 1 from jsonb_array_elements(p_value) value where jsonb_typeof(value)<>'string');
 end if;
 return jsonb_typeof(p_value)='string';
end $$;
revoke all on function public.closure_profile_metadata_shape(text,jsonb) from public,anon,authenticated,service_role;
create function public.project_retired_profile_metadata(p_profile jsonb) returns jsonb
 language plpgsql immutable set search_path='' as $$
declare result jsonb:=p_profile;key text;
begin
 if p_profile is null or jsonb_typeof(p_profile)<>'object' then raise exception 'Profile metadata ownership requires reconciliation' using errcode='42501';end if;
 foreach key in array public.closure_profile_metadata_keys() loop
  if p_profile ? key and public.closure_profile_metadata_shape(key,p_profile->key) then result:=result-key;end if;
 end loop;
 return result;
end $$;
revoke all on function public.project_retired_profile_metadata(jsonb) from public,anon,authenticated,service_role;

create table public.organization_closure_profile_cleanups(
 org_id uuid not null,closure_request_id uuid not null,operation_id uuid not null,
 closure_revision integer not null check(closure_revision>0),operator_role text not null,transaction_id bigint not null,
 state text not null check(state in('running','complete')),result jsonb,created_at timestamptz not null default clock_timestamp(),completed_at timestamptz,
 primary key(org_id,closure_request_id,operation_id),check((state='complete')=(result is not null and completed_at is not null))
);
alter table public.organization_closure_profile_cleanups enable row level security;
revoke all on public.organization_closure_profile_cleanups from public,anon,authenticated,service_role;
create function public.guard_closure_profile_cleanup_receipt() returns trigger
 language plpgsql security invoker set search_path='' as $$
begin
 if tg_op<>'UPDATE' then raise exception 'Profile cleanup receipts are retained' using errcode='42501';end if;
 if (to_jsonb(new)-array['state','result','completed_at']) is distinct from (to_jsonb(old)-array['state','result','completed_at'])
  or old.state<>'running' or new.state<>'complete' or new.result is null or new.completed_at is null then raise exception 'Profile cleanup receipt is immutable' using errcode='42501';end if;
 return new;
end $$;
revoke all on function public.guard_closure_profile_cleanup_receipt() from public,anon,authenticated,service_role;
create trigger closure_profile_cleanup_immutable before update or delete on public.organization_closure_profile_cleanups for each row execute function public.guard_closure_profile_cleanup_receipt();
create trigger closure_profile_cleanup_retained before truncate on public.organization_closure_profile_cleanups for each statement execute function public.guard_closure_profile_cleanup_receipt();

create function public.closure_profile_metadata_retirement_allowed(p_old jsonb,p_new jsonb) returns boolean
 language plpgsql security definer set search_path='' as $$
begin
 if coalesce(nullif(current_setting('role',true),'none'),session_user)<>session_user
  or not exists(select 1 from pg_catalog.pg_roles where rolname=session_user and rolsuper)
  or current_setting('transaction_isolation')<>'read committed' or current_setting('session_replication_role')<>'origin' then return false;end if;
 if not exists(select 1 from public.organization_closure_profile_cleanups r join public.organization_closures c
  on c.org_id=r.org_id and c.request_id=r.closure_request_id and c.revision=r.closure_revision
  where r.org_id=(p_old->>'user_id')::uuid and r.operator_role=session_user and r.transaction_id=txid_current() and r.state='running'
   and c.state='closing' and c.export_until=c.requested_at+interval '720 hours' and clock_timestamp()>=c.export_until) then return false;end if;
 return (p_old-array['profile','location_lat','location_lng','updated_at'])=(p_new-array['profile','location_lat','location_lng','updated_at'])
  and p_new->'profile'=public.project_retired_profile_metadata(p_old->'profile')
  and p_new->'location_lat'='null'::jsonb and p_new->'location_lng'='null'::jsonb;
end $$;
revoke all on function public.closure_profile_metadata_retirement_allowed(jsonb,jsonb) from public,anon,authenticated,service_role;

do $migration$
declare definition text;needle text;replacement text;target text;
begin
 foreach target in array array['guard_organization_row_closure','guard_free_workspace_documents','capture_core_document_versions','record_organization_document_activity'] loop
  definition:=pg_get_functiondef(('public.'||target||'()')::regprocedure);
  if strpos(definition,'closure_operating_profile_retirement_allowed')=0 then raise exception 'Operating profile predecessor required: %',target;end if;
  needle:='begin'||chr(10);
  replacement:=needle||' if tg_op=''UPDATE'' and public.closure_profile_metadata_retirement_allowed(to_jsonb(old),to_jsonb(new)) then return new;end if;'||chr(10);
  if (length(definition)-length(replace(definition,needle,'')))/length(needle)<>1 then raise exception 'Unexpected profile metadata predecessor: %',target;end if;
  execute replace(definition,needle,replacement);
 end loop;
end $migration$;

create function public.purge_expired_organization_profile_metadata(p_org_id uuid,p_closure_request_id uuid,p_expected_closure_revision integer,p_operation_id uuid) returns jsonb
 language plpgsql security invoker set search_path='' as $$
declare closure public.organization_closures;prior public.organization_closure_profile_cleanups;organization public.organizations;
 next_profile jsonb;cleanup_result jsonb;before_capture jsonb;removed integer;malformed text[];unknown_keys text[];other_owner_count integer;
 other_owner_keys text[]:=array['roadmap','documents','policies','logoUrl','logo_url','brandMarkUrl','brand_mark_url','headerUrl','header_url','brandIdentity',
  'description','need','needStatement','need_statement','originStory','theoryOfChange','origin_story','theory_of_change','mission','vision','values','boilerplate','org_people','people_roles','people_import_history'];
begin
 if session_user<>current_user or not exists(select 1 from pg_catalog.pg_roles where rolname=current_user and rolsuper)
  or current_setting('transaction_isolation')<>'read committed' or current_setting('session_replication_role')<>'origin' then raise exception 'Actual profile cleanup operator required' using errcode='42501';end if;
 if p_org_id is null or p_closure_request_id is null or p_operation_id is null or p_expected_closure_revision is null or p_expected_closure_revision<1 then raise exception 'Exact profile cleanup identity required' using errcode='22023';end if;
 select * into organization from public.organizations where user_id=p_org_id for update;
 if not found then raise exception 'Organization unavailable' using errcode='42501';end if;
 select * into closure from public.organization_closures where org_id=p_org_id;
 if not found or closure.state<>'closing' or closure.request_id is distinct from p_closure_request_id or closure.revision is distinct from p_expected_closure_revision
  or closure.export_until is null or closure.requested_at is null or closure.export_until<>closure.requested_at+interval '720 hours' or clock_timestamp()<closure.export_until then raise exception 'Expired current closure required' using errcode='42501';end if;
 select * into prior from public.organization_closure_profile_cleanups where org_id=p_org_id and closure_request_id=p_closure_request_id and operation_id=p_operation_id;
 if found then
  if prior.closure_revision<>p_expected_closure_revision or prior.state<>'complete' then raise exception 'Profile cleanup retry changed' using errcode='23505';end if;return prior.result;
 end if;
 next_profile:=public.project_retired_profile_metadata(organization.profile);
 select count(*) into removed from jsonb_object_keys(organization.profile) key where not(next_profile ? key);
 select coalesce(array_agg(key order by key),'{}'::text[]) into malformed from jsonb_object_keys(next_profile) key where key=any(public.closure_profile_metadata_keys());
 select coalesce(array_agg(key order by key),'{}'::text[]) into unknown_keys from jsonb_object_keys(next_profile) key where key<>all(public.closure_profile_metadata_keys()) and key<>all(other_owner_keys);
 select count(*) into other_owner_count from jsonb_object_keys(next_profile) key where key=any(other_owner_keys);
 before_capture:=public.read_organization_suppression_events();
 insert into public.organization_closure_profile_cleanups(org_id,closure_request_id,operation_id,closure_revision,operator_role,transaction_id,state)
 values(p_org_id,p_closure_request_id,p_operation_id,p_expected_closure_revision,session_user,txid_current(),'running');
 if organization.profile is distinct from next_profile or organization.location_lat is not null or organization.location_lng is not null then
  update public.organizations set profile=next_profile,location_lat=null,location_lng=null where user_id=p_org_id;
 end if;
 if public.read_organization_suppression_events() is distinct from before_capture then raise exception 'Profile cleanup changed suppression history' using errcode='42501';end if;
 -- No values or arbitrary unknown key names enter the retained receipt.
 -- Enum-safe malformed names and bounded key digests support reconciliation.
 cleanup_result:=jsonb_build_object('scope','known_profile_metadata','removedMetadataKeys',removed,
  'derivedCoordinatesCleared',organization.location_lat is not null or organization.location_lng is not null,
  'malformedKnownKeys',to_jsonb(malformed),'unknownKeyCount',cardinality(unknown_keys),
  'unknownKeySha256',to_jsonb(array(select encode(sha256(convert_to(key,'UTF8')),'hex') from unnest(unknown_keys) key order by key limit 50)),
  'unknownKeyDigestsTruncated',cardinality(unknown_keys)>50,
  'otherOwnerFieldsRetained',other_owner_count,'canonicalEinAndHandleDispositionPending',true,'releaseQualified',false);
 update public.organization_closure_profile_cleanups set state='complete',result=cleanup_result,completed_at=clock_timestamp() where org_id=p_org_id and closure_request_id=p_closure_request_id and operation_id=p_operation_id;
 return cleanup_result;
end $$;
revoke all on function public.purge_expired_organization_profile_metadata(uuid,uuid,integer,uuid) from public,anon,authenticated,service_role;
comment on function public.purge_expired_organization_profile_metadata(uuid,uuid,integer,uuid) is
 'Private exact expired-closure known profile metadata retirement and derived coordinate removal. Physical bindings, unknown/malformed fields, canonical EIN/handle and independent records remain for explicit owner/retention disposition; no whole-organization, provider deletion or release claim.';
commit;
