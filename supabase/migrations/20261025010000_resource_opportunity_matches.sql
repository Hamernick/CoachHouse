-- Private resource-specific assessments; saved opportunities remain in their canonical catalog.
create table public.organization_resource_opportunity_matches (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(user_id) on delete cascade,
  resource_id uuid not null,
  canvas_id text,
  resource_revision integer not null check(resource_revision >= 0),
  provider text not null check(provider = 'grants_gov'),
  external_id text not null check(external_id ~ '^[0-9]{1,12}$'),
  notice jsonb not null check(jsonb_typeof(notice) = 'object' and octet_length(notice::text) <= 150000),
  need jsonb not null check(jsonb_typeof(need) = 'object' and octet_length(need::text) <= 10000),
  assessment jsonb not null check(jsonb_typeof(assessment) = 'object' and octet_length(assessment::text) <= 40000),
  status text not null default 'new' check(status in ('new','saved','dismissed')),
  opportunity_id uuid references public.organization_finance_opportunities(id) on delete set null,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  unique(org_id,resource_id,provider,external_id)
);
alter table public.organization_resource_opportunity_matches enable row level security;
alter table public.organization_resource_opportunity_matches force row level security;
create policy resource_matches_read on public.organization_resource_opportunity_matches for select to authenticated
  using ((select public.can_view_organization_finance(org_id)));
revoke all on public.organization_resource_opportunity_matches from public,anon,authenticated;
grant select on public.organization_resource_opportunity_matches to authenticated;

create function public.manage_resource_opportunity_matches(p_action text,p_org_id uuid,p_actor_id uuid,p_resource_id uuid,p_revision integer,p_canvas_id text,p_payload jsonb)
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
      insert into public.organization_finance_opportunities(org_id,title,source_label,opportunity_type,status,external_provider,external_opportunity_id,sources,report)
      values(p_org_id,left(saved.notice->>'title',200),nullif(left(saved.notice->>'agency',120),''),'grant','saved','grants_gov',saved.external_id,
        jsonb_build_array(jsonb_build_object('kind','link','url',saved.notice->>'originalUrl')),p_payload->'report')
      on conflict(org_id,external_provider,external_opportunity_id) do nothing;
      select * into opportunity from public.organization_finance_opportunities where org_id=p_org_id and external_provider='grants_gov' and external_opportunity_id=saved.external_id for update;
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
revoke all on function public.manage_resource_opportunity_matches(text,uuid,uuid,uuid,integer,text,jsonb) from public,anon,authenticated;
grant execute on function public.manage_resource_opportunity_matches(text,uuid,uuid,uuid,integer,text,jsonb) to service_role;
