import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'

export function verifyRetainedWorkspaceAccessDirectory({ postgresDirectory, port, socketDirectory }) {
 const args=['-XqAt','-h',socketDirectory,'-p',port,'-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1']
 const run=query=>spawnSync(join(postgresDirectory,'psql'),args,{input:query,encoding:'utf8'})
 const sql=query=>{const r=run(query);assert.equal(r.status,0,r.stderr);return r.stdout.trim()}
 const deny=(query,pattern)=>{const r=run(query);assert.notEqual(r.status,0);assert.match(r.stderr,pattern)}
 const id=n=>`99910000-0000-4000-8000-${String(n).padStart(12,'0')}`
 const owner=id(1),manager=id(2),viewer=id(3),outsider=id(4),live=id(10),deleted=id(11),hidden=id(12),inherited=id(13)
 const context=actor=>`set role service_role;set request.headers='{"x-coach-house-actor-id":"${actor}"}';`
 const command=(actor=owner,after=null)=>`${context(actor)}select list_retained_workspace_access('${owner}','${actor}',${after===null?'null':`'${after}'`});`
 const read=(actor=owner,after=null)=>JSON.parse(sql(command(actor,after)))
 sql(readFileSync('supabase/migrations/20261108040000_retained_workspace_access_directory.sql','utf8'))
 sql(`insert into profiles(id,role) values('${owner}','member'),('${manager}','member'),('${viewer}','member'),('${outsider}','member');
 insert into organizations(user_id) values('${owner}');
 insert into organization_memberships(org_id,member_id,role) values('${owner}','${manager}','staff'),('${owner}','${viewer}','board');
 insert into organization_workspace_boards values('${owner}','{"workspaceCatalog":{"version":1,"defaultName":"Home","entries":[{"id":"${live}","name":"Live","state":{}}]}}');
 insert into workspace_source_audiences(org_id,canvas_id,canvas_private) values('${owner}','${live}',true),('${owner}','${deleted}',true),('${owner}','${hidden}',true),('${owner}','${inherited}',false);
 insert into workspace_source_audience_members(org_id,canvas_id,member_id,membership_created_at,capability)
 select org_id,'${deleted}',member_id,created_at,case when member_id='${manager}' then 'manage' else 'view' end from organization_memberships where org_id='${owner}';`)
 assert.deepEqual(read().items,[{canvasId:deleted},{canvasId:hidden}])
 assert.deepEqual(read(manager).items,[{canvasId:deleted}])
 assert.deepEqual(read(viewer),{items:[],nextAfter:null})
 deny(command(outsider),/Workspace access required/)
 deny(command(owner).replace(`'${owner}',null);`,`'${manager}',null);`),/Workspace access required/)
 deny(command(owner,'invalid'),/Invalid workspace cursor/)
 deny(`set role authenticated;select list_retained_workspace_access('${owner}','${owner}');`,/permission denied/)
 deny(`begin isolation level repeatable read;${command()}`,/Access changed/)
 const review=JSON.parse(sql(`${context(manager)}select workspace_access_control('${owner}','${deleted}','${manager}');`))
 assert.equal(review.deleted,true);assert.equal(review.canManage,true)
 sql(`${context(owner)}select workspace_access_control('${owner}','${deleted}','${owner}',0,'[]');`)
 assert.deepEqual(read(manager).items,[],'Revoked manager cannot rediscover the retained scope')
 assert.equal(read().items.length,2,'Owner retains discovery after removing every member')
 sql(`delete from organization_memberships where org_id='${owner}' and member_id='${manager}';insert into organization_memberships(org_id,member_id,role) values('${owner}','${manager}','staff');`)
 assert.deepEqual(read(manager).items,[],'Rejoining does not revive retained discovery')
 // Stable, bounded pagination also covers a retained default canvas.
 sql(`insert into workspace_source_audiences(org_id,canvas_id,canvas_private)
 select '${owner}','99910000-0000-4000-8000-'||lpad(n::text,12,'0'),true from generate_series(100,150) n;
 insert into workspace_source_audiences(org_id,canvas_id,canvas_private) values('${owner}','default',true);
 update organization_workspace_boards set state=jsonb_set(state,'{workspaceCatalog,defaultDeleted}','true') where org_id='${owner}';`)
 const audienceState=()=>sql(`select md5(string_agg(to_jsonb(a)::text,'' order by canvas_id)) from workspace_source_audiences a where org_id='${owner}';`)
 const beforeDiscovery=audienceState()
 const first=read(),second=read(owner,first.nextAfter)
 assert.equal(first.items.length,50);assert.equal(first.nextAfter,first.items.at(-1).canvasId)
 assert.equal(second.items.length,4);assert.equal(second.nextAfter,null)
 const combined=[...first.items,...second.items].map(row=>row.canvasId)
 assert.equal(new Set(combined).size,54);assert.equal(combined.at(-1),'default')
 assert.ok(!combined.includes(live));assert.ok(!combined.includes(inherited))
 assert.equal(audienceState(),beforeDiscovery,'Discovery preserves every audience row and privacy flag')
 console.log('[retained-workspace-directory] Verified actor, parent, manager-only discovery, deleted-only scope, owner retention, revocation/rejoin, no activation and bounded pagination passed.')
}
