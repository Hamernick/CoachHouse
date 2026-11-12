import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { spawn, spawnSync } from 'node:child_process'
import { join } from 'node:path'

// Actual page invitation/note command/canvas guard. Uses the existing controlled
// parent/closure fixture; live full-schema rollback supplements this test.
export async function verifyWorkspaceGuestNoteCanvas({ postgresDirectory, port, socketDirectory }) {
  const args=['-XqAt','-h',socketDirectory,'-p',port,'-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1']
  const run=query=>spawnSync(join(postgresDirectory,'psql'),args,{input:query,encoding:'utf8'})
  const sql=query=>{const result=run(query);assert.equal(result.status,0,result.stderr);return result.stdout.trim()}
  const denied=(query,pattern=/unavailable|not enabled|Only the selected|Verified note actor|permission denied|Workspace access|required/)=>{
    const result=run(query);assert.notEqual(result.status,0);assert.match(result.stderr,pattern)
  }
  const quote=value=>`'${JSON.stringify(value).replaceAll("'","''")}'::jsonb`
  const file=name=>readFileSync(`supabase/migrations/${name}.sql`,'utf8')
  const id=n=>`99300000-0000-4000-8000-${String(n).padStart(12,'0')}`
  const owner=id(1),guest=id(2),viewer=id(3),canvas=id(10),noteId=id(30),otherId=id(31)
  const context=actor=>`set role service_role;set request.headers='{"x-coach-house-actor-id":"${actor}"}';`
  sql(`alter table organization_workspace_boards add column updated_by uuid,add column updated_at timestamptz;
    create function guard_uploaded_document_organization(uuid) returns void language sql as $$select public.guard_organization_closure($1)$$;`)
  sql(file('20261103040000_workspace_page_note_edit_scope'))
  sql(file('20261107210000_workspace_guest_note_canvas_write'))
  const note={id:noteId,type:'activity',title:'Selected note',revision:1,createdAt:'2026-11-07T00:00:00.000Z',updatedAt:'2026-11-07T00:00:00.000Z',
    data:{widget:{kind:'notes',source:{kind:'workspace',content:'Reviewed source'}}}}
  const graph={workspaceId:owner,revision:1,receipts:[],particles:[note,{...note,id:otherId,title:'Private sibling',data:{widget:{kind:'notes',source:{kind:'workspace',content:'Private content'}}}}]}
  const state={particleGraph:graph,privateField:'retain',workspaceCatalog:{version:1,defaultName:'Main',entries:[{id:canvas,name:'Private named',state:{particleGraph:graph}}]}}
  sql(`insert into profiles values('${owner}','member'),('${guest}','member'),('${viewer}','member');
    insert into auth.users(id,email,email_confirmed_at) values('${owner}','owner@example.test',now()),('${guest}','guest2@example.test',now()),('${viewer}','viewer2@example.test',now());
    insert into organizations(user_id) values('${owner}');
    insert into organization_workspace_boards(org_id,state) values('${owner}',${quote(state)});
    insert into workspace_source_audiences(org_id,canvas_id,canvas_private) values('${owner}','default',true),('${owner}','${canvas}',true);`)
  const body=(action,values={})=>({action,particleId:noteId,...values})
  let op=100
  const cmd=(actor,page,command,expected=null,next=null)=>`${context(actor)}select workspace_page_note_command('${actor}','${page}',${quote(command)},repeat('a',64),${quote(expected)},${quote(next)});`
  const value=query=>JSON.parse(sql(query))
  const stored=()=>JSON.parse(sql(`select state from organization_workspace_boards where org_id='${owner}';`))
  const selected=(board,named)=>named?board.workspaceCatalog.entries[0].state.particleGraph:board.particleGraph
  let last
  for(const named of [false,true]) {
    const page=id(named?21:20),invitation=id(named?51:50)
    sql(`insert into organization_workspace_pages(id,org_id,canvas_id,title,particle_ids,guest_snapshot) values
      ('${page}','${owner}',${named?`'${canvas}'`:'null'},'Shared note',array['${noteId}'::uuid],${quote({items:[{id:noteId,title:'Reviewed note',content:{kind:'notes'}}]})});
      insert into workspace_page_invitations(id,page_id,email,permission,invited_by,accepted_by,accepted_at) values
      ('${invitation}','${page}','guest2@example.test','edit','${owner}','${guest}',now()),
      ('${id(named?61:60)}','${page}','viewer2@example.test','view','${owner}','${viewer}',now());`)
    assert.deepEqual(value(cmd(guest,page,{action:'list'})).notes,[])
    denied(cmd(guest,page,body('read')))
    denied(cmd(guest,page,body('set_scope',{operationId:id(op++),expectedPageRevision:1,expectedNoteRevision:1,enabled:true})),/Organization editor required/)
    assert.equal(value(cmd(owner,page,body('review_scope'))).note.content,'Reviewed source')
    value(cmd(owner,page,body('set_scope',{operationId:id(op++),expectedPageRevision:1,expectedNoteRevision:1,enabled:true})))
    denied(cmd(viewer,page,body('read')))
    denied(cmd(guest,page,body('read',{particleId:otherId})))
    assert.equal(value(cmd(guest,page,body('read'))).note.content,'Reviewed source')
    const before=stored(),expected=selected(before,named),next=structuredClone(expected)
    next.revision=2;next.particles[0].revision=2;next.particles[0].data.widget.source.content='Edited selected note'
    const write=body('write',{operationId:id(op++),expectedNoteRevision:1,content:'Edited selected note'})
    const tampered=structuredClone(next);tampered.particles[1].title='Unauthorized rename'
    denied(cmd(guest,page,write,expected,tampered))
    assert.deepEqual(stored(),before)
    const changed=value(cmd(guest,page,write,expected,next));assert.equal(changed.note.revision,2)
    const after=stored();assert.deepEqual(selected(after,named),next)
    assert.deepEqual(selected(after,!named),selected(before,!named));assert.equal(after.privateField,'retain')
    assert.equal(sql('select count(*) from workspace_page_note_write_context'),'0')
    assert.equal(value(cmd(guest,page,write)).replayed,true)
    assert.deepEqual(stored(),after)
    denied(`${context(guest)}update organization_workspace_boards set state=state||'{"privateField":"overwrite"}' where org_id='${owner}';`)
    denied(`${context(guest)}select read_workspace_canvas_projection('${owner}','${guest}');`)
    denied(`${context(guest)}insert into workspace_page_note_write_context values(pg_backend_pid(),txid_current(),'${owner}','${guest}',${quote(after)},${quote(after)});`)
    denied(`${context(guest)}select workspace_page_note_command('${owner}','${page}','{"action":"list"}');`)
    denied(`set role authenticated;select workspace_page_note_command('${guest}','${page}','{"action":"list"}');`)
    value(cmd(owner,page,body('set_scope',{operationId:id(op++),expectedPageRevision:3,expectedNoteRevision:2,enabled:false})))
    denied(cmd(guest,page,write));denied(cmd(guest,page,body('read')))
    value(cmd(owner,page,body('set_scope',{operationId:id(op++),expectedPageRevision:4,expectedNoteRevision:2,enabled:true})))
    last={page,invitation,write:body('write',{operationId:id(op++),expectedNoteRevision:2,content:'After revoke'}),expected:next,next:structuredClone(next)}
    last.next.revision=3;last.next.particles[0].revision=3;last.next.particles[0].data.widget.source.content='After revoke'
  }
  // The grant read holds the same org/page locks as invitation revocation.
  let signal;const locked=new Promise(resolve=>{signal=resolve})
  const revoke=new Promise((resolve,reject)=>{
    const child=spawn(join(postgresDirectory,'psql'),args);let out='',err=''
    child.stdout.on('data',data=>{out+=data;if(out.includes('locked'))signal()});child.stderr.on('data',data=>{err+=data})
    child.on('error',reject);child.on('close',code=>code===0?resolve():reject(new Error(err)))
    child.stdin.end(`begin;${context(owner)}select workspace_page_guest_command('${owner}','${last.page}',${quote({action:'revoke',invitationId:last.invitation,operationId:id(op++)})},repeat('b',64));select 'locked';select pg_sleep(0.3);commit;`)
  })
  await Promise.race([locked,revoke.then(()=>{throw new Error('Missing lock marker')})])
  const before=stored();denied(cmd(guest,last.page,last.write,last.expected,last.next));await revoke
  assert.deepEqual(stored(),before);assert.equal(sql('select count(*) from workspace_page_note_write_context'),'0')
  console.log('[workspace-guest-note-canvas] Default/named private note saves, exact-delta tampering, sibling preservation, owner-only opt-in, verified actors, no canvas authority, replay, scope revoke and invitation-revoke-before-save passed.')
}
