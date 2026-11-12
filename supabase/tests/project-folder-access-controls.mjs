import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { spawn, spawnSync } from 'node:child_process'
import { join } from 'node:path'
export async function verifyProjectFolderAccessControls({ postgresDirectory, port, socketDirectory }) {
 const args=['-XqAt','-h',socketDirectory,'-p',port,'-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1']
 const run=query=>spawnSync(join(postgresDirectory,'psql'),args,{input:query,encoding:'utf8'})
 const sql=query=>{const r=run(query);assert.equal(r.status,0,r.stderr);return r.stdout.trim()}
 const deny=(query,pattern)=>{const r=run(query);assert.notEqual(r.status,0);assert.match(r.stderr,pattern)}
 const id=n=>`99890000-0000-4000-8000-${String(n).padStart(12,'0')}`
 const owner=id(1),viewer=id(2),creator=id(3),manager=id(4),outside=id(5),project=id(10),folder=id(11),canvas=id(20)
 const context=actor=>`set role service_role;set request.headers='{"x-coach-house-actor-id":"${actor}"}';`
 const command=(actor=owner,revision=null,rows=null)=>`${context(actor)}select project_folder_access_control('${project}','${folder}','${actor}',${revision??'null'},${rows===null?'null':`'${JSON.stringify(rows)}'`});`
 const read=actor=>JSON.parse(sql(command(actor)))
 const row=(memberId,capability)=>({memberId,capability})
 sql(readFileSync('supabase/migrations/20261108020000_folder_access_controls.sql','utf8'))
 sql(`insert into profiles(id,role) values('${owner}','member'),('${viewer}','member'),('${creator}','staff'),('${manager}','member'),('${outside}','member');
 insert into organizations(user_id) values('${owner}');
 insert into organization_memberships(org_id,member_id,role) values('${owner}','${viewer}','board'),('${owner}','${creator}','staff'),('${owner}','${manager}','board');
 insert into organization_projects(id,org_id,name,created_by,updated_by,status,start_date,end_date)
 values('${project}','${owner}','Folder access','${owner}','${owner}','active','2027-01-01','2027-01-31');
 select mutate_project_asset_folder(id,org_id,'${creator}',updated_at,'{"type":"create","name":"Finance"}','${folder}') from organization_projects where id='${project}';
 insert into organization_workspace_boards values('${owner}','{"workspaceCatalog":{"version":1,"entries":[{"id":"${canvas}","name":"Finance","state":{}}]}}');`)
 assert.equal(read(owner).canManage,false);assert.equal(read(viewer).restricted,false)
 deny(command(owner,0,[]),/management access required/)
 assert.equal(sql(`select audience from project_asset_folders where project_id='${project}';`),'inherited')
 deny(command(outside),/Folder access required/)
 deny(command(owner).replace(`'${owner}',null,null);`,`'${viewer}',null,null);`),/Folder access required/)
 deny(`set role authenticated;select project_folder_access_control('${project}','${folder}','${owner}');`,/permission denied/)
 sql(`select set_project_asset_folder_access('${project}','${folder}','${owner}',0,'restricted','${JSON.stringify([row(viewer,'view'),row(manager,'manage')])}');`)
 assert.equal(read(owner).members.find(m=>m.id===owner).owner,true)
 assert.equal(read(creator).members.find(m=>m.id===creator).retained,'Creator')
 assert.equal(read(viewer).canManage,false)
 deny(command(viewer,1,[]),/management access required/)
 deny(command(manager,1,[]),/Keep your folder management access/)
 deny(command(owner,0,[]),/Folder access changed/)
 deny(command(owner,1,[row(outside,'view')]),/current team member/)
 deny(command(owner,1,[row(owner,'view')]),/owner retains access/)
 deny(command(owner,1,[row(creator,'view')]),/creator retains access/)
 deny(command(owner,1,[row(viewer,'view'),row(viewer,'edit')]),/Invalid folder member/)
 assert.equal(JSON.parse(sql(command(owner,1,[row(viewer,'edit'),row(manager,'manage')]))).revision,2)
 assert.equal(read(viewer).members.find(m=>m.id===viewer).capability,'edit')
 // A direct removal must not erase or misrepresent capped workspace access.
 sql(`${context(owner)}select set_workspace_source_audience('${owner}','${canvas}','${owner}',0,'${JSON.stringify([row(viewer,'manage')])}');
 select set_project_folder_workspace_grants('${project}','${folder}','${owner}',2,'[{"canvasId":"${canvas}","capability":"view","revision":1}]');`)
 assert.equal(read(owner).members.find(m=>m.id===viewer).inheritedCapability,'view')
 sql(command(owner,3,[]))
 assert.equal(read(viewer).members.find(m=>m.id===viewer).capability,null)
 assert.equal(read(viewer).members.find(m=>m.id===viewer).inheritedCapability,'view')
 deny(command(manager),/Folder access required/)
 assert.equal(read(creator).canManage,true)
 sql(`delete from organization_memberships where org_id='${owner}' and member_id='${creator}';
 insert into organization_memberships(org_id,member_id,role) values('${owner}','${creator}','staff');`)
 deny(command(creator),/Folder access required/)
 assert.equal(read(owner).canManage,true)
 assert.equal(sql(`select count(*) from project_folder_workspace_grants where project_id='${project}';`),'1')
 assert.equal(sql(`select count(*) from project_asset_folder_placements where project_id='${project}';`),'0')
 const revision=read(owner).revision
 const session=(query,ready)=>new Promise((resolve,reject)=>{
  const child=spawn(join(postgresDirectory,'psql'),args);let out='',err=''
  child.stdout.on('data',chunk=>{out+=chunk;if(out.includes('locked'))ready?.()});child.stderr.on('data',chunk=>{err+=chunk})
  child.on('error',reject);child.on('close',code=>code===0?resolve(out):reject(new Error(err)));child.stdin.end(query)
 })
 let acquired;const locked=new Promise(resolve=>{acquired=resolve})
 const first=session(`begin;${command(owner,revision,[])}select 'locked';select pg_sleep(0.25);commit;`,acquired)
 await Promise.race([locked,first.then(()=>{throw new Error('Missing lock marker')})])
 const results=await Promise.allSettled([first,session(command(owner,revision,[]))])
 assert.equal(results[0].status,'fulfilled');assert.equal(results[1].status,'rejected')
 assert.match(results[1].reason.message,/Source access is changing|Folder access changed/)
 assert.equal(read(owner).revision,revision+1)
 console.log('[folder-access-controls] Inherited review, no activation, direct grants, workspace caps, creator/owner retention, spoofing, CAS and rejoin passed.')
}
