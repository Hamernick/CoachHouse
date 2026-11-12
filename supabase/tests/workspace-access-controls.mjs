import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { spawn, spawnSync } from 'node:child_process'
import { join } from 'node:path'

export async function verifyWorkspaceAccessControls({ postgresDirectory, port, socketDirectory }) {
 const args=['-XqAt','-h',socketDirectory,'-p',port,'-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1']
 const run=query=>spawnSync(join(postgresDirectory,'psql'),args,{input:query,encoding:'utf8'})
 const sql=query=>{const r=run(query);assert.equal(r.status,0,r.stderr);return r.stdout.trim()}
 const deny=(query,pattern)=>{const r=run(query);assert.notEqual(r.status,0);assert.match(r.stderr,pattern)}
 const id=n=>`99880000-0000-4000-8000-${String(n).padStart(12,'0')}`
 const owner=id(1),viewer=id(2),manager=id(3),admin=id(4),outside=id(5),canvas=id(10)
 const context=actor=>`set role service_role;set request.headers='{"x-coach-house-actor-id":"${actor}"}';`
 const members=[{memberId:viewer,capability:'view'},{memberId:manager,capability:'manage'}]
 const command=(actor=owner,revision=null,rows=null,scope=canvas)=>`${context(actor)}select workspace_access_control('${owner}','${scope}','${actor}',${revision??'null'},${rows===null?'null':`'${JSON.stringify(rows)}'`});`
 const read=actor=>JSON.parse(sql(command(actor)))
 sql(readFileSync('supabase/migrations/20261108010000_workspace_access_controls.sql','utf8'))
 sql(`insert into profiles(id,role) values('${owner}','member'),('${viewer}','member'),('${manager}','member'),('${admin}','admin'),('${outside}','member');
 insert into organizations(user_id) values('${owner}');
 insert into organization_memberships(org_id,member_id,role) values('${owner}','${viewer}','board'),('${owner}','${manager}','staff'),('${owner}','${admin}','admin');
 insert into organization_workspace_boards values('${owner}','{"workspaceCatalog":{"version":1,"defaultName":"Home","entries":[{"id":"${canvas}","name":"Finance","state":{}}]}}');`)
 assert.equal(read(owner).restricted,false);assert.equal(read(owner).canManage,false)
 assert.equal(read(viewer).members.length,4)
 assert.equal(read(owner).members.find(m=>m.id===owner).owner,true)
 deny(command(owner,0,members),/management access required/)
 assert.equal(sql(`select count(*) from workspace_source_audiences where org_id='${owner}';`),'0')
 deny(command(outside),/Workspace access required/)
 deny(command(owner,null,null,id(90)),/Workspace unavailable/)
 deny(command(owner).replace(`'${owner}',null,null);`,`'${viewer}',null,null);`),/Workspace access required/)
 deny(`set role authenticated;select workspace_access_control('${owner}','${canvas}','${owner}');`,/permission denied/)
 sql(`${context(owner)}select set_workspace_source_audience('${owner}','${canvas}','${owner}',0,'${JSON.stringify(members)}');`)
 assert.equal(read(owner).restricted,false,'Source audience does not imply private canvas')
 sql(`update workspace_source_audiences set canvas_private=true where org_id='${owner}';`)
 assert.equal(read(owner).canManage,true);assert.equal(read(manager).canManage,true)
 assert.equal(read(viewer).canManage,false);assert.equal(read(viewer).members.length,3)
 deny(command(admin),/Workspace access required/)
 deny(command(viewer,1,members),/management access required/)
 deny(command(owner,0,members),/Access changed/)
 deny(command(owner,1,[...members,members[0]]),/Invalid workspace member/)
 deny(command(owner,1,[{memberId:outside,capability:'view'}]),/current team member/)
 deny(command(owner,1,[...members,{memberId:owner,capability:'view'}]),/owner already retains access/)
 deny(command(manager,1,[]),/Keep your management access/)
 const saved=JSON.parse(sql(command(owner,1,[{memberId:viewer,capability:'edit'},members[1]])))
 assert.equal(saved.revision,2);assert.equal(read(viewer).members.find(m=>m.id===viewer).capability,'edit')
 deny(command(owner,1,members),/Access changed/)
 // Retained private state survives deletion; only reductions are allowed.
 sql(`update organization_workspace_boards set state='{}' where org_id='${owner}';`)
 assert.equal(read(manager).deleted,true);assert.equal(read(owner).name,'Deleted workspace')
 deny(command(owner,2,[...members,{memberId:admin,capability:'view'}]),/only be reduced/)
 deny(command(owner,2,[{memberId:viewer,capability:'manage'},members[1]]),/only be reduced/)
 assert.equal(JSON.parse(sql(command(manager,2,[members[1]]))).revision,3)
 deny(command(viewer),/Workspace access required/)
 assert.equal(JSON.parse(sql(command(owner,3,[]))).revision,4)
 deny(command(manager),/Workspace access required/)
 assert.equal(read(owner).members.length,1)
 sql(`delete from organization_memberships where org_id='${owner}' and member_id='${manager}';
 insert into organization_memberships(org_id,member_id,role) values('${owner}','${manager}','staff');`)
 deny(command(manager),/Workspace access required/)
 const session=(query,ready)=>new Promise((resolve,reject)=>{
  const child=spawn(join(postgresDirectory,'psql'),args,{stdio:['pipe','pipe','pipe']});let out='',err=''
  child.stdout.on('data',chunk=>{out+=chunk.toString();if(out.includes('locked'))ready?.()});child.stderr.on('data',chunk=>{err+=chunk.toString()})
  child.on('error',reject);child.on('close',code=>code===0?resolve(out):reject(new Error(err)));child.stdin.end(query)
 })
 let acquired;const locked=new Promise(resolve=>{acquired=resolve})
 const first=session(`begin;${command(owner,4,[])}select 'locked';select pg_sleep(0.25);commit;`,acquired)
 await Promise.race([locked,first.then(()=>{throw new Error('Missing lock marker')})])
 const second=session(command(owner,4,[]))
 const raced=await Promise.allSettled([first,second])
 assert.equal(raced[0].status,'fulfilled');assert.equal(raced[1].status,'rejected')
 assert.match(raced[1].reason.message,/Source access is changing|Access changed/)
 assert.equal(read(owner).revision,5)
 assert.equal(sql(`select canvas_private from workspace_source_audiences where org_id='${owner}';`),'t')
 console.log('[workspace-access-controls] Inherited review, no activation, current grants, spoofing, revision conflicts, retained reductions, owner retention and rejoin passed.')
}
