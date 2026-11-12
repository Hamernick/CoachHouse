import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { join } from 'node:path'

export async function verifyWorkspaceSourceAudiences({ postgresDirectory, port, socketDirectory }) {
  const args=['-XqAt','-h',socketDirectory,'-p',port,'-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1']
  const sql=query=>{
    const result=spawnSync(join(postgresDirectory,'psql'),args,{input:query,encoding:'utf8'})
    assert.equal(result.status,0,result.stderr)
    return result.stdout.trim()
  }
  const reject=(query,pattern)=>{
    const result=spawnSync(join(postgresDirectory,'psql'),args,{input:query,encoding:'utf8'})
    assert.notEqual(result.status,0)
    assert.match(result.stderr,pattern)
  }
  const id=n=>`98000000-0000-4000-8000-${String(n).padStart(12,'0')}`
  const owner=id(1),viewer=id(2),editor=id(3),outsider=id(4),other=id(5),project=id(10),folder=id(11),finance=id(20),comms=id(21),file=id(30)
  const context=actor=>`set role service_role;set request.headers='{"x-coach-house-actor-id":"${actor}"}';`
  const members=[{memberId:viewer,capability:'view'},{memberId:editor,capability:'edit'}]
  const scope=(rev,values=members,actor=owner,canvas=finance)=>`${context(actor)}select set_workspace_source_audience('${owner}','${canvas}','${actor}',${rev},'${JSON.stringify(values)}');`
  const grant=(rev,capability='manage',scopeRevision=1)=>`${context(owner)}select set_project_folder_workspace_grants('${project}','${folder}','${owner}',${rev},'[{"canvasId":"${finance}","capability":"${capability}","revision":${scopeRevision}}]');`
  const can=(actor,capability='view')=>sql(`select project_folder_actor_can('${project}','${folder}','${actor}','${capability}');`)
  const catalog=entries=>JSON.stringify({workspaceCatalog:{version:1,defaultName:'Home',entries}})
  const entries=[{id:finance,name:'Finance',state:{}},{id:comms,name:'Communications',state:{}}]
  const board=values=>`update organization_workspace_boards set state='${catalog(values)}' where org_id='${owner}';`
  sql(`insert into profiles(id,role) values('${owner}','member'),('${viewer}','member'),('${editor}','member'),('${outsider}','admin'),('${other}','member');
    insert into organizations(user_id) values('${owner}'),('${other}');
    insert into organization_memberships(org_id,member_id,role) values('${owner}','${viewer}','board'),('${owner}','${editor}','staff'),('${owner}','${outsider}','admin');
    insert into organization_workspace_boards values('${owner}','${catalog(entries)}'),('${other}','${catalog(entries)}');
    insert into organization_projects(id,org_id,name,created_by,updated_by,status,start_date,end_date,recurrence,recurrence_anchor_start,recurrence_anchor_end)
      values('${project}','${owner}','Audience qualification','${owner}','${owner}','active','2027-01-01','2027-01-31','monthly','2027-01-01','2027-01-31');
    select mutate_project_asset_folder(id,org_id,org_id,updated_at,'{"type":"create","name":"Finance sources"}','${folder}') from organization_projects where id='${project}';
    select set_project_asset_folder_access('${project}','${folder}','${owner}',0,'restricted','[]');`)
  assert.equal(can(owner,'manage'),'t')
  assert.equal(can(viewer),'f')
  assert.equal(can(outsider),'f')
  reject(scope(0,members,outsider),/Source access management required/)
  reject(scope(0,members,owner,id(99)),/Workspace unavailable/)
  reject(`${context(viewer)}select set_workspace_source_audience('${owner}','${finance}','${owner}',0,'[]');`,/Source access management required/)
  assert.equal(sql(scope(0)),'1')
  reject(scope(0),/Workspace audience changed/)
  reject(scope(1,[{memberId:other,capability:'view'}]),/Choose a current team member/)
  reject(scope(1,[members[0],members[0]]),/duplicate key/)
  reject(scope(1,[{...members[0],unknown:true}]),/Invalid workspace member/)
  assert.equal(sql(`select count(*) from workspace_source_audience_members where org_id='${owner}';`),'2')
  assert.equal(sql(grant(1)),'2')
  assert.equal(can(viewer),'t'); assert.equal(can(viewer,'edit'),'f')
  assert.equal(can(editor,'edit'),'t'); assert.equal(can(editor,'manage'),'f')
  assert.equal(can(outsider),'f'); assert.equal(can(other),'f')
  reject(grant(1),/Folder access changed/)
  reject(grant(2,'view',0),/Workspace audience changed/)
  assert.equal(sql(grant(2,'view')),'3')
  assert.equal(can(editor,'edit'),'f')
  assert.equal(sql(grant(3,'edit')),'4')
  assert.equal(can(editor,'edit'),'t')
  assert.equal(sql(`select workspace_source_actor_can('${owner}','${comms}','${editor}','view');`),'f')
  // The actual elevated folder reader and authenticated RLS both use the group.
  assert.equal(sql(`${context(viewer)}select jsonb_array_length(read_project_asset_folders_for_actor('${project}','${viewer}')->'folders');`),'1')
  assert.equal(sql(`set role authenticated;set request.jwt.claim.sub='${viewer}';select count(*) from project_asset_folders where project_id='${project}';`),'1')
  assert.equal(sql(`set role authenticated;set request.jwt.claim.sub='${outsider}';select count(*) from project_asset_folders where project_id='${project}';`),'0')
  // Bind a synthetic native source as fixture administrator; production still
  // exposes no binding writer or restricted-file placement.
  sql(`insert into organization_document_files(id,org_id,name,mime_type,size_bytes,storage_path,created_by) values('${file}','${owner}','fixture.md','text/markdown',3,'${owner}/library/${file}-original.md','${owner}');
    insert into document_file_folder_authorities values('${file}','${project}','${folder}');`)
  assert.equal(sql(`set role authenticated;set request.jwt.claim.sub='${viewer}';select count(*) from organization_document_files where id='${file}';`),'1')
  assert.equal(sql(`set role authenticated;set request.jwt.claim.sub='${outsider}';select count(*) from organization_document_files where id='${file}';`),'0')
  assert.equal(sql(`${context(editor)}select document_version_actor_can_edit('${file}','${editor}');`),'t')
  reject(`${context(viewer)}select document_version_actor_can_edit('${file}','${viewer}');`,/Document editing access required/)
  reject(`${context(editor)}insert into workspace_source_audience_members values('${owner}','${finance}','${outsider}',now(),'manage');`,/permission denied/)
  reject(`set role authenticated;select set_workspace_source_audience('${owner}','${finance}','${owner}',1,'[]');`,/permission denied/)
  assert.equal(sql(`select has_function_privilege('service_role','public.workspace_source_actor_can(uuid,text,uuid,text)','execute');`),'f')
  reject(`insert into project_asset_folder_placements values('${project}','organization:${file}','${folder}');`,/Source permissions are not enabled/)
  // Revocation and rejoining never restore stale group membership, even if the
  // exact former organization membership timestamp is reused.
  sql(`create table scope_old_member as select * from organization_memberships where org_id='${owner}' and member_id='${viewer}';
    delete from organization_memberships where org_id='${owner}' and member_id='${viewer}';
    insert into organization_memberships select * from scope_old_member;`)
  assert.equal(can(viewer),'f');assert.equal(can(owner,'manage'),'t')
  assert.equal(sql(`select revision from workspace_source_audiences where org_id='${owner}' and canvas_id='${finance}';`),'2')
  assert.equal(sql(scope(2)),'3')
  // Renaming never changes source access; removing/recreating the same ID does.
  sql(board(entries.map(entry=>({...entry,name:'Renamed'}))))
  assert.equal(can(viewer),'t')
  sql(board([entries[1]]))
  assert.equal(can(viewer),'f')
  sql(board(entries))
  assert.equal(can(viewer),'f')
  assert.equal(sql(scope(0)),'1')
  assert.equal(sql(grant(4,'edit')),'5')
  assert.equal(can(viewer),'t')

  const session=(query,onLocked)=>new Promise((resolve,reject)=>{
    const child=spawn(join(postgresDirectory,'psql'),args);let out='',err='',notified=false
    child.stdout.on('data',data=>{out+=data;if(!notified&&out.includes('locked')){notified=true;onLocked?.()}})
    child.stderr.on('data',data=>{err+=data});child.on('error',reject)
    child.on('close',code=>code===0?resolve(out):reject(new Error(err)));child.stdin.end(query)
  })
  const race=async(first,second)=>{
    let acquire;const locked=new Promise(resolve=>{acquire=resolve})
    const a=session(`begin;${first}select 'locked';select pg_sleep(0.25);commit;`,acquire)
    await Promise.race([locked,a.then(()=>{throw new Error('Missing lock marker')})])
    return Promise.allSettled([a,session(second)])
  }
  const edit=`${context(editor)}update organization_document_files set name='Workspace-authorized edit.md' where id='${file}';`
  let result=await race(scope(1,[]),edit)
  assert.equal(result[0].status,'fulfilled');assert.equal(result[1].status,'rejected')
  assert.match(result[1].reason.message,/permission is changing/)
  reject(edit,/Document editing access required/)
  sql(scope(2))
  result=await race(edit,scope(3,[]))
  assert.equal(result[0].status,'fulfilled');assert.equal(result[1].status,'rejected')
  assert.match(result[1].reason.message,/Source access is changing/)
  assert.equal(sql(`select name from organization_document_files where id='${file}';`),'Workspace-authorized edit.md')
  sql(scope(3,[]));assert.equal(can(editor),'f')
  sql(scope(4))
  result=await race(scope(5),scope(5))
  assert.equal(result[0].status,'fulfilled');assert.equal(result[1].status,'rejected')
  assert.match(result[1].reason.message,/Source access is changing|Workspace audience changed/)
  // Returning to inherited access erases dormant group links.
  sql(`select set_project_asset_folder_access('${project}','${folder}','${owner}',5,'inherited','[]');
    select set_project_asset_folder_access('${project}','${folder}','${owner}',6,'restricted','[]');`)
  assert.equal(can(editor),'f')
  assert.equal(sql(`select count(*) from project_folder_workspace_grants where project_id='${project}';`),'0')
  sql(grant(7,'edit',6))
  sql(`update organization_projects set status='completed' where id='${project}';`)
  const next=sql(`select id from organization_projects where org_id='${owner}' and name='Audience qualification' and recurrence_occurrence=1;`)
  assert.match(next,/^[0-9a-f-]{36}$/)
  assert.equal(sql(`select project_folder_actor_can('${next}','${folder}','${editor}','edit');`),'t')
  assert.equal(sql(`select count(*) from project_folder_workspace_grants where project_id='${next}';`),'1')
  const managed=[members[0],{memberId:editor,capability:'manage'}]
  sql(scope(6,managed))
  assert.equal(can(editor,'manage'),'f') // Folder grant still caps it at edit.
  sql(grant(8,'manage',7))
  assert.equal(can(editor,'manage'),'t')
  reject(scope(7,[members[0]],editor),/Keep your management access/)
  assert.equal(sql(scope(7,managed,editor)),'8')
  assert.equal(sql(scope(0,[],owner,'default')),'1')
  sql(`update organization_workspace_boards set state=jsonb_set(state,'{workspaceCatalog,defaultDeleted}','true') where org_id='${owner}';`)
  assert.equal(sql(`select count(*) from workspace_source_audiences where org_id='${owner}' and canvas_id='default';`),'0')
  assert.equal(can(editor,'manage'),'t')
  sql(`delete from organization_workspace_boards where org_id='${owner}';`)
  assert.equal(can(editor),'f')
  assert.equal(sql(`select count(*) from project_folder_workspace_grants where org_id='${owner}';`),'0')
  console.log('[workspace-source-audiences] Folder/native source RLS, capped capabilities, owner retention, revocation/rejoin, catalog lifecycle, service authority, rollback and both write/revoke orderings passed. Private placement remains disabled.')
}
