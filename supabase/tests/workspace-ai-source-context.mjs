import assert from 'node:assert/strict'

export function verifyWorkspaceAiSourceContext({sql,migration,org,viewer,project,folder,canvas,identity}) {
 const file='92000000-0000-4000-8000-000000000001'
 const other='92000000-0000-4000-8000-000000000002'
 // Native-file table prerequisites are controlled; audience functions and
 // canonical binding guards below come from the actual production migration.
 sql(`create table organization_document_files(id uuid primary key,org_id uuid,name text,document_kind text,storage_path text,deleted_at timestamptz);
 alter table organization_document_files enable row level security;`)
 migration('20261106040000_document_file_folder_reads')
 migration('20261107170000_workspace_ai_source_context')
 sql(`insert into organization_document_files values('${file}','${org}','Private',null,'${org}/library/source',null),
 ('${other}','${org}','Shared',null,'${org}/library/shared',null);
 insert into document_file_folder_authorities values('${file}','${project}','${folder}');
 insert into workspace_source_audience_members select '${org}','${canvas}',member_id,created_at,'view'
 from organization_memberships where org_id='${org}' and member_id='${viewer}';`)
 const query=(actor=viewer,scope=canvas,as=actor)=>`${identity(actor)}select filter_workspace_ai_sources('${org}','${scope}','${as}',array['${file}','${other}']::uuid[],array['good','bad','vision']);`
 const read=(...args)=>JSON.parse(sql(query(...args)))
 const shared={fileIds:[other],sectionIds:['vision']}
 const full={fileIds:[file,other],sectionIds:['good','vision']}
 assert.deepEqual(read(),full)
 assert.deepEqual(read(org),full)
 assert.deepEqual(read(viewer,'default'),shared,'Personal folder access is not default-chat context')
 assert.deepEqual(read(org,'default'),shared,'Owner retains source access, not implicit context in every chat')
 assert.equal(sql(`select document_file_folder_actor_can('${file}','${org}','view');`),'t')
 assert.throws(()=>sql(query(viewer,canvas,org)),/Workspace context unavailable/)
 assert.throws(()=>sql(query(viewer,other)),/Workspace context unavailable/)
 for(const role of ['anon','authenticated']) assert.equal(sql(`select has_function_privilege('${role}','filter_workspace_ai_sources(uuid,text,uuid,uuid[],text[])','execute');`),'f')
 for(const role of ['anon','authenticated','service_role']) assert.equal(sql(`select has_function_privilege('${role}','workspace_ai_folder_available(uuid,text,uuid,uuid,uuid)','execute');`),'f')
 sql(`delete from project_folder_workspace_grants where project_id='${project}';`)
 assert.deepEqual(read(),shared,'Revoking workspace eligibility removes both source types despite personal access')
 sql(`insert into project_folder_workspace_grants values('${project}','${folder}','${org}','${canvas}','view');
 delete from workspace_source_audience_members where member_id='${viewer}';`)
 assert.deepEqual(read(),shared,'Personal invitation cannot bypass workspace audience removal')
 assert.deepEqual(read(org),full,'Owner retains membership in explicitly granted context')
 sql(`update project_asset_folders set audience='inherited' where project_id='${project}' and id='${folder}';`)
 assert.deepEqual(read(viewer,'default'),full,'Existing inherited organization sources preserve eligibility')
 sql(`update project_asset_folders set audience='restricted' where project_id='${project}' and id='${folder}';
 delete from organization_memberships where org_id='${org}' and member_id='${viewer}';`)
 assert.throws(()=>sql(query()),/Workspace context unavailable/)
 assert.throws(()=>sql(`${identity(org)}select filter_workspace_ai_sources('${org}','${canvas}','${org}',array_fill('${file}'::uuid,array[501]),'{}');`),/Invalid context source request/)
 assert.throws(()=>sql(`${identity(org)}select filter_workspace_ai_sources('${org}','${canvas}','${org}','{}',array[null]::text[]);`),/Invalid document source request/)
 sql(`delete from organization_workspace_boards where org_id='${org}';`)
 assert.deepEqual(read(org,'default'),shared,'Initial unsaved default canvas keeps inherited sources only')
 assert.throws(()=>sql(query(org,canvas)),/Workspace context unavailable/)
 console.log('Passed: AI context actor AND workspace eligibility, owner retention, native/core parity, inherited migration, revocation, stale canvas, spoof/ACL and bounded inputs.')
}
