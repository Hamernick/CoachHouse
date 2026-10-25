reset role;
insert into public.workspace_ai_runs(id,org_id,actor_id,request_hash,task,target,prompt,tariff,max_credits,max_provider_microdollars,status,proposal,created_at)
select ('74000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'00000000-0000-0000-0000-000000000001',
  case when n%2=0 then '00000000-0000-0000-0000-000000000002'::uuid else '00000000-0000-0000-0000-000000000001'::uuid end,
  repeat('a',64),case when n%2=0 then 'plan' else 'document' end,
  '{"title":"private source title","content":"private source body","sectionId":"mission"}','private prompt','{}',10,1000,'running','private proposal','2099-01-01T00:00:00.123456Z'
from generate_series(1,25) n;
set role service_role;
do $$ declare org uuid:='00000000-0000-0000-0000-000000000001'; member uuid:='00000000-0000-0000-0000-000000000002';
  first_page jsonb; next_page jsonb; last_row jsonb; row jsonb;
begin
  first_page:=public.read_workspace_ai_usage(org,org);
  perform public.assert_ai(jsonb_array_length(first_page->'rows')=20 and (first_page->>'hasMore')::boolean,'usage page is bounded');
  perform public.assert_ai(first_page::text not like '%private prompt%' and first_page::text not like '%private source body%' and first_page::text not like '%private proposal%','financial history excludes content');
  for row in select value from jsonb_array_elements(first_page->'rows') loop
    if row->>'actorId'=member::text then perform public.assert_ai(row->>'resourceTitle' is null and row->>'sectionId' is null,'owner cannot see private member context'); end if;
  end loop;
  last_row:=first_page->'rows'->19;
  next_page:=public.read_workspace_ai_usage(org,org,null,null,(last_row->>'created_at')::timestamptz,(last_row->>'id')::uuid);
  perform public.assert_ai(not exists(select 1 from jsonb_array_elements(first_page->'rows') a join jsonb_array_elements(next_page->'rows') b on a->>'id'=b->>'id'),'tie-broken keyset has no repeated rows');
  perform public.assert_ai(next_page->'rows'->0->>'id'='74000000-0000-4000-8000-000000000005','equal timestamps paginate by ID');
  first_page:=public.read_workspace_ai_usage(org,member,null,'plan');
  perform public.assert_ai(not (first_page->>'canFilterMembers')::boolean,'member cannot filter team');
  perform public.assert_ai(not exists(select 1 from jsonb_array_elements(first_page->'rows') r where r->>'actorId'<>member::text or r->>'task'<>'plan'),'member history stays scoped');
  begin perform public.read_workspace_ai_usage(org,member,org); raise exception 'member read owner usage'; exception when insufficient_privilege then null; end;
  begin perform public.read_workspace_ai_usage(org,'00000000-0000-0000-0000-000000000004'); raise exception 'cross-org usage leaked'; exception when insufficient_privilege then null; end;
  begin perform public.read_workspace_ai_usage(org,'00000000-0000-0000-0000-000000000003'); raise exception 'viewer usage leaked'; exception when insufficient_privilege then null; end;
end $$;
set role authenticated;
do $$ begin
  begin perform public.read_workspace_ai_usage(gen_random_uuid(),gen_random_uuid()); raise exception 'session forged usage actor'; exception when insufficient_privilege then null; end;
end $$;
reset role;
