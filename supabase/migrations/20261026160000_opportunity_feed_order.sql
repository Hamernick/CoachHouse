-- Stable organization-wide ordering, independent of filters and canvas positions.
begin;
create sequence public.opportunity_feed_position_seq;
alter table public.organization_finance_opportunities add column feed_position bigint;
with positions as (
  select id, row_number() over (order by org_id, due_at asc nulls last, discovered_at desc, id) as position
  from public.organization_finance_opportunities
)
update public.organization_finance_opportunities o set feed_position = p.position from positions p where p.id = o.id;
select setval('public.opportunity_feed_position_seq', coalesce(max(feed_position), 0) + 1, false) from public.organization_finance_opportunities;
alter table public.organization_finance_opportunities alter column feed_position set default nextval('public.opportunity_feed_position_seq'), alter column feed_position set not null;
alter sequence public.opportunity_feed_position_seq owned by public.organization_finance_opportunities.feed_position;
grant select, update on public.organization_finance_opportunities to service_role;
grant usage on sequence public.opportunity_feed_position_seq to service_role;
create index organization_opportunities_feed_order_idx on public.organization_finance_opportunities(org_id, feed_position, id);

create function public.reorder_opportunity_feed(p_org_id uuid, p_previous uuid[], p_ordered uuid[])
returns jsonb language plpgsql security invoker set search_path = public, pg_temp as $$
declare current_ids uuid[]; slots bigint[]; result jsonb;
begin
  if cardinality(p_previous) not between 2 and 200 or cardinality(p_ordered) is distinct from cardinality(p_previous)
    or p_previous is null or p_ordered is null
    or array_position(p_previous, null) is not null or array_position(p_ordered, null) is not null
    or (select count(distinct x) from unnest(p_previous) x) <> cardinality(p_previous)
    or (select count(distinct x) from unnest(p_ordered) x) <> cardinality(p_ordered)
    or not (p_previous @> p_ordered and p_ordered @> p_previous) then
    raise exception 'Invalid opportunity order';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('opportunity-feed:' || p_org_id::text, 0));
  perform 1 from public.organization_finance_opportunities where org_id = p_org_id and id = any(p_previous) for update;
  select array_agg(id order by feed_position, id), array_agg(feed_position order by feed_position, id)
    into current_ids, slots from public.organization_finance_opportunities where org_id = p_org_id and id = any(p_previous);
  if current_ids is distinct from p_previous then raise exception 'Opportunity order changed. Reload and try again.'; end if;
  update public.organization_finance_opportunities o set feed_position = slots[ordered.ordinality::integer]
    from unnest(p_ordered) with ordinality as ordered(id, ordinality)
    where o.id = ordered.id and o.org_id = p_org_id;
  select jsonb_agg(jsonb_build_object('id', id, 'feedPosition', feed_position, 'updatedAt', updated_at) order by feed_position, id)
    into result from public.organization_finance_opportunities where org_id = p_org_id and id = any(p_ordered);
  return result;
end;
$$;
revoke all on function public.reorder_opportunity_feed(uuid,uuid[],uuid[]) from public, anon, authenticated;
grant execute on function public.reorder_opportunity_feed(uuid,uuid[],uuid[]) to service_role;
notify pgrst, 'reload schema';
commit;
