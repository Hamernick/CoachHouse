import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { spawn, spawnSync } from 'node:child_process'
import { join } from 'node:path'

// Actual chat RPC bodies and canvas authority. Minimal AI rows and a counted
// recovery stub isolate access/lifecycle behavior; this is not ledger proof.
export async function verifyWorkspaceChatCanvasAuthority({ postgresDirectory, port, socketDirectory }) {
  const args=['-XqAt','-h',socketDirectory,'-p',port,'-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1']
  const run=query=>spawnSync(join(postgresDirectory,'psql'),args,{input:query,encoding:'utf8'})
  const sql=query=>{const result=run(query);assert.equal(result.status,0,result.stderr);return result.stdout.trim()}
  const denied=(query,pattern=/Chat unavailable|Verified chat actor|permission denied/)=>{
    const result=run(query);assert.notEqual(result.status,0,query);assert.match(result.stderr,pattern)
  }
  const file=name=>readFileSync(`supabase/migrations/${name}.sql`,'utf8')
  const id=n=>`99200000-0000-4000-8000-${String(n).padStart(12,'0')}`
  const owner=id(1),editor=id(2),outsider=id(3),canvas=id(10),root=id(20),other=id(21),child=id(22),legacy=id(23),defaultRoot=id(24)
  const context=actor=>`set role service_role;set request.headers='{"x-coach-house-actor-id":"${actor}"}';`
  const metering=file('20261022120000_workspace_ai_metering')
  sql(metering.slice(metering.indexOf('create function public.can_use_workspace_ai'),metering.indexOf('create function public.reserve_workspace_ai_run')))
  sql(`create function can_read_workspace_ai(uuid,uuid) returns boolean language sql as $$select public.can_use_workspace_ai($1,$2)$$;
    create table workspace_ai_runs(id uuid primary key,org_id uuid,actor_id uuid,task text,target jsonb,status text,
      prompt text,proposal text,created_at timestamptz default now(),conversation_messages jsonb);
    create table workspace_ai_document_applications(run_id uuid);
    create table fixture_chat_recovery(calls integer);insert into fixture_chat_recovery values(0);
    create function recover_workspace_ai_runs(uuid) returns void language sql as $$update public.fixture_chat_recovery set calls=calls+1$$;`)
  sql(file('20261105180000_workspace_chat_controls'))
  const revisions=file('20261105200000_workspace_chat_plan_revisions')
  sql(revisions.slice(revisions.indexOf('create or replace function public.list_workspace_research_conversation'),revisions.lastIndexOf('commit;')))
  const replies=file('20261105220000_workspace_chat_replies')
  sql(replies.slice(replies.indexOf('create or replace function public.page_workspace_research_conversation'),replies.indexOf('-- Read-only replies never')))
  const research=file('20261030190000_workspace_new_objective_research')
  sql(research.slice(research.indexOf('create or replace function public.list_workspace_research_runs')).replaceAll('public.can_use_workspace_ai(','public.can_read_workspace_ai('))
  const read=file('20261022130000_workspace_ai_document_application')
  sql(read.slice(read.indexOf('create or replace function public.read_workspace_ai_run'),read.indexOf('revoke all on function public.commit_workspace_ai_document')).replaceAll('public.can_use_workspace_ai(','public.can_read_workspace_ai('))
  sql(`revoke all on function read_workspace_ai_run(uuid,uuid,uuid),list_workspace_research_conversation(uuid,uuid,text,uuid) from public,anon,authenticated;
    grant execute on function read_workspace_ai_run(uuid,uuid,uuid),list_workspace_research_conversation(uuid,uuid,text,uuid) to service_role;`)
  sql(file('20261107200000_workspace_chat_canvas_authority'))
  sql(`insert into profiles values('${owner}','member'),('${editor}','member'),('${outsider}','member');
    insert into organizations(user_id) values('${owner}');
    insert into organization_memberships(org_id,member_id,role) values('${owner}','${editor}','staff'),('${owner}','${outsider}','admin');
    insert into organization_workspace_boards values('${owner}','{"workspaceCatalog":{"version":1,"defaultName":"Main","entries":[{"id":"${canvas}","name":"Private","state":{}}]}}');`)
  const audience=(revision,members)=>`${context(owner)}select set_workspace_source_audience('${owner}','${canvas}','${owner}',${revision},'${JSON.stringify(members)}');`
  sql(audience(0,[{memberId:editor,capability:'view'}]))
  sql(`update workspace_source_audiences set canvas_private=true where org_id='${owner}';`)
  const insert=(runId,actor,canvasId=canvas,parent=null,turn=1)=>{
    const target={kind:'particle_research',mode:'new_objective',organizationId:owner,userId:actor,canvasId,
      conversation:{id:parent?root:runId,parentId:parent,turn,draftRevision:0}}
    sql(`insert into workspace_ai_runs(id,org_id,actor_id,task,target,status,prompt,proposal) values
      ('${runId}','${owner}','${actor}','plan','${JSON.stringify(target)}','succeeded','Private prompt','Private proposal');`)
  }
  insert(root,editor);insert(child,editor,canvas,root,2);insert(other,owner);insert(defaultRoot,editor,null)
  insert(legacy,editor);sql(`update workspace_ai_runs set target=target-'canvasId' where id='${legacy}';`)
  const manage=(actor,operation='read',revision=0,title='Renamed',pinned=true,runId=root,scope=canvas)=>
    `${context(actor)}select manage_workspace_research_conversation('${owner}','${actor}',${scope===null?'null':`'${scope}'`},'${runId}','${operation}',${revision},'${title}',${pinned});`
  const list=(actor,scope=canvas)=>`${context(actor)}select list_workspace_research_conversation('${owner}','${actor}',${scope===null?'null':`'${scope}'`},null);`
  const page=actor=>`${context(actor)}select page_workspace_research_conversation('${owner}','${actor}','${canvas}','${root}');`
  const history=actor=>`${context(actor)}select list_workspace_research_runs('${owner}','${actor}',null,'${canvas}',null);`
  const readRun=(actor,runId=root)=>`${context(actor)}select read_workspace_ai_run('${runId}','${owner}','${actor}');`
  const parsed=query=>JSON.parse(sql(query))
  assert.equal(parsed(manage(editor)).revision,0)
  assert.equal(parsed(manage(editor,'rename')).title,'Renamed')
  assert.equal(parsed(manage(editor,'pin',1)).pinned,true)
  denied(manage(editor,'rename',0),/Chat changed/)
  assert.equal(parsed(list(editor))[0].id,child)
  assert.equal(parsed(page(editor)).length,2)
  assert.equal(parsed(history(editor)).length,2)
  assert.equal(parsed(readRun(editor)).prompt,'Private prompt')
  assert.equal(parsed(list(editor,null))[0].id,defaultRoot)
  assert.equal(parsed(manage(owner,'read',0,'',false,other)).revision,0)
  denied(manage(owner),/Chat unavailable/,'Owner cannot read another actor\'s personal chat')
  denied(readRun(editor,legacy))
  const recoveryBefore=sql('select calls from fixture_chat_recovery')
  denied(`${context(outsider)}select read_workspace_ai_run('${root}','${owner}','${editor}');`)
  denied(`${context(outsider)}select manage_workspace_research_conversation('${owner}','${editor}','${canvas}','${root}','read');`)
  denied(`set role authenticated;select list_workspace_research_conversation('${owner}','${editor}','${canvas}',null);`)
  denied(`${context(editor)}select assert_workspace_chat_canvas('${owner}','${editor}','${canvas}');`)
  for(const query of [list(outsider),history(outsider),page(outsider),manage(outsider)])denied(query)
  assert.equal(sql('select calls from fixture_chat_recovery'),recoveryBefore,'Denied readers do not trigger recovery')
  sql(audience(1,[]))
  for(const query of [manage(editor),manage(editor,'rename',2),manage(editor,'pin',2),manage(editor,'delete',2),list(editor),page(editor),history(editor),readRun(editor)])denied(query)
  assert.equal(sql(`select revision from workspace_research_chats where root_id='${root}'`),'2')
  assert.equal(sql('select calls from fixture_chat_recovery'),recoveryBefore)
  // Missing/deleted canvases keep retained private authority; no inherited reset.
  sql(`${context(owner)}update organization_workspace_boards set state='{}' where org_id='${owner}';`)
  denied(readRun(editor));assert.equal(parsed(readRun(owner,other)).prompt,'Private prompt')
  sql(`${context(owner)}update organization_workspace_boards set state='{"workspaceCatalog":{"version":1,"defaultName":"Main","entries":[{"id":"${canvas}","name":"Private","state":{}}]}}' where org_id='${owner}';`)
  sql(audience(2,[{memberId:editor,capability:'view'}]))
  sql(`delete from organization_memberships where org_id='${owner}' and member_id='${editor}';
    insert into organization_memberships(org_id,member_id,role) values('${owner}','${editor}','staff');`)
  denied(readRun(editor))
  sql(audience(4,[{memberId:editor,capability:'view'}]))
  // Real race: a revocation owns the org lock before a rename begins.
  let signal;const locked=new Promise(resolve=>{signal=resolve})
  const revoke=new Promise((resolve,reject)=>{
    const child=spawn(join(postgresDirectory,'psql'),args);let out='',err=''
    child.stdout.on('data',data=>{out+=data;if(out.includes('locked'))signal()});child.stderr.on('data',data=>{err+=data})
    child.on('error',reject);child.on('close',code=>code===0?resolve():reject(new Error(err)))
    child.stdin.end(`begin;${audience(5,[])}select 'locked';select pg_sleep(0.3);commit;`)
  })
  await Promise.race([locked,revoke.then(()=>{throw new Error('Missing lock marker')})])
  denied(manage(editor,'rename',2));await revoke
  assert.equal(sql(`select revision from workspace_research_chats where root_id='${root}'`),'2')
  sql(audience(6,[{memberId:editor,capability:'view'}]))
  sql(`update workspace_ai_runs set status='running' where id='${child}';`)
  denied(manage(editor,'delete',2),/Wait for this chat/)
  sql(`update workspace_ai_runs set status='succeeded' where id='${child}';`)
  assert.equal(parsed(manage(editor,'delete',2)).deleted,true)
  assert.deepEqual(parsed(list(editor)),[])
  denied(page(editor),/Chat deleted/)
  assert.equal(sql(`select count(*) from workspace_ai_runs where id in ('${root}','${child}')`),'2','Metadata delete preserves accounting runs')
  console.log('[workspace-chat-canvas-authority] Personal ownership, View-only metadata, revisions, rename/pin/delete, history, verified actors, revocation, deleted canvas, rejoin, running/deleted lifecycle and revoke-before-rename passed. Minimal run schema; ledger/release proof remains separate.')
}
