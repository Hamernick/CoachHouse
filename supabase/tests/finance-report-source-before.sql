-- A pre-migration saved copy, with native inputs retained on its match.
set request.jwt.claim.role='service_role';
set request.headers='{"x-coach-house-actor-id":"e972bc07-fbf5-4fc8-a416-7f00910a71e2"}';
insert into organization_finance_opportunities(id,org_id,title,external_provider,external_opportunity_id,report)
values('80000000-0000-4000-8000-000000000001','e972bc07-fbf5-4fc8-a416-7f00910a71e2','Saved private report','manual','saved-private','{"version":1,"blocks":[{"kind":"text","text":"Private assessment"}]}');
update organization_resource_opportunity_matches set opportunity_id='80000000-0000-4000-8000-000000000001'
 where org_id='e972bc07-fbf5-4fc8-a416-7f00910a71e2' and resource_id='78000000-0000-4000-8000-000000000002';
create table public.fixture_finance_before as select id,updated_at,report from organization_finance_opportunities;

-- Reset the prior duplicate-ID fixture explicitly: omitting workspaceCatalog
-- intentionally preserves named canvases through the existing board guard.
update organization_workspace_boards set state=jsonb_build_object('particleGraph',jsonb_build_object('workspaceId','e972bc07-fbf5-4fc8-a416-7f00910a71e2','particles',jsonb_build_array(
 jsonb_build_object('id','75000000-0000-4000-8000-000000000003','type','activity','revision',0,'title','Retained private resource'),
 jsonb_build_object('id','78000000-0000-4000-8000-000000000001','type','activity','revision',0,'title','Public resource'))),'workspaceCatalog','{"entries":[]}'::jsonb)
 where org_id='e972bc07-fbf5-4fc8-a416-7f00910a71e2';

select set_project_asset_folder_access('76000000-0000-4000-8000-000000000001','76000000-0000-4000-8000-000000000002','e972bc07-fbf5-4fc8-a416-7f00910a71e2',
 (select access_revision from project_asset_folders where project_id='76000000-0000-4000-8000-000000000001' and id='76000000-0000-4000-8000-000000000002'),'restricted','[]');
