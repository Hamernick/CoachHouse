import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { spawn, spawnSync } from 'node:child_process'
import { join } from 'node:path'

// Actual draft/CAS and audience functions, with inherited minimal run schema.
// Closure lifecycle is controlled here; full-schema staging proof is separate.
export async function verifyWorkspaceResearchDraftCanvas({ postgresDirectory, port, socketDirectory }) {
  const args=['-XqAt','-h',socketDirectory,'-p',port,'-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1']
  const run=query=>spawnSync(join(postgresDirectory,'psql'),args,{input:query,encoding:'utf8'})
  const sql=query=>{const result=run(query);assert.equal(result.status,0,result.stderr);return result.stdout.trim()}
  const denied=(query,pattern=/Draft access denied|Chat unavailable|permission denied/)=>{
    const result=run(query);assert.notEqual(result.status,0);assert.match(result.stderr,pattern)
  }
  const file=name=>readFileSync(`supabase/migrations/${name}.sql`,'utf8')
  const id=n=>`99400000-0000-4000-8000-${String(n).padStart(12,'0')}`
  const owner=id(1),editor=id(2),outsider=id(3),canvas=id(10),named=id(20),defaultRun=id(21),own=id(22),bad=id(23)
  const context=actor=>`set role service_role;set request.headers='{"x-coach-house-actor-id":"${actor}"}';`
  sql(`create table fixture_draft_closure(readable boolean,writable boolean);insert into fixture_draft_closure values(true,true);
    create or replace function organization_closure_read_window(uuid) returns boolean language sql as $$select readable from public.fixture_draft_closure$$;
    create or replace function guard_uploaded_document_organization(uuid) returns void language plpgsql as $$begin
      if not (select writable from public.fixture_draft_closure) then raise exception 'Closure write denied' using errcode='42501';end if;end$$;`)
  sql(file('20261031200000_workspace_research_drafts'))
  const closure=file('20261102235000_organization_closure_private_reads')
  sql(closure.slice(closure.indexOf('alter function public.access_workspace_research_draft'),closure.indexOf('-- Legacy plan readers')))
  sql(file('20261107220000_workspace_research_draft_canvas'))
  sql(`insert into profiles values('${owner}','member'),('${editor}','member'),('${outsider}','member');
    insert into organizations(user_id) values('${owner}');
    insert into organization_memberships(org_id,member_id,role) values('${owner}','${editor}','staff'),('${owner}','${outsider}','admin');
    insert into organization_workspace_boards(org_id,state) values('${owner}','{"workspaceCatalog":{"version":1,"defaultName":"Main","entries":[{"id":"${canvas}","name":"Private","state":{}}]}}');`)
  const audience=(revision,members,scope=canvas)=>`${context(owner)}select set_workspace_source_audience('${owner}','${scope}','${owner}',${revision},'${JSON.stringify(members)}');`
  const grant=[{memberId:editor,capability:'view'}]
  sql(audience(0,grant));sql(audience(0,grant,'default'))
  sql(`update workspace_source_audiences set canvas_private=true where org_id='${owner}';`)
  for(const [runId,actor,scope] of [[named,editor,canvas],[defaultRun,editor,null],[own,owner,canvas],[bad,editor,canvas]]) {
    sql(`insert into workspace_ai_runs(id,org_id,actor_id,task,target,status) values('${runId}','${owner}','${actor}','plan',
      '${JSON.stringify({kind:'particle_research',canvasId:scope})}','succeeded');`)
  }
  const call=(actor=editor,runId=named,edit=null,revision=null,draft=null,attempted=false,base='a')=>`${context(actor)}select access_workspace_research_draft(
    '${runId}','${owner}','${actor}',repeat('${base}',64),${edit?`'${id(edit)}'`:'null'},${revision??'null'},${draft?`'${JSON.stringify(draft)}'`:'null'},${attempted});`
  const value=query=>JSON.parse(sql(query))
  const draft={title:'Private unfinished edits'}
  assert.deepEqual(value(call()),{revision:0,draft:null,attempted:false})
  assert.equal(value(call(editor,named,100,0,draft)).revision,1)
  assert.equal(value(call(editor,named,100,0,draft)).revision,1,'Exact retry does not advance revision')
  denied(call(editor,named,100,0,{title:'Changed retry'}),/Draft retry changed/)
  denied(call(editor,named,101,0,draft),/Draft revision changed/)
  denied(call(editor,named,null,null,null,false,'b'),/Draft base changed/)
  assert.equal(value(call(editor,named,101,1,draft,true)).attempted,true)
  denied(call(editor,named,102,2,{title:'Changed attempt'},true),/Draft application pending/)
  assert.equal(value(call(editor,named,102,2,null,false)).revision,3,'Explicit discard retains revision tombstone')
  assert.equal(value(call(editor,named,103,3,draft)).revision,4)
  assert.equal(value(call(editor,defaultRun,110,0,draft)).revision,1)
  assert.equal(value(call(owner,own,120,0,draft)).revision,1)
  denied(call(owner,named));denied(call(outsider,named))
  denied(call().replace(context(editor),context(outsider)))
  denied(call().replace(context(editor),'set role authenticated;'))
  denied(call().replace('select access_workspace_research_draft(', 'select access_workspace_research_draft_before_read_closure('))
  denied(`${context(editor)}select * from workspace_research_drafts;`)
  for(const target of [{kind:'particle_research'}, {kind:'particle_research',canvasId:12}, {kind:'particle_research',canvasId:'garbage'}]) {
    sql(`update workspace_ai_runs set target='${JSON.stringify(target)}' where id='${bad}';`)
    denied(call(editor,bad))
  }
  sql(audience(1,[]));sql(audience(1,[],'default'))
  for(const query of [call(),call(editor,named,103,3,draft),call(editor,named,104,4,draft),call(editor,defaultRun),call(editor,defaultRun,110,0,draft)])denied(query)
  assert.equal(sql(`select revision from workspace_research_drafts where run_id='${named}'`),'4')
  // Retained private audiences govern missing canvases and membership rejoin.
  sql(`${context(owner)}update organization_workspace_boards set state='{}' where org_id='${owner}';`)
  denied(call());assert.equal(value(call(owner,own)).revision,1)
  sql(`${context(owner)}update organization_workspace_boards set state='{"workspaceCatalog":{"version":1,"defaultName":"Main","entries":[{"id":"${canvas}","name":"Private","state":{}}]}}' where org_id='${owner}';`)
  sql(audience(2,grant))
  sql(`delete from organization_memberships where org_id='${owner}' and member_id='${editor}';
    insert into organization_memberships(org_id,member_id,role) values('${owner}','${editor}','staff');`)
  denied(call());sql(audience(4,grant))
  // Revocation commits before a waiting checkpoint read/write/replay can proceed.
  let signal;const locked=new Promise(resolve=>{signal=resolve})
  const revoke=new Promise((resolve,reject)=>{
    const child=spawn(join(postgresDirectory,'psql'),args);let out='',err=''
    child.stdout.on('data',data=>{out+=data;if(out.includes('locked'))signal()});child.stderr.on('data',data=>{err+=data})
    child.on('error',reject);child.on('close',code=>code===0?resolve():reject(new Error(err)))
    child.stdin.end(`begin;${audience(5,[])}select 'locked';select pg_sleep(0.3);commit;`)
  })
  await Promise.race([locked,revoke.then(()=>{throw new Error('Missing lock marker')})])
  denied(call(editor,named,103,3,draft));await revoke
  assert.equal(sql(`select revision from workspace_research_drafts where run_id='${named}'`),'4')
  // Preserve the wrapper's separate export/read and write closure policies.
  sql('update fixture_draft_closure set writable=false')
  assert.equal(value(call(owner,own)).revision,1)
  denied(call(owner,own,120,0,draft),/Closure write denied/)
  sql('update fixture_draft_closure set readable=false')
  denied(call(owner,own))
  console.log('[workspace-research-draft-canvas] View-only private edits, ownership, verified actors, named/default/deleted scopes, malformed scope, revisions, exact replay, attempted payload, discard, revocation, rejoin and revoke-before-retry passed. Closure routing controlled; not ledger/release proof.')
}
