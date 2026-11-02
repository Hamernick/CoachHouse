-- Retire only superseded reviewed copies through the existing bounded cleanup
-- owner. Physical deletion remains the Storage API worker's responsibility.
begin;

create function public.workspace_page_snapshot_excludes_asset(snapshot jsonb,asset_id uuid)
 returns boolean language plpgsql immutable set search_path='' as $$
declare item jsonb; content jsonb; logo jsonb; allowed_keys text[];
 uuid_pattern constant text:='^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$';
begin
 -- SQL NULL means no channel. Unknown versions/shapes cannot authorize deletion.
 if snapshot is null then return true; end if;
 if jsonb_typeof(snapshot) is distinct from 'object' or snapshot->'version' is distinct from '1'::jsonb
  or jsonb_typeof(snapshot->'items') is distinct from 'array'
  or jsonb_typeof(snapshot->'brand') is distinct from 'object' then return false; end if;
 if jsonb_typeof(snapshot->'title') is distinct from 'string'
  or jsonb_typeof(snapshot->'description') is distinct from 'string'
  or jsonb_typeof(snapshot#>'{brand,name}') is distinct from 'string'
  or length(coalesce(snapshot#>>'{brand,name}','')) not between 1 and 240
  or coalesce(snapshot#>>'{brand,organizationSlug}','') !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then return false; end if;
 if exists(select 1 from jsonb_object_keys(snapshot) k where k not in ('version','brand','title','description','items'))
  or exists(select 1 from jsonb_object_keys(snapshot->'brand') k where k not in ('name','organizationSlug','primaryColor','logo'))
  or jsonb_array_length(snapshot->'items') not between 1 and 50 then return false; end if;
 logo:=snapshot#>'{brand,logo}';
 if logo is not null then
  if jsonb_typeof(logo) is distinct from 'object' then return false; end if;
  if coalesce(logo->>'assetId','') !~ uuid_pattern
   or jsonb_typeof(logo->'width') is distinct from 'number' or jsonb_typeof(logo->'height') is distinct from 'number'
   or coalesce(logo->>'width','') !~ '^[1-9][0-9]{0,3}$' or coalesce(logo->>'height','') !~ '^[1-9][0-9]{0,3}$'
   or exists(select 1 from jsonb_object_keys(logo) k where k not in ('assetId','width','height')) then return false; end if;
  if (logo->>'assetId')::uuid=asset_id then return false; end if;
 end if;
 for item in select value from jsonb_array_elements(snapshot->'items') loop
  content:=item->'content';
  if jsonb_typeof(item) is distinct from 'object' or jsonb_typeof(content) is distinct from 'object' then return false; end if;
  if coalesce(item->>'id','') !~ uuid_pattern or jsonb_typeof(item->'title') is distinct from 'string'
   or length(coalesce(item->>'title','')) not between 1 and 240
   or coalesce(content->>'kind','') not in ('text','notes','event','color','form','drive_link','image','document')
   or exists(select 1 from jsonb_object_keys(item) k where k not in ('id','title','description','content')) then return false; end if;
  allowed_keys:=case content->>'kind'
   when 'text' then array['kind'] when 'notes' then array['kind','markdown']
   when 'event' then array['kind','startsAt','location'] when 'color' then array['kind','hex']
   when 'form' then array['kind','definition','intakeVersionId'] when 'drive_link' then array['kind','href']
   when 'image' then array['kind','assetId','alt','width','height'] when 'document' then array['kind','assetId','name'] end;
  if exists(select 1 from jsonb_object_keys(content) k where not k=any(allowed_keys)) then return false; end if;
  if (content->>'kind'='image' and jsonb_typeof(content->'alt') is distinct from 'string')
   or (content->>'kind'='document' and (jsonb_typeof(content->'name') is distinct from 'string' or length(content->>'name') not between 1 and 1024))
   or (content->>'kind'='notes' and jsonb_typeof(content->'markdown') is distinct from 'string')
   or (content->>'kind'='event' and coalesce(jsonb_typeof(content->'startsAt'),'') not in ('string','null'))
   or (content->>'kind'='color' and coalesce(content->>'hex','') !~ '^#[a-fA-F0-9]{6}$')
   or (content->>'kind'='form' and jsonb_typeof(content->'definition') is distinct from 'object')
   or (content->>'kind'='drive_link' and jsonb_typeof(content->'href') is distinct from 'string') then return false; end if;
  if content->>'kind' in ('image','document') then
   if coalesce(content->>'assetId','') !~ uuid_pattern then return false; end if;
   if (content->>'assetId')::uuid=asset_id then return false; end if;
  elsif content ? 'assetId' then return false;
  end if;
 end loop;
 return true;
end $$;
revoke all on function public.workspace_page_snapshot_excludes_asset(jsonb,uuid) from public,anon,authenticated,service_role;

create or replace function public.workspace_page_image_orphans() returns jsonb
 language plpgsql security definer set search_path='' as $$
declare candidate record; page public.organization_workspace_pages%rowtype; result jsonb;
begin
 if current_setting('transaction_isolation')<>'read committed' then
  raise exception 'Asset retirement requires current authority reads' using errcode='25001'; end if;
 -- A disabled/conditional capture hook must not turn cleanup into unjournaled
 -- revocation. Keep the existing exact events and capacity admission boundary.
 if exists(select 1 from (values
  ('workspace_page_image_grants','workspace_image_generation_guard','public.guard_workspace_asset_generation()'::regprocedure,23),
  ('workspace_page_document_grants','workspace_document_generation_guard','public.guard_workspace_asset_generation()'::regprocedure,23),
  ('workspace_page_image_grants','workspace_image_suppression_capture','public.capture_workspace_asset_suppression()'::regprocedure,9),
  ('workspace_page_document_grants','workspace_document_suppression_capture','public.capture_workspace_asset_suppression()'::regprocedure,9),
  ('organization_suppression_events','organization_suppression_capacity','public.guard_organization_suppression_capacity()'::regprocedure,4)
 ) required(relation,name,procedure,mask) where not exists(select 1 from pg_catalog.pg_trigger t
  where t.tgrelid=to_regclass('public.'||required.relation) and t.tgname=required.name and t.tgfoid=required.procedure
  and t.tgtype::integer=required.mask and t.tgenabled in ('O','A') and not t.tgisinternal
  and t.tgqual is null and t.tgnargs=0 and cardinality(t.tgattr::smallint[])=0)) then
  raise exception 'Asset retirement capture boundary unavailable' using errcode='42501'; end if;
 for candidate in
  select g.* from (
   select 'image'::text as domain,id,page_id,org_id,storage_path from public.workspace_page_image_grants
   union all select 'document',id,page_id,org_id,storage_path from public.workspace_page_document_grants
  ) g join public.organization_workspace_pages p on p.id=g.page_id and p.org_id=g.org_id
   join storage.objects o on o.bucket_id='workspace-page-assets' and o.name=g.storage_path
  where o.created_at<clock_timestamp()-interval '24 hours'
   and public.workspace_page_snapshot_excludes_asset(p.published_snapshot,g.id)
   and public.workspace_page_snapshot_excludes_asset(p.guest_snapshot,g.id)
  order by o.created_at,g.org_id,g.page_id,g.domain,g.id limit 2
 loop
  -- Two revocations bound repeated capacity serialization near the retained
  -- history limit inside the existing request timeout. The unchanged orphan
  -- response still returns up to 100.
  -- Canonical publication takes organization then page. Skip busy owners; a
  -- later cleanup retries. Re-read both snapshots only after obtaining locks.
  perform 1 from public.organizations where user_id=candidate.org_id for update skip locked;
  if not found then continue; end if;
  select * into page from public.organization_workspace_pages
   where id=candidate.page_id and org_id=candidate.org_id for update skip locked;
  if not found then continue; end if;
  if not public.workspace_page_snapshot_excludes_asset(page.published_snapshot,candidate.id)
   or not public.workspace_page_snapshot_excludes_asset(page.guest_snapshot,candidate.id) then continue; end if;
  perform 1 from storage.objects where bucket_id='workspace-page-assets' and name=candidate.storage_path
   and created_at<clock_timestamp()-interval '24 hours' for update skip locked;
  if not found then continue; end if;
  if candidate.domain='image' then
   delete from public.workspace_page_image_grants where id=candidate.id and page_id=page.id and org_id=page.org_id;
  else
   delete from public.workspace_page_document_grants where id=candidate.id and page_id=page.id and org_id=page.org_id;
  end if;
 end loop;
 -- Preserve the original orphan contract, 24h object-age grace and 100-path
 -- Storage API batch. Fresh publication requires objects younger than 1h.
 select coalesce(jsonb_agg(name),'[]') into result from (
  select o.name from storage.objects o where o.bucket_id='workspace-page-assets'
   and o.created_at<clock_timestamp()-interval '24 hours'
   and not exists(select 1 from public.workspace_page_image_grants g where g.storage_path=o.name)
   and not exists(select 1 from public.workspace_page_document_grants g where g.storage_path=o.name)
  order by o.created_at,o.id limit 100 for update of o skip locked
 ) candidates;
 return result;
end $$;
revoke all on function public.workspace_page_image_orphans() from public,anon,authenticated;
grant execute on function public.workspace_page_image_orphans() to service_role;
commit;
