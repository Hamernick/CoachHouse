import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { spawn, spawnSync } from 'node:child_process'
import { join } from 'node:path'

export async function verifyWorkspaceCanvasIsolation({ postgresDirectory, port, socketDirectory }) {
  const args=['-XqAt','-h',socketDirectory,'-p',port,'-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1']
  const sql=query=>{
    const result=spawnSync(join(postgresDirectory,'psql'),args,{input:query,encoding:'utf8'})
    assert.equal(result.status,0,result.stderr);return result.stdout.trim()
  }
  const denied=(query,pattern=/Workspace audience access required/)=>{
    const result=spawnSync(join(postgresDirectory,'psql'),args,{input:query,encoding:'utf8'})
    assert.notEqual(result.status,0);assert.match(result.stderr,pattern)
  }
  const id=n=>`99000000-0000-4000-8000-${String(n).padStart(12,'0')}`
  const owner=id(1),viewer=id(2),editor=id(3),manager=id(4),admin=id(5),finance=id(10),comms=id(11)
  const context=actor=>`set role service_role;set request.headers='{"x-coach-house-actor-id":"${actor}"}';`
  const members=[{memberId:viewer,capability:'view'},{memberId:editor,capability:'edit'},{memberId:manager,capability:'manage'}]
  const audience=(revision,values=members,canvas=finance)=>`${context(owner)}select set_workspace_source_audience('${owner}','${canvas}','${owner}',${revision},'${JSON.stringify(values)}');`
  // Actual canonical reader and source RLS, with controlled native-source and
  // parent prerequisites. Native/core source fences have their separate suites.
  sql(`create function public.workspace_particle_board_files(uuid,jsonb) returns table(file_id uuid) language sql as $$select null::uuid where false$$;
    alter table organization_workspace_boards enable row level security;
    grant select,insert,update,delete on organization_workspace_boards to authenticated,service_role;
    create policy fixture_board_parent on organization_workspace_boards for all to authenticated
      using(can_read_workspace_particle_origins(org_id,auth.uid())) with check(can_read_workspace_particle_origins(org_id,auth.uid()));`)
  sql(readFileSync('supabase/migrations/20261106150000_workspace_particle_source_reads.sql','utf8'))
  sql(readFileSync('supabase/migrations/20261107180000_workspace_canvas_isolation.sql','utf8'))
  const state={secretRoot:'Private default content',workspaceCatalog:{version:1,defaultName:'Private default name',entries:[
    {id:finance,name:'Private finance name',state:{secret:'Private finance content'}},
    {id:comms,name:'Communications',state:{public:'Visible content'}},
  ]}}
  sql(`insert into profiles(id,role) values('${owner}','member'),('${viewer}','member'),('${editor}','member'),('${manager}','member'),('${admin}','admin');
    insert into organizations(user_id) values('${owner}'),('${admin}');
    insert into organization_memberships(org_id,member_id,role) values('${owner}','${viewer}','board'),('${owner}','${editor}','staff'),('${owner}','${manager}','staff'),('${owner}','${admin}','admin');
    insert into organization_workspace_boards values('${owner}','${JSON.stringify(state)}');`)
  sql(audience(0))
  const read=actor=>JSON.parse(sql(`${context(actor)}select read_workspace_canvas_projection('${owner}','${actor}');`)).state
  const stored=()=>JSON.parse(sql(`select state from organization_workspace_boards where org_id='${owner}';`))
  const update=(value,actor=editor)=>`${context(actor)}update organization_workspace_boards set state='${JSON.stringify(value)}' where org_id='${owner}';`
  assert.deepEqual(read(admin),state,'Source audiences alone never make a canvas private')
  sql(`update workspace_source_audiences set canvas_private=true where org_id='${owner}';`)
  assert.deepEqual(read(owner),state);assert.deepEqual(read(viewer),state)
  const projected=read(admin)
  assert.deepEqual(projected.workspaceCatalog.entries,[state.workspaceCatalog.entries[1]])
  assert.ok(!JSON.stringify(projected).includes('Private finance'))
  assert.deepEqual(stored(),state,'Projection does not alter storage')
  denied(`set role authenticated;set request.jwt.claim.sub='${admin}';select state from organization_workspace_boards where org_id='${owner}';`)
  denied(`set role authenticated;set request.jwt.claim.sub='${admin}';select count(*) from organization_workspace_boards where org_id='${owner}';`)
  denied(`${context(admin)}select read_workspace_canvas_projection('${owner}','${owner}');`,/Board projection access required/)
  denied(`set role authenticated;select read_workspace_canvas_projection('${owner}','${viewer}');`,/permission denied/)
  denied(`${context(owner)}update workspace_source_audiences set canvas_private=true where org_id='${owner}';`,/permission denied/)
  const changed=structuredClone(state);changed.workspaceCatalog.entries[0].state.secret='Edited finance content'
  denied(update(changed,viewer));denied(update(changed,admin));assert.deepEqual(stored(),state)
  sql(update(changed));assert.deepEqual(stored(),changed)
  const renamed=structuredClone(changed);renamed.workspaceCatalog.entries[0].name='Renamed finance'
  denied(update(renamed,editor));sql(update(renamed,manager));assert.deepEqual(read(owner),renamed)
  // A projected whole-board save cannot erase a sibling; shared edits retain it.
  denied(update(projected,admin))
  const sibling=structuredClone(renamed);sibling.workspaceCatalog.entries[1].state.public='Edited shared canvas'
  sql(update(sibling,admin));assert.deepEqual(stored(),sibling)
  const duplicate=structuredClone(sibling);duplicate.workspaceCatalog.entries.push(duplicate.workspaceCatalog.entries[0])
  denied(update(duplicate),/Invalid workspace catalog/)
  denied(`${context(editor)}delete from organization_workspace_boards where org_id='${owner}';`)
  denied(`${context(owner)}update organization_workspace_boards set org_id='${admin}' where org_id='${owner}';`)
  // Root visibility removes its entire body and name, without fabricating an
  // absent board. No default workspace can be re-seeded by the client.
  sql(audience(0,[],'default'))
  sql(`update workspace_source_audiences set canvas_private=true where org_id='${owner}' and canvas_id='default';`)
  const hiddenRoot=read(admin)
  assert.equal(hiddenRoot.workspaceCatalog.defaultDeleted,true)
  assert.equal(hiddenRoot.workspaceCatalog.defaultName,'Workspace')
  assert.ok(!JSON.stringify(hiddenRoot).includes('Private'))
  assert.deepEqual(read(owner),sibling)
  denied(update({...sibling,secretRoot:'Overwrite'},admin))
  const rootRename=structuredClone(sibling);rootRename.workspaceCatalog.defaultName='Rename default'
  denied(update(rootRename,admin))
  const second=structuredClone(sibling);second.workspaceCatalog.entries[1].state.public='Second shared edit'
  sql(update(second,admin));assert.deepEqual(stored(),second)
  // Current membership and explicit revocation affect every uncached read.
  sql(audience(1,[]))
  assert.equal(read(viewer).workspaceCatalog.entries.length,1)
  denied(update(changed,editor))
  sql(audience(2))
  sql(`delete from organization_memberships where org_id='${owner}' and member_id='${viewer}';`)
  denied(`${context(viewer)}select read_workspace_canvas_projection('${owner}','${viewer}');`,/Board projection access required/)
  sql(`insert into organization_memberships(org_id,member_id,role) values('${owner}','${viewer}','board');`)
  assert.equal(read(viewer).workspaceCatalog.entries.length,1,'Rejoin cannot resurrect private access')

  const session=(query,onLocked)=>new Promise((resolve,reject)=>{
    const child=spawn(join(postgresDirectory,'psql'),args);let out='',err='',notified=false
    child.stdout.on('data',data=>{out+=data;if(!notified&&out.includes('locked')){notified=true;onLocked?.()}})
    child.stderr.on('data',data=>{err+=data});child.on('error',reject)
    child.on('close',code=>code===0?resolve(out):reject(new Error(err)));child.stdin.end(query)
  })
  const race=async(first,secondQuery)=>{
    let acquire;const locked=new Promise(resolve=>{acquire=resolve})
    const a=session(`begin;${first}select 'locked';select pg_sleep(0.25);commit;`,acquire)
    await Promise.race([locked,a.then(()=>{throw new Error('Missing lock marker')})])
    return Promise.allSettled([a,session(secondQuery)])
  }
  const edited=structuredClone(second);edited.workspaceCatalog.entries[0].state.secret='Race edit'
  let result=await race(audience(4,[]),update(edited))
  assert.equal(result[0].status,'fulfilled');assert.equal(result[1].status,'rejected')
  assert.match(result[1].reason.message,/Workspace permission is changing|Workspace audience access required/)
  denied(update(edited));sql(audience(5))
  result=await race(update(edited),audience(6,[]))
  assert.equal(result[0].status,'fulfilled');assert.equal(result[1].status,'rejected')
  assert.match(result[1].reason.message,/Source access is changing/)
  assert.deepEqual(stored(),edited)
  sql(`${context(owner)}delete from organization_workspace_boards where org_id='${owner}';`)
  assert.equal(sql(`select count(*) from workspace_source_audiences where org_id='${owner}';`),'0')
  console.log('[workspace-canvas-isolation] Canonical projection, raw RLS, owner retention, capabilities, sibling preservation, no activation privilege, revocation/rejoin and both write/revoke orderings passed. Derived-history/sharing/cache activation remains gated.')
}
