import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { spawn, spawnSync } from 'node:child_process'
import { join } from 'node:path'
export async function verifyFolderWorkspaceAccessControls({ postgresDirectory, port, socketDirectory }) {
 const args=['-XqAt','-h',socketDirectory,'-p',port,'-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1']
 const run=query=>spawnSync(join(postgresDirectory,'psql'),args,{input:query,encoding:'utf8'})
 const sql=query=>{const r=run(query);assert.equal(r.status,0,r.stderr);return r.stdout.trim()}
 const deny=(query,pattern)=>{const r=run(query);assert.notEqual(r.status,0);assert.match(r.stderr,pattern)}
 const id=n=>`99900000-0000-4000-8000-${String(n).padStart(12,'0')}`
 const owner=id(1),viewer=id(2),manager=id(3),project=id(10),folder=id(11),canvas=id(20),hidden=id(21),unmanaged=id(22)
 const context=actor=>`set role service_role;set request.headers='{"x-coach-house-actor-id":"${actor}"}';`
 const row=(memberId,capability)=>({memberId,capability})
 const patch=(canvasId,capability,revision=1)=>({canvasId,capability,revision})
 const json=value=>value===null?'null':`'${JSON.stringify(value)}'`
 const command=(actor=owner,revision=null,members=null,changes=null)=>`${context(actor)}select project_folder_access_review('${project}','${folder}','${actor}',${revision??'null'},${json(members)},${json(changes)});`
 const read=actor=>JSON.parse(sql(command(actor)))
 sql(readFileSync('supabase/migrations/20261108030000_folder_workspace_access_controls.sql','utf8'))
 sql(`insert into profiles(id,role) values('${owner}','member'),('${viewer}','member'),('${manager}','member');
 insert into organizations(user_id) values('${owner}');
 insert into organization_memberships(org_id,member_id,role) values('${owner}','${viewer}','board'),('${owner}','${manager}','board');
 insert into organization_projects(id,org_id,name,created_by,updated_by,status,start_date,end_date)
 values('${project}','${owner}','Folder workspace access','${owner}','${owner}','active','2027-01-01','2027-01-31');
 select mutate_project_asset_folder(id,org_id,'${owner}',updated_at,'{"type":"create","name":"Finance"}','${folder}') from organization_projects where id='${project}';
 insert into organization_workspace_boards values('${owner}','${JSON.stringify({workspaceCatalog:{version:1,entries:[{id:canvas,name:'Programs',state:{}},{id:hidden,name:'Hidden',state:{}},{id:unmanaged,name:'Board',state:{}}]}})}');`)
 assert.deepEqual(read(owner).workspaces,[])
 deny(command(owner,0,null,[patch(canvas,'view')]),/Folder management access/)
 deny(command(owner).replace(`'${owner}',null,null,null);`,`'${manager}',null,null,null);`),/Folder access required/)
 deny(`set role authenticated;select project_folder_access_review('${project}','${folder}','${owner}');`,/permission denied/)
 sql(`select set_project_asset_folder_access('${project}','${folder}','${owner}',0,'restricted','${JSON.stringify([row(manager,'manage')])}');
 ${context(owner)}select set_workspace_source_audience('${owner}','${canvas}','${owner}',0,'${JSON.stringify([row(manager,'manage'),row(viewer,'edit')])}');
 select set_workspace_source_audience('${owner}','${hidden}','${owner}',0,'[]');
 select set_workspace_source_audience('${owner}','${unmanaged}','${owner}',0,'${JSON.stringify([row(manager,'view')])}');`)
 assert.deepEqual(read(manager).workspaces.map(w=>w.id),[canvas])
 // All selected targets are checked before any direct grant is changed.
 deny(command(owner,1,[row(viewer,'manage')],[patch(canvas,'edit',0)]),/Workspace access changed/)
 assert.equal(read(owner).revision,1);assert.equal(read(owner).members.find(m=>m.id===viewer).capability,null)
 deny(command(owner,1,null,[patch(canvas,'view'),patch(canvas,'edit')]),/Invalid workspace change/)
 deny(command(owner,1,null,[{...patch(canvas,'view'),activation:true}]),/Invalid workspace change/)
 deny(command(owner,1,null,[patch(canvas,'admin')]),/Invalid workspace change/)
 deny(command(owner,1,null,[patch(id(99),'view')]),/Workspace source management/)
 let data=JSON.parse(sql(command(owner,1,[row(manager,'manage')],[patch(canvas,'view'),patch(hidden,'view'),patch(unmanaged,'edit')])) )
 assert.equal(data.revision,2)
 assert.equal(read(viewer).members.find(m=>m.id===viewer).inheritedCapability,'view')
 data=read(manager);assert.equal(data.workspaces.length,2)
 assert.equal(data.workspaces.find(w=>w.id===unmanaged).canManage,false)
 assert.equal(JSON.stringify(data).includes('Hidden'),false)
 // Editable target changes preserve both hidden and visible-but-unmanaged grants.
 data=JSON.parse(sql(command(manager,2,[row(manager,'manage')],[patch(canvas,'edit')])) )
 assert.equal(data.revision,3)
 assert.equal(sql(`select count(*) from project_folder_workspace_grants where project_id='${project}';`),'3')
 assert.equal(read(viewer).members.find(m=>m.id===viewer).inheritedCapability,'edit')
 deny(command(manager,3,null,[patch(hidden,null)]),/Workspace source management/)
 deny(command(manager,3,null,[patch(unmanaged,null)]),/Workspace source management/)
 deny(command(owner,2,null,[patch(canvas,null)]),/Folder access changed/)
 // Read-only actor cannot edit; a revoked target manager cannot use an old draft.
 deny(command(viewer,3,null,[patch(canvas,'manage')]),/Folder management access/)
 sql(`${context(owner)}select set_workspace_source_audience('${owner}','${canvas}','${owner}',1,'${JSON.stringify([row(viewer,'edit')])}');`)
 deny(command(manager,3,null,[patch(canvas,'manage')]),/Workspace source management/)
 assert.equal(read(owner).revision,3)
 data=JSON.parse(sql(command(owner,3,[],[patch(canvas,null,2)])))
 assert.equal(data.revision,4);deny(command(viewer),/Folder access required/)
 assert.equal(read(owner).members.find(m=>m.id===owner).owner,true)
 assert.equal(sql(`select count(*) from project_asset_folder_placements where project_id='${project}';`),'0')
 assert.equal(sql(`select canvas_private from workspace_source_audiences where org_id='${owner}' and canvas_id='${canvas}';`),'f')
 // Membership removal/rejoin does not revive the target's old source membership.
 sql(`delete from organization_memberships where org_id='${owner}' and member_id='${viewer}';
 insert into organization_memberships(org_id,member_id,role) values('${owner}','${viewer}','board');`)
 assert.equal(read(owner).workspaces.find(w=>w.id===canvas).revision,3)
 sql(command(owner,4,null,[patch(canvas,'view',3)]))
 deny(command(viewer),/Folder access required/)
 // A concurrent source-audience edit conflicts before it can commit a stale patch.
 let acquired;const locked=new Promise(resolve=>{acquired=resolve})
 const child=spawn(join(postgresDirectory,'psql'),args);let output='',error=''
 child.stdout.on('data',chunk=>{output+=chunk;if(output.includes('locked'))acquired()});child.stderr.on('data',chunk=>{error+=chunk})
 const done=new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',code=>code===0?resolve():reject(new Error(error)))})
 child.stdin.end(`begin;${context(owner)}select set_workspace_source_audience('${owner}','${canvas}','${owner}',3,'[]');select 'locked';select pg_sleep(0.3);commit;`)
 await Promise.race([locked,done.then(()=>{throw new Error('Missing lock marker')})])
 deny(command(owner,5,null,[patch(canvas,null,3)]),/Source access is changing/)
 await done
 deny(command(owner,5,null,[patch(canvas,null,3)]),/Workspace access changed/)
 assert.equal(read(owner).revision,5)
 // A manager relying solely on this workspace cannot remove their last Manage path.
 sql(`${context(owner)}select set_workspace_source_audience('${owner}','${canvas}','${owner}',4,'${JSON.stringify([row(manager,'manage')])}');`)
 sql(command(owner,5,null,[patch(canvas,'manage',5)]))
 deny(command(manager,6,null,[patch(canvas,null,5)]),/Keep your folder management access/)
 assert.equal(read(manager).canManage,true);assert.equal(read(owner).revision,6)
 console.log('[folder-workspace-access] Atomic patch, hidden preservation, caps, manager/rejoin denial, stale/concurrent audience, owner retention and no activation passed.')
}
