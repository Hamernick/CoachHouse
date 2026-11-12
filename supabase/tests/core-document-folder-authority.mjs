import assert from 'node:assert/strict'
import { verifyWorkspaceAiSourceContext } from './workspace-ai-source-context.mjs'

export async function verifyCoreDocumentFolderAuthority({sql,file,migration,race,org,member,identity,snapshot}) {
 const id=n=>`91000000-0000-4000-8000-${String(n).padStart(12,'0')}`
 const viewer=id(1),outsider=id(2),project=id(3),folder=id(4),otherProject=id(5),canvas=id(6)
 const reject=(query,pattern=/Document access denied/)=>assert.throws(()=>sql(query),pattern)
 sql(file('supabase/tests/core-document-folder-authority.fixture.sql'))
 // Exact production permission functions over the controlled prerequisite rows.
 const grants=file('supabase/migrations/20261106030000_project_folder_grants.sql')
 sql(grants.slice(grants.indexOf('create function public.project_folder_actor_can'),grants.indexOf('create function public.can_read_project_asset_folder')))
 const workspaces=file('supabase/migrations/20261107120000_workspace_source_audiences.sql')
 sql(workspaces.slice(workspaces.indexOf('create function public.workspace_source_scope_exists'),workspaces.indexOf('-- Project row locks')))
 sql(workspaces.slice(workspaces.indexOf('alter function public.project_folder_actor_can'),workspaces.indexOf('create function public.set_project_folder_workspace_grants')))
 const originalOids=sql("select array['read_workspace_ai_document_copy_sources(uuid,uuid,text[])'::regprocedure::oid,'guard_document_commit_copy_sources(uuid,jsonb,jsonb,text)'::regprocedure::oid];")
 migration('20261107130000_core_document_folder_authority')
 assert.equal(sql("select array['read_workspace_ai_document_copy_sources(uuid,uuid,text[])'::regprocedure::oid,'guard_document_commit_copy_sources(uuid,jsonb,jsonb,text)'::regprocedure::oid];"),originalOids,'Existing callers retain guarded function identities')
 sql(`insert into auth.users(id) values('${viewer}'),('${outsider}');
 insert into profiles values('${viewer}','member'),('${outsider}','admin');
 insert into organization_memberships(org_id,member_id,role) values('${org}','${member}','staff'),('${org}','${viewer}','staff'),('${org}','${outsider}','admin');
 insert into organizations(user_id,profile) values('${outsider}','{}');
 insert into organization_projects values('${project}','${org}'),('${otherProject}','${outsider}');
 insert into project_asset_folders values('${project}','${folder}','restricted','${org}',null),('${otherProject}','${folder}','restricted','${outsider}',null);
 insert into project_asset_folder_grants select '${project}','${folder}',member_id,case when member_id='${member}' then 'edit' else 'view' end,created_at from organization_memberships where org_id='${org}' and member_id in('${member}','${viewer}');
 insert into core_document_folder_authorities values('${org}','good','${project}','${folder}'),('${org}','mission_vision_values','${project}','${folder}');`)
 reject(`insert into core_document_folder_authorities values('${org}','foreign','${otherProject}','${folder}');`,/same source organization/)
 reject(`${identity(org)}insert into core_document_folder_authorities values('${org}','manual','${project}','${folder}');`,/permission denied/)
 const read=(actor,ids=['good','manual','bad','mission_vision_values'])=>JSON.parse(sql(`${identity(actor)}select read_workspace_ai_document_copy_sources('${org}','${actor}',array[${ids.map(s=>`'${s}'`).join(',')}]);`)).blockedSectionIds
 assert.deepEqual(read(viewer),['bad','manual']) // retained malformed manual source remains blocked independently
 assert.deepEqual(read(outsider),['bad','good','manual','mission_vision_values'])
 assert.deepEqual(read(org),['bad','manual'])
 reject(`${identity(viewer)}select read_workspace_ai_document_copy_sources('${org}','${org}',array['good']);`,/Document source access denied/)
 for(const role of ['anon','authenticated','service_role']) {
  assert.equal(sql(`select has_table_privilege('${role}','core_document_folder_authorities','select,insert,update,delete');`),'f')
  assert.equal(sql(`select has_function_privilege('${role}','assert_core_document_folder_access(uuid,text,uuid,text)','execute');`),'f')
  assert.equal(sql(`select has_function_privilege('${role}','read_workspace_ai_document_copy_sources_before_folder(uuid,uuid,text[])','execute');`),'f')
 }
 const raw=actor=>`set role authenticated;set fixture.actor='${actor}';select count(*) from organizations where user_id='${org}';`
 assert.equal(sql(raw(viewer)),'1');assert.equal(sql(raw(org)),'1')
 reject(raw(outsider),/Document audience projection required/)
 const save=actor=>`${identity(actor)}select fixture_save('good');`
 const before=snapshot();reject(save(viewer));reject(save(outsider));assert.equal(snapshot(),before,'Denied commit preserves profile/session/history')
 assert.equal(sql(save(member)),'t');assert.equal(sql(save(org)),'t')
 const profile=()=>JSON.parse(sql(`select profile from organizations where user_id='${org}'`))
 const direct=(p,actor=org)=>`${identity(actor)}update organizations set profile='${JSON.stringify(p)}' where user_id='${org}';`
 const p=profile();p.name='Unrelated metadata';sql(direct(p,outsider))
 p.mission='private narrative';
 assert.equal(sql("select section_id from core_document_profile_audience_entries('{\"mission\":\"private narrative\"}');"),'mission_vision_values');
 reject(direct(p,viewer));sql(direct(p))
 for(const key of ['mission',' mission ']) {
  const changed=profile();changed[key]='changed legacy body';reject(direct(changed,viewer))
 }
 const removed=profile();removed.roadmap.sections=removed.roadmap.sections.filter(s=>s.id!=='good');reject(direct(removed,viewer))
 const keyed=profile();keyed.roadmap.sections=Object.fromEntries(keyed.roadmap.sections.map(s=>[s.id,s]));keyed.roadmap.sections.good.content='keyed bypass';reject(direct(keyed,viewer))
 const duplicate=profile();duplicate.roadmap.sections.push({...duplicate.roadmap.sections.find(s=>s.id==='good'),content:'duplicate bypass'});reject(direct(duplicate,viewer))
 const changed=profile();changed.roadmap.sections.find(s=>s.id==='good').content='client bypass';
 reject(`set role authenticated;set fixture.actor='${org}';update organizations set profile='${JSON.stringify(changed)}' where user_id='${org}';`,/Verified document actor required/)
 // Actual session-only writes, history and presence cannot bypass folder access.
 const session=`update organization_core_document_sessions set section_content='session edit' where org_id='${org}' and section_id='good';`
 reject(`${identity(viewer)}${session}`);sql(`${identity(member)}${session}`)
 reject(`${identity(viewer)}select fixture_session('good');`)
 reject(`${identity(viewer)}insert into organization_core_document_versions(org_id,section_id,content) values('${org}','good','{}');`)
 const presence=(actor,mode='viewing',as=actor)=>`${identity(actor)}insert into organization_core_document_presence(org_id,section_id,session_id,actor_id,display_name,role,mode) values('${org}','good','${actor}','${as}','Fixture','Member','${mode}');`
 sql(presence(viewer));reject(presence(outsider));reject(presence(viewer,'editing'));reject(presence(member,'viewing',viewer),/Verified presence actor required/)
 reject(`${identity(member)}update organization_core_document_sessions set section_id='unbound' where org_id='${org}' and section_id='good';`,/source authority cannot change/)
 // Real folder and workspace membership functions, including capability caps.
 sql(`delete from project_asset_folder_grants where member_id='${member}';
 insert into organization_workspace_boards values('${org}','{"workspaceCatalog":{"version":1,"entries":[{"id":"${canvas}"}]}}');
 insert into workspace_source_audiences values('${org}','${canvas}');
 insert into workspace_source_audience_members select '${org}','${canvas}',member_id,created_at,'view' from organization_memberships where member_id='${member}' and org_id='${org}';
 insert into project_folder_workspace_grants values('${project}','${folder}','${org}','${canvas}','manage');`)
 assert.deepEqual(read(member),['bad','manual']);reject(save(member))
 sql(`update workspace_source_audience_members set capability='edit' where member_id='${member}';`);assert.equal(sql(save(member)),'t')
 sql(`delete from workspace_source_audience_members where member_id='${member}';`);assert.ok(read(member).includes('good'));reject(save(member))
 // Revocation uses the existing project lock; test both admission orderings
 // against actual canonical save and session writes, not just a helper call.
 sql(`insert into project_asset_folder_grants select '${project}','${folder}',member_id,'edit',created_at from organization_memberships where member_id='${member}' and org_id='${org}';`)
 const revoke=`select 1 from organization_projects where id='${project}' for update;delete from project_asset_folder_grants where member_id='${member}';`
 for(const write of [save(member),`${identity(member)}${session}`]) {
  await race(revoke,write,/permission is changing/)
  await race(write,revoke,/lock timeout/)
 }
 const remove=`delete from organization_memberships where member_id='${member}' and org_id='${org}';`
 await race(remove,save(member),/permission|editor access/);await race(save(member),remove,/lock timeout/)
 sql(remove);reject(save(member),/editor access required/);assert.ok(read(org).includes('bad'));assert.equal(sql(save(org)),'t')
 assert.equal(profile().name,'Unrelated metadata')
 // Current mixed-audience members can obtain canonical input only through the
 // trusted server reader; TS integration tests qualify its mandatory projection.
 sql(`alter table organizations add column ein text,add column public_slug text,
 add column is_public boolean default false,add column location_lat numeric,add column location_lng numeric;`)
 migration('20261107140000_organization_profile_projection_reader')
 const projection=(actor=org,requested=actor)=>`${identity(actor)}select read_organization_profile_for_projection('${org}','${requested}');`
 for(const actor of [org,viewer,outsider]) {
  const row=JSON.parse(sql(projection(actor)))
  assert.equal(row.user_id,org);assert.deepEqual(row.profile,profile())
  assert.deepEqual(Object.keys(row).sort(),['user_id','profile','updated_at','ein','public_slug','is_public','location_lat','location_lng'].sort())
 }
 reject(projection(viewer,org),/Organization projection access required/)
 reject(projection(member),/Organization projection access required/) // revoked above
 reject(`${identity('')}select read_organization_profile_for_projection('${org}','${org}');`,/Organization projection access required/)
 reject(`${identity(org)}select read_organization_profile_for_projection('${org}',null);`,/Organization projection access required/)
 for(const role of ['anon','authenticated']) assert.equal(sql(`select has_function_privilege('${role}','read_organization_profile_for_projection(uuid,uuid)','execute');`),'f')
 assert.equal(sql("select has_function_privilege('service_role','read_organization_profile_for_projection(uuid,uuid)','execute');"),'t')
 sql(`update organizations set closed=true where user_id='${org}';`)
 reject(projection(org),/Organization projection access required/)
 sql(`update organizations set closed=false where user_id='${org}';`)
 reject(raw(outsider),/Document audience projection required/) // fallback never relaxes raw RLS

 // Public admission is independent of owner/member grants and never returns bodies.
 sql('alter table organizations add column is_public_roadmap boolean default false;')
 const publicAdmission=file('supabase/migrations/20261102233000_organization_closure_public_profile_reads.sql')
 sql(publicAdmission.slice(publicAdmission.indexOf('create function public.filter_public_organization_ids'),publicAdmission.indexOf('create function public.organization_closure_read_window')))
 const priorOid=sql("select 'read_workspace_ai_document_copy_sources_before_folder(uuid,uuid,text[])'::regprocedure::oid;")
 migration('20261107150000_public_document_audience')
 assert.equal(sql("select 'read_workspace_ai_document_copy_sources_before_folder(uuid,uuid,text[])'::regprocedure::oid;"),priorOid)
 const published=(ids=['good','manual','bad','mission_vision_values','vision'],audience='roadmap')=>JSON.parse(sql(`${identity('')}select read_public_document_audience('${org}',array[${ids.map(s=>`'${s}'`).join(',')}]::text[],'${audience}');`) || 'null')
 assert.equal(published(),null)
 sql(`update organizations set is_public_roadmap=true where user_id='${org}';`)
 assert.deepEqual(published(),{blockedSectionIds:['bad','good','manual','mission_vision_values'],complete:false})
 assert.equal(published(undefined,'profile'),null)
 assert.deepEqual(published([]),{blockedSectionIds:[],complete:false})
 assert.deepEqual(read(org),['bad','manual'],'Refactoring preserves authenticated lineage rules')
 reject(`${identity('')}select read_public_document_audience('${org}',array['invalid space']);`,/Invalid document source request/)
 reject(`${identity('')}select read_public_document_audience('${org}',array_fill('vision'::text,array[501]));`,/Invalid document source request/)
 for(const role of ['anon','authenticated','service_role']) assert.equal(sql(`select has_function_privilege('${role}','inspect_document_copy_lineage(uuid,text[])','execute');`),'f')
 for(const role of ['anon','authenticated']) assert.equal(sql(`select has_function_privilege('${role}','read_public_document_audience(uuid,text[],text)','execute');`),'f')
 assert.equal(sql("select has_function_privilege('service_role','read_public_document_audience(uuid,text[],text)','execute');"),'t')
 sql(`update organizations set closed=true where user_id='${org}';`);assert.equal(published(),null)
 sql(`update organizations set closed=false where user_id='${org}';`)
 const publicRead=`${identity('')}select read_public_document_audience('${org}',array['vision']);`
 const unpublish=`update organizations set is_public_roadmap=false where user_id='${org}';`
 await race(unpublish,publicRead,null) // contention returns no publication, never old authority
 await race(publicRead,unpublish,/lock timeout/)
 sql(unpublish);assert.equal(published(),null)
 // Exercise batching and the real search RPC with the actual retained-lineage
 // and folder functions above. The private view fixture isolates narrative search.
 const index=file('supabase/migrations/20260801191000_update_search_index_canonical_mission.sql')
 sql(index.slice(0,index.indexOf('create or replace view search_index')))
 sql(`create or replace function public.is_admin() returns boolean language sql as $$select false$$;
 create view public.search_index as
 select 'public-org:'||o.user_id id,coalesce(o.profile->>'name','Organization') label,null::text subtitle,'/community'::text href,
 'Community'::text group_name,'public'::text scope,o.user_id,true is_published,
 to_tsvector('english',coalesce(o.profile->>'name','')) || to_tsvector('english',public.organization_narrative_plain_text(o.profile,'mission_vision_values','mission')) tsv
 from organizations o where o.is_public;`)
 migration('20261107050000_document_search_publication')
 migration('20261107160000_public_profile_document_audiences')
 const batch=(ids=[org])=>JSON.parse(sql(`${identity('')}select read_public_document_audiences(array[${ids.map(id=>`'${id}'`).join(',')}]::uuid[],array['mission_vision_values','vision'],'profile');`))
 assert.deepEqual(batch(),[])
 sql(`update organizations set is_public=true where user_id='${org}';`)
 assert.deepEqual(batch([org,org]),[{organizationId:org,blockedSectionIds:['mission_vision_values'],complete:false}])
 for(const role of ['anon','authenticated']) assert.equal(sql(`select has_function_privilege('${role}','read_public_document_audiences(uuid[],text[],text)','execute');`),'f')
 for(const role of ['anon','authenticated','service_role']) assert.equal(sql(`select has_function_privilege('${role}','public_organization_search_narrative(uuid,jsonb,text,text)','execute');`),'f')
 reject(`${identity('')}select read_public_document_audiences(array_fill('${org}'::uuid,array[501]),array['vision']);`,/Invalid public document audience request/)
 const narrative=(section)=>sql(`select public_organization_search_narrative('${org}','{"mission":"needle","roadmap":{"sections":[{"id":"${section}","content":"needle","status":"complete","publicProfileStatusControlled":true}]}}','${section}','mission');`)
 assert.equal(narrative('mission_vision_values'),'','Folder bound content is excluded')
 assert.equal(narrative('bad'),'','Invalid retained lineage is excluded')
 assert.equal(narrative('vision'),'needle','Unrelated public document remains')
 const search=term=>sql(`set fixture.actor='${org}';set request.jwt.claim.role='authenticated';set role authenticated;select count(*) from search_global('${term}','${org}',false,30);`)
 sql(`${identity(org)}update organizations set profile=jsonb_set(profile,'{mission}','"restrictedneedle"') where user_id='${org}';`)
 assert.equal(search('restrictedneedle'),'0','Restricted text cannot match even for the owner in public search')
 assert.equal(search('Unrelated'),'1','Public metadata remains searchable')
 sql(`delete from core_document_folder_authorities where org_id='${org}' and section_id='mission_vision_values';`)
 assert.equal(search('restrictedneedle'),'1','Published unbound narrative remains searchable')
 sql(`update organizations set is_public=false where user_id='${org}';`)
 assert.deepEqual(batch(),[]);assert.equal(search('restrictedneedle'),'0')
 verifyWorkspaceAiSourceContext({sql,migration,org,viewer,project,folder,canvas,identity})
 console.log('Passed: core folder read/commit/profile/history/session/presence authority; legacy aliases, keyed/duplicate sections, owner retention, raw RLS, team/workspace capability intersection, actor/ACL six write/revocation races, public section/lineage veto, closure/publication revocation and two publication races. Controlled prerequisite schema; no private activation.')
}
