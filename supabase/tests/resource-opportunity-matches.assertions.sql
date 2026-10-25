-- Synthetic fixtures exist only in this disposable PostgreSQL suite.
begin;
create function public.assert_match(ok boolean, message text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception '%',message; end if; end $$;
create function public.match_call(action text, actor uuid, payload jsonb default '[]', revision integer default 3)
returns jsonb language sql as $$
select public.manage_resource_opportunity_matches(action,'00000000-0000-0000-0000-000000000001',actor,'10000000-0000-4000-8000-000000000001',revision,null,payload)
$$;
insert into public.organization_workspace_boards values
('00000000-0000-0000-0000-000000000001','{"particleGraph":{"particles":[{"id":"10000000-0000-4000-8000-000000000001","type":"activity","revision":3}]}}');
select public.match_call('put','00000000-0000-0000-0000-000000000001',jsonb_build_array(jsonb_build_object(
 'notice',jsonb_build_object('provider','grants_gov','externalId','123','title','Fixture','agency','Fixture agency','verifiedAt',clock_timestamp(),'originalUrl','https://www.grants.gov/search-results-detail/123'),
 'need','{"resourceId":"10000000-0000-4000-8000-000000000001","resourceRevision":3}'::jsonb,
 'assessment','{"resourceId":"10000000-0000-4000-8000-000000000001","resourceRevision":3,"externalId":"123","active":true}'::jsonb)));
do $$ declare item jsonb; result jsonb; opportunity uuid; before_count integer;
begin
 item := public.match_call('list','00000000-0000-0000-0000-000000000001')->'matches'->0;
 select count(*) into before_count from public.organization_finance_records;
 begin
  perform public.match_call('list','00000000-0000-0000-0000-000000000002');
  raise exception 'Cross-organization actor was accepted';
 exception when insufficient_privilege then null; end;
 begin
  perform public.match_call('list',null);
  raise exception 'Anonymous actor was accepted';
 exception when insufficient_privilege then null; end;
 begin
  perform public.match_call('list','00000000-0000-0000-0000-000000000001','[]',2);
  raise exception 'Stale resource was accepted';
 exception when serialization_failure then null; end;
 result := public.match_call('save','00000000-0000-0000-0000-000000000001',jsonb_build_object('id',item->'id','updatedAt',item->'updated_at','report','{"version":1,"blocks":[]}'::jsonb));
 opportunity := (result->'opportunity'->>'id')::uuid;
 perform public.assert_match(result->'matches'->0->>'status'='saved','Save persists resource status');
 perform public.assert_match((select count(*)=before_count from public.organization_finance_records),'Save never records secured funding');
 begin
  perform public.match_call('dismiss','00000000-0000-0000-0000-000000000001',jsonb_build_object('id',item->'id','updatedAt',item->'updated_at'));
  raise exception 'Stale match was accepted';
 exception when serialization_failure then null; end;
 item := result->'matches'->0;
 update public.organization_finance_opportunities set title='User-edited report',status='applied' where id=opportunity;
 result := public.match_call('save','00000000-0000-0000-0000-000000000001',jsonb_build_object('id',item->'id','updatedAt',item->'updated_at','report','{"version":1,"blocks":[]}'::jsonb));
 perform public.assert_match((select count(*)=1 from public.organization_finance_opportunities where org_id='00000000-0000-0000-0000-000000000001' and external_provider='grants_gov' and external_opportunity_id='123'),'Repeated Save deduplicates canonical notice');
 perform public.assert_match(result->'opportunity'->>'title'='User-edited report' and result->'opportunity'->>'status'='applied','Save preserves manual title and application state');
 item := result->'matches'->0;
 result := public.match_call('dismiss','00000000-0000-0000-0000-000000000001',jsonb_build_object('id',item->'id','updatedAt',item->'updated_at'));
 perform public.assert_match(result->'matches'->0->>'status'='dismissed','Dismiss persists');
 item := result->'matches'->0;
 result := public.match_call('restore','00000000-0000-0000-0000-000000000001',jsonb_build_object('id',item->'id','updatedAt',item->'updated_at'));
 perform public.assert_match(result->'matches'->0->>'status'='saved','Undo restores saved association');
 begin
  perform public.match_call('put','00000000-0000-0000-0000-000000000001',jsonb_build_array(jsonb_build_object('notice',item->'notice','need',item->'need','assessment',item->'assessment','expectedUpdatedAt',item->'updated_at')));
  raise exception 'Refresh overwrote a concurrent decision';
 exception when serialization_failure then null; end;
 update public.organization_resource_opportunity_matches set notice=jsonb_set(notice,'{verifiedAt}',to_jsonb(clock_timestamp()-interval '1 day'));
 item := public.match_call('list','00000000-0000-0000-0000-000000000001')->'matches'->0;
 begin
  perform public.match_call('save','00000000-0000-0000-0000-000000000001',jsonb_build_object('id',item->'id','updatedAt',item->'updated_at','report','{"version":1,"blocks":[]}'::jsonb));
  raise exception 'Stale notice saved';
 exception when raise_exception then if sqlerrm <> 'Refresh this match before saving' then raise; end if; end;
end $$;
-- Current board membership is required even with a historical finance grant.
insert into public.organization_memberships(org_id,member_id,role,member_email) values
('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003','board','fixture@example.org')
on conflict(org_id,member_id) do update set role='board';
insert into public.organization_finance_access(org_id,member_id,access_level,granted_by) values
('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003','viewer','00000000-0000-0000-0000-000000000001')
on conflict(org_id,member_id) do update set access_level='viewer';
select public.assert_match(jsonb_array_length(public.match_call('list','00000000-0000-0000-0000-000000000003')->'matches')=1,'Viewer may read');
do $$ begin
 begin perform public.match_call('put','00000000-0000-0000-0000-000000000003'); raise exception 'Viewer wrote';
 exception when insufficient_privilege then null; end;
end $$;
update public.organization_finance_access set access_level='manager' where member_id='00000000-0000-0000-0000-000000000003';
select public.match_call('put','00000000-0000-0000-0000-000000000003');
update public.organization_memberships set role='staff' where member_id='00000000-0000-0000-0000-000000000003';
do $$ begin
 begin perform public.match_call('list','00000000-0000-0000-0000-000000000003'); raise exception 'Revoked member read';
 exception when insufficient_privilege then null; end;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
select public.assert_match((select count(*)=0 from public.organization_resource_opportunity_matches),'RLS hides foreign matches');
do $$ begin
 begin perform public.match_call('list','00000000-0000-0000-0000-000000000001'); raise exception 'Browser impersonated owner';
 exception when insufficient_privilege then null; end;
 begin delete from public.organization_resource_opportunity_matches; raise exception 'Direct browser writes accepted';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
commit;
