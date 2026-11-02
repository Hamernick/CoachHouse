\set ON_ERROR_STOP on
\ir organization-closure-finance-fixture.sql
\ir ../migrations/20260807172000_add_organization_finance_opportunities.sql
\ir ../migrations/20260807173000_add_organization_finance_engagement_events.sql
\ir ../migrations/20260808142000_add_finance_opportunity_source_registry.sql
\ir ../migrations/20260808201500_make_finance_opportunity_stages_factual.sql
\ir ../migrations/20261023223000_add_opportunity_sources.sql
\ir ../migrations/20261024000000_add_opportunity_reports.sql
\ir ../migrations/20261025010000_resource_opportunity_matches.sql
\ir ../migrations/20261026160000_opportunity_feed_order.sql
set check_function_bodies=on;
\ir ../migrations/20261102090000_organization_closure_opportunity_writes.sql
grant select,insert,update,delete on public.organization_finance_opportunities,public.organization_finance_engagement_events,
 public.finance_opportunity_scan_runs,public.finance_opportunity_sources,public.organization_resource_opportunity_matches to service_role;
create function public.fixture_closure_opportunities() returns void language plpgsql as $$
begin
 truncate public.organization_resource_opportunity_matches,public.organization_finance_engagement_events,
   public.finance_opportunity_scan_runs,public.organization_finance_opportunities;
 perform public.fixture_closure_finance();
 insert into public.organization_finance_opportunities(id,org_id,title,external_provider,external_opportunity_id,feed_position)
 values(public.fixture_form_id(920),public.fixture_form_id(1),'First','manual','first',1),
       (public.fixture_form_id(921),public.fixture_form_id(1),'Second','manual','second',2),
       (public.fixture_form_id(922),public.fixture_form_id(2),'Other','manual','other',3);
 insert into public.organization_finance_engagement_events(id,org_id,event_type,source_label,finance_record_id,external_provider,external_event_id)
 values(public.fixture_form_id(940),public.fixture_form_id(1),'view','Fixture',public.fixture_form_id(911),'fixture','first'),
       (public.fixture_form_id(941),public.fixture_form_id(2),'view','Other',public.fixture_form_id(911),'fixture','other');
 insert into public.finance_opportunity_scan_runs(id,org_id,source_id)
 select public.fixture_form_id(949+n),public.fixture_form_id(n),id from public.finance_opportunity_sources
 cross join generate_series(1,2) n where source_key='grants_gov';
 update public.organization_workspace_boards set state=jsonb_set(state,'{particleGraph,particles}',
   state#>'{particleGraph,particles}'||jsonb_build_array(jsonb_build_object('id',public.fixture_form_id(960),'type','activity','revision',1)))
 where org_id=public.fixture_form_id(1);
 insert into public.organization_resource_opportunity_matches(id,org_id,resource_id,resource_revision,provider,external_id,notice,need,assessment,opportunity_id)
 select public.fixture_form_id(930+n),public.fixture_form_id(case when n=2 then 2 else 1 end),public.fixture_form_id(960),1,'grants_gov',(1002+n)::text,
   jsonb_build_object('title','Matched','agency','Fixture','originalUrl','https://www.grants.gov','verifiedAt',clock_timestamp(),'provider','grants_gov','externalId',(1002+n)::text),
   jsonb_build_object('resourceId',public.fixture_form_id(960),'resourceRevision',1),
   jsonb_build_object('active',true,'resourceId',public.fixture_form_id(960),'resourceRevision',1,'externalId',(1002+n)::text),
   case when n=0 then null else public.fixture_form_id(922) end
 from generate_series(0,2) n;
end; $$;
create function public.fixture_opportunity_reorder() returns jsonb language sql as $$
 select public.reorder_opportunity_feed(public.fixture_form_id(1),array[public.fixture_form_id(920),public.fixture_form_id(921)],array[public.fixture_form_id(921),public.fixture_form_id(920)]);
$$;
create function public.fixture_opportunity_match(action text default 'save') returns jsonb language sql as $$
 select public.manage_resource_opportunity_matches(action,public.fixture_form_id(1),public.fixture_form_id(1),public.fixture_form_id(960),1,null,
 jsonb_build_object('id',id,'updatedAt',updated_at,'report',jsonb_build_object('version',1,'blocks',jsonb_build_array())))
 from public.organization_resource_opportunity_matches where id=public.fixture_form_id(930);
$$;
