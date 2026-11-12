-- Saved reports retain known native inputs after references/matches are removed.
-- Historical non-native copies remain an explicit private-activation gate.
begin;
alter table public.organization_finance_opportunities add column source_file_ids uuid[] not null default '{}';

create function public.finance_report_source_files(p_org uuid,p_sources jsonb,p_report jsonb)
returns uuid[] language sql stable security definer set search_path='' as $$
 with refs as (
  select value from jsonb_array_elements(public.workspace_particle_array(p_sources))
  union all select s.value from jsonb_array_elements(public.workspace_particle_array(p_report->'blocks')) b
   cross join lateral jsonb_array_elements(public.workspace_particle_array(b.value->'sources')) s where b.value->>'kind'='sources'
  union all select jsonb_build_object('kind','file','id',value->'fileId')
   from jsonb_array_elements(public.workspace_particle_array(p_report->'blocks')) where value->>'kind'='image' and value->>'fileId' is not null
 ), files as (
  select (value->>'id')::uuid file_id from refs where value->>'kind'='file'
  union select d.file_id from public.organization_workspace_boards b
   cross join lateral public.workspace_particle_board_files(p_org,b.state) d
   join refs r on r.value->>'kind'='particle' and d.record_id='particle:'||(r.value->>'id') where b.org_id=p_org
 ) select array(select distinct file_id from files order by file_id);
$$;
revoke all on function public.finance_report_source_files(uuid,jsonb,jsonb) from public,anon,authenticated,service_role;

-- Exclusive ALTER lock keeps this metadata-only backfill atomic, including closed orgs.
alter table public.organization_finance_opportunities disable trigger opportunity_closure;
alter table public.organization_finance_opportunities disable trigger set_updated_at_organization_finance_opportunities;
update public.organization_finance_opportunities o set source_file_ids=array(
 select distinct file_id from (
  select unnest(public.finance_report_source_files(o.org_id,o.sources,o.report)) file_id
  union select unnest(m.source_file_ids) from public.organization_resource_opportunity_matches m where m.org_id=o.org_id and m.opportunity_id=o.id
 ) d order by file_id);
alter table public.organization_finance_opportunities enable trigger set_updated_at_organization_finance_opportunities;
alter table public.organization_finance_opportunities enable trigger opportunity_closure;

create function public.assert_finance_report_sources(p_org uuid,p_files uuid[],p_actor uuid)
returns void language plpgsql security definer set search_path='' as $$
declare member_role text; finance_role text; file uuid;
begin
 if auth.role() is distinct from 'service_role' or p_actor is null or p_actor is distinct from public.organization_activity_actor_id() then
  raise exception 'Verified finance actor required.' using errcode='42501';end if;
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'Finance permissions changed; retry.' using errcode='40001';end if;
 perform 1 from public.organizations where user_id=p_org for share nowait;
 if not found then raise exception 'Organization unavailable.' using errcode='42501';end if;
 perform public.guard_organization_closure(p_org);
 if p_actor<>p_org then
  select role into member_role from public.organization_memberships where org_id=p_org and member_id=p_actor for share nowait;
  select access_level into finance_role from public.organization_finance_access where org_id=p_org and member_id=p_actor for share nowait;
  if member_role is distinct from 'board' or finance_role is distinct from 'manager' then raise exception 'Finance access denied' using errcode='42501';end if;
 end if;
 foreach file in array p_files loop perform public.assert_workspace_particle_source_view(p_org,file,p_actor);end loop;
exception when lock_not_available then raise exception 'Finance permissions are changing; retry.' using errcode='40001';
end; $$;
revoke all on function public.assert_finance_report_sources(uuid,uuid[],uuid) from public,anon,authenticated,service_role;

create function public.guard_finance_report_sources() returns trigger
language plpgsql security definer set search_path='' as $$
declare actor uuid:=public.organization_activity_actor_id(); files uuid[]; org uuid; row_data jsonb; old_data jsonb;
begin
 row_data:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;org:=(row_data->>'org_id')::uuid;
 if tg_op<>'INSERT' then old_data:=to_jsonb(old);end if;
 -- Existing parent cascade remains possible only after the parent is absent.
 if tg_op='DELETE' and not exists(select 1 from public.organizations where user_id=org) then return old;end if;
 -- Lock referenced board identity while deriving current transitive sources.
 perform 1 from public.organization_workspace_boards where org_id=org for share nowait;
 files:=array(select distinct f from (
  select unnest(public.finance_report_source_files(org,row_data->'sources',row_data->'report')) f
  union select unnest(public.finance_report_source_files(org,old_data->'sources',old_data->'report'))
  union select jsonb_array_elements_text(coalesce(row_data->'source_file_ids','[]'))::uuid
  union select jsonb_array_elements_text(coalesce(old_data->'source_file_ids','[]'))::uuid
 ) d order by f);
 -- Registered public feeds may refresh public notice metadata, never private
 -- report content, references, lineage, workflow state or organization identity.
 if actor is null and tg_op='UPDATE' and auth.role()='service_role'
  and (row_data-array['title','source_label','source_id','due_at','opportunity_type','discovered_at','updated_at'])=
      (old_data-array['title','source_label','source_id','due_at','opportunity_type','discovered_at','updated_at'])
  and exists(select 1 from public.finance_opportunity_sources s where s.id=new.source_id and s.source_key=new.external_provider and s.enabled) then
  new.source_file_ids:=files;return new;
 end if;
 if actor is not null or cardinality(files)>0 then perform public.assert_finance_report_sources(org,files,actor);end if;
 if tg_op='DELETE' then return old;end if;
 new.source_file_ids:=files;return new;
exception when lock_not_available then raise exception 'Finance permissions are changing; retry.' using errcode='40001';
end; $$;
revoke all on function public.guard_finance_report_sources() from public,anon,authenticated,service_role;
create trigger finance_report_sources before insert or update or delete on public.organization_finance_opportunities
 for each row execute function public.guard_finance_report_sources();

create function public.can_read_finance_report_sources(p_org uuid,p_files uuid[],p_sources jsonb,p_report jsonb)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=auth.uid();files uuid[];
begin
 if actor is null or not public.can_view_organization_finance(p_org) or not public.can_read_workspace_particle_origins(p_org,actor) then return false;end if;
 files:=array(select distinct f from (select unnest(p_files) f union select unnest(public.finance_report_source_files(p_org,p_sources,p_report))) d);
 return not exists(select 1 from unnest(files) d(id) left join public.organization_document_files f on f.id=d.id and f.org_id=p_org
  where f.id is null or not public.document_file_folder_actor_can(d.id,actor,'view'));
end; $$;
revoke all on function public.can_read_finance_report_sources(uuid,uuid[],jsonb,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.can_read_finance_report_sources(uuid,uuid[],jsonb,jsonb) to authenticated;
create policy finance_report_source_read on public.organization_finance_opportunities as restrictive for select to authenticated
 using(public.can_read_finance_report_sources(org_id,source_file_ids,sources,report));
create or replace function public.manage_resource_opportunity_matches_before_sources(p_action text,p_org_id uuid,p_actor_id uuid,p_resource_id uuid,p_revision integer,p_canvas_id text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare board jsonb; canvas jsonb; resource jsonb; item jsonb; saved public.organization_resource_opportunity_matches;
  opportunity public.organization_finance_opportunities; can_manage boolean; can_view boolean; result jsonb;
begin
  can_manage := p_actor_id = p_org_id or exists(select 1 from public.organization_finance_access a
    join public.organization_memberships m on m.org_id=a.org_id and m.member_id=a.member_id
    where a.org_id=p_org_id and a.member_id=p_actor_id and a.access_level='manager' and m.role='board');
  can_view := can_manage or exists(select 1 from public.organization_finance_access a
    join public.organization_memberships m on m.org_id=a.org_id and m.member_id=a.member_id
    where a.org_id=p_org_id and a.member_id=p_actor_id and m.role='board');
  if p_actor_id is null or not can_view or (p_action <> 'list' and not can_manage) then raise exception 'Finance access denied' using errcode='42501'; end if;
  if p_action not in ('list','put','save','dismiss','restore') then raise exception 'Unknown match action'; end if;
  if p_action='list' and p_payload ? 'externalIds' and
    (jsonb_typeof(p_payload->'externalIds') is distinct from 'array' or jsonb_array_length(p_payload->'externalIds')>5) then raise exception 'Invalid match selection'; end if;
  -- Hold the canonical board stable through the match write/Save transaction.
  select state into board from public.organization_workspace_boards where org_id=p_org_id for share;
  canvas := board;
  if p_canvas_id is not null then
    select e->'state' into canvas from jsonb_array_elements(coalesce(board->'workspaceCatalog'->'entries','[]')) e where e->>'id'=p_canvas_id;
  elsif coalesce((board->'workspaceCatalog'->>'defaultDeleted')::boolean,false) then raise exception 'Workspace unavailable'; end if;
  select p into resource from jsonb_array_elements(coalesce(canvas->'particleGraph'->'particles','[]')) p where p->>'id'=p_resource_id::text and p->>'type'='activity';
  if resource is null or resource->>'revision' is distinct from p_revision::text then raise exception 'Resource changed. Reopen matching.' using errcode='40001'; end if;
  if p_action='put' then
    if jsonb_typeof(p_payload) is distinct from 'array' or jsonb_array_length(p_payload)>5 then raise exception 'Invalid match batch'; end if;
    for item in select value from jsonb_array_elements(p_payload) loop
      if item ? 'expectedUpdatedAt' then
        select * into saved from public.organization_resource_opportunity_matches where org_id=p_org_id and resource_id=p_resource_id and provider='grants_gov' and external_id=item->'notice'->>'externalId' for update;
        if not found or saved.updated_at is distinct from (item->>'expectedUpdatedAt')::timestamptz then raise exception 'Match changed. Refresh before retrying.' using errcode='40001'; end if;
      end if;
      if item->'need'->>'resourceId' is distinct from p_resource_id::text or item->'need'->>'resourceRevision' is distinct from p_revision::text
        or item->'assessment'->>'resourceId' is distinct from p_resource_id::text or item->'assessment'->>'resourceRevision' is distinct from p_revision::text
        or item->'assessment'->>'externalId' is distinct from item->'notice'->>'externalId'
        or item->'notice'->>'provider' is distinct from 'grants_gov' then raise exception 'Invalid match scope'; end if;
      insert into public.organization_resource_opportunity_matches(org_id,resource_id,canvas_id,resource_revision,provider,external_id,notice,need,assessment)
      values(p_org_id,p_resource_id,p_canvas_id,p_revision,'grants_gov',item->'notice'->>'externalId',item->'notice',item->'need',item->'assessment')
      on conflict(org_id,resource_id,provider,external_id) do update set
        canvas_id=excluded.canvas_id,resource_revision=excluded.resource_revision,notice=jsonb_set(excluded.notice,'{discoveredAt}',coalesce(organization_resource_opportunity_matches.notice->'discoveredAt',excluded.notice->'discoveredAt','null'::jsonb)),need=excluded.need,assessment=excluded.assessment,updated_at=clock_timestamp()
        where not coalesce((item->>'insertOnly')::boolean,false)
          and (excluded.notice->>'verifiedAt')::timestamptz >= (organization_resource_opportunity_matches.notice->>'verifiedAt')::timestamptz;
    end loop;
  elsif p_action in ('save','dismiss','restore') then
    select * into saved from public.organization_resource_opportunity_matches where id=(p_payload->>'id')::uuid and org_id=p_org_id and resource_id=p_resource_id and canvas_id is not distinct from p_canvas_id for update;
    if not found then raise exception 'Match unavailable'; end if;
    if saved.updated_at is distinct from (p_payload->>'updatedAt')::timestamptz then raise exception 'Match changed. Refresh before retrying.' using errcode='40001'; end if;
    if p_action='save' then
      if saved.resource_revision <> p_revision or not coalesce((saved.assessment->>'active')::boolean,false)
        or (saved.notice->>'verifiedAt')::timestamptz < clock_timestamp()-interval '10 minutes' then raise exception 'Refresh this match before saving'; end if;
      insert into public.organization_finance_opportunities(org_id,title,source_label,opportunity_type,status,external_provider,external_opportunity_id,sources,report,source_file_ids)
      values(p_org_id,left(saved.notice->>'title',200),nullif(left(saved.notice->>'agency',120),''),'grant','saved','grants_gov',saved.external_id,
        jsonb_build_array(jsonb_build_object('kind','link','url',saved.notice->>'originalUrl')),p_payload->'report',saved.source_file_ids)
      on conflict(org_id,external_provider,external_opportunity_id) do nothing;
      select * into opportunity from public.organization_finance_opportunities where org_id=p_org_id and external_provider='grants_gov' and external_opportunity_id=saved.external_id for update;
      perform public.assert_finance_report_sources(p_org_id,
        opportunity.source_file_ids||public.finance_report_source_files(p_org_id,opportunity.sources,opportunity.report),p_actor_id);
      -- Preserve edited reports and factual application/award states.
      if opportunity.status in ('new','dismissed') then update public.organization_finance_opportunities set status='saved' where id=opportunity.id returning * into opportunity; end if;
      update public.organization_resource_opportunity_matches set status='saved',opportunity_id=opportunity.id,updated_at=clock_timestamp() where id=saved.id;
    else
      update public.organization_resource_opportunity_matches set status=case when p_action='dismiss' then 'dismissed' when opportunity_id is null then 'new' else 'saved' end,updated_at=clock_timestamp() where id=saved.id;
    end if;
  end if;
  select coalesce(jsonb_agg(to_jsonb(rows) order by rows.updated_at desc),'[]') into result from
    (select * from public.organization_resource_opportunity_matches where org_id=p_org_id and resource_id=p_resource_id and canvas_id is not distinct from p_canvas_id
      and (p_action<>'list' or not (p_payload ? 'externalIds') or external_id in(select jsonb_array_elements_text(p_payload->'externalIds')))
      order by updated_at desc limit 50) rows;
  return jsonb_build_object('matches',result,'opportunity',case when opportunity.id is null then null else to_jsonb(opportunity) end);
end $$;
revoke all on function public.manage_resource_opportunity_matches_before_sources(text,uuid,uuid,uuid,integer,text,jsonb) from public,anon,authenticated,service_role;
comment on column public.organization_finance_opportunities.source_file_ids is 'Conservative retained known native inputs, not complete historical provenance. Source removal never grants broader access.';
notify pgrst, 'reload schema';
commit;
