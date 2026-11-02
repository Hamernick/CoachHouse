begin;
do $$ begin
  if has_function_privilege('anon','public.reorder_opportunity_feed(uuid,uuid[],uuid[])','EXECUTE')
    or has_function_privilege('authenticated','public.reorder_opportunity_feed(uuid,uuid[],uuid[])','EXECUTE') then
    raise exception 'Order RPC must remain service-only';
  end if;
end $$;
insert into public.organization_finance_opportunities(id,org_id,title,external_provider,external_opportunity_id) values
('90000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000001','First','fixture','order-a'),
('90000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000001','Second','fixture','order-b'),
('90000000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000001','Third','fixture','order-c'),
('90000000-0000-4000-8000-000000000004','00000000-0000-0000-0000-000000000002','Other organization','fixture','order-d');
set local role service_role;
do $$
declare ids uuid[] := array['90000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000002','90000000-0000-4000-8000-000000000003']::uuid[];
  changed uuid[]; result jsonb; middle bigint; foreign_position bigint; rejected boolean;
begin
  select feed_position into middle from public.organization_finance_opportunities where id=ids[2];
  select feed_position into foreign_position from public.organization_finance_opportunities where id='90000000-0000-4000-8000-000000000004';
  -- A filtered reorder swaps occupied slots and preserves the hidden middle item.
  result := public.reorder_opportunity_feed('00000000-0000-0000-0000-000000000001',array[ids[1],ids[3]],array[ids[3],ids[1]]);
  select array_agg(id order by feed_position) into changed from public.organization_finance_opportunities where id=any(ids);
  if changed <> array[ids[3],ids[2],ids[1]] or jsonb_array_length(result) <> 2 then raise exception 'Reorder was not persisted'; end if;
  if (select feed_position from public.organization_finance_opportunities where id=ids[2]) <> middle then raise exception 'Hidden item moved'; end if;
  rejected := false;
  begin perform public.reorder_opportunity_feed('00000000-0000-0000-0000-000000000001',ids,array[ids[3],ids[2],ids[1]]); exception when others then rejected:=true; end;
  if not rejected then raise exception 'Stale order accepted'; end if;
  rejected := false;
  begin perform public.reorder_opportunity_feed('00000000-0000-0000-0000-000000000001',array[ids[1],ids[1]],array[ids[1],ids[1]]); exception when others then rejected:=true; end;
  if not rejected then raise exception 'Duplicate IDs accepted'; end if;
  rejected := false;
  begin perform public.reorder_opportunity_feed('00000000-0000-0000-0000-000000000001',array[ids[1],'90000000-0000-4000-8000-000000000004'::uuid],array['90000000-0000-4000-8000-000000000004'::uuid,ids[1]]); exception when others then rejected:=true; end;
  if not rejected then raise exception 'Foreign organization accepted'; end if;
  if (select feed_position from public.organization_finance_opportunities where id='90000000-0000-4000-8000-000000000004') <> foreign_position then raise exception 'Foreign row changed'; end if;
end $$;
rollback;
