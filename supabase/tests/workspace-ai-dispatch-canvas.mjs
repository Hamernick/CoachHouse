import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { spawn, spawnSync } from 'node:child_process'
import { join } from 'node:path'

// Actual public reservation, claim and cancel bodies. The ledger delegate is
// counted rather than billed; policy/wallet/closure prerequisites are controlled.
export async function verifyWorkspaceAiDispatchCanvas({ postgresDirectory, port, socketDirectory }) {
 const args=['-XqAt','-h',socketDirectory,'-p',port,'-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1']
 const run=query=>spawnSync(join(postgresDirectory,'psql'),args,{input:query,encoding:'utf8'})
 const sql=query=>{const result=run(query);assert.equal(result.status,0,result.stderr);return result.stdout.trim()}
 const denied=(query,pattern=/AI access denied|Chat unavailable|permission denied/)=>{const r=run(query);assert.notEqual(r.status,0);assert.match(r.stderr,pattern)}
 const file=name=>readFileSync(`supabase/migrations/${name}.sql`,'utf8')
 const id=n=>`99500000-0000-4000-8000-${String(n).padStart(12,'0')}`
 const owner=id(1),editor=id(2),other=id(3),canvas=id(10),named=id(20),root=id(21),legacy=id(22),owned=id(23)
 const context=actor=>`set role service_role;set request.headers='{"x-coach-house-actor-id":"${actor}"}';`
 sql(`update fixture_draft_closure set readable=true,writable=true;
  alter table workspace_ai_runs add column cancel_requested_at timestamptz,add column settled_at timestamptz;
  create table ai_credit_policy(id boolean,enabled boolean);insert into ai_credit_policy values(true,true);
  create table ai_credit_wallets(org_id uuid,enabled boolean);
  create table fixture_admission_ledger(calls integer);insert into fixture_admission_ledger values(0);
  create function reserve_workspace_ai_run_before_closure(p_id uuid,p_org_id uuid,p_actor_id uuid,p_hash text,p_target jsonb,p_prompt text,p_tariff jsonb,p_max_credits integer,p_max_cost integer)
   returns jsonb language plpgsql security definer set search_path='' as $$declare fresh boolean;begin
    update public.fixture_admission_ledger set calls=calls+1;
    insert into public.workspace_ai_runs(id,org_id,actor_id,task,target,status,prompt)
      values(p_id,p_org_id,p_actor_id,'document',p_target,'reserved',p_prompt) on conflict do nothing;
    fresh:=found;
    return jsonb_build_object('created',fresh,'run',(select to_jsonb(r) from public.workspace_ai_runs r where id=p_id));
   end$$;
  revoke all on function reserve_workspace_ai_run_before_closure(uuid,uuid,uuid,text,jsonb,text,jsonb,integer,integer) from public,anon,authenticated,service_role;`)
 const closure=file('20261102220000_organization_closure_ai_admission')
 sql(closure.slice(closure.indexOf('create function public.reserve_workspace_ai_run('),closure.indexOf('create function public.cancel_workspace_ai_on_closure')))
 const research=file('20261030190000_workspace_new_objective_research')
 sql(research.slice(0,research.indexOf('-- Discovery')))
 const plans=file('20261022170000_workspace_ai_plans')
 sql(plans.slice(plans.indexOf('create function public.reserve_workspace_ai_plan_run'),plans.indexOf('create table public.workspace_ai_plan_applications')))
 const meter=file('20261022120000_workspace_ai_metering')
 sql(meter.slice(meter.indexOf('create function public.claim_workspace_ai_run'),meter.indexOf('create function public.settle_workspace_ai_run')))
 const recovery=file('20261022121000_workspace_ai_read_and_recovery')
 sql(recovery.slice(recovery.indexOf('create function public.cancel_workspace_ai_run'),recovery.indexOf('revoke all on function')))
 sql(`revoke all on function claim_workspace_ai_run(uuid,uuid),cancel_workspace_ai_run(uuid,uuid,uuid) from public,anon,authenticated;
  grant execute on function claim_workspace_ai_run(uuid,uuid),cancel_workspace_ai_run(uuid,uuid,uuid) to service_role;`)
 sql(file('20261107230000_workspace_ai_dispatch_canvas'))
 sql(file('20261107230100_workspace_ai_reservation_replay_scope'))
 sql(`insert into profiles values('${owner}','member'),('${editor}','member'),('${other}','member');
  insert into organizations(user_id) values('${owner}');
  insert into organization_memberships(org_id,member_id,role) values('${owner}','${editor}','staff'),('${owner}','${other}','admin');
  insert into ai_credit_wallets values('${owner}',true);
  insert into organization_workspace_boards(org_id,state) values('${owner}','{"workspaceCatalog":{"version":1,"defaultName":"Main","entries":[{"id":"${canvas}","name":"Private","state":{}}]}}');`)
 const audience=(revision,members,scope=canvas)=>`${context(owner)}select set_workspace_source_audience('${owner}','${scope}','${owner}',${revision},'${JSON.stringify(members)}');`
 const grant=[{memberId:editor,capability:'view'}]
 sql(audience(0,grant));sql(audience(0,grant,'default'))
 sql(`update workspace_source_audiences set canvas_private=true where org_id='${owner}';`)
 const target=(actor=editor,scope=canvas)=>({kind:'particle_research',organizationId:owner,userId:actor,mode:'new_objective',canvasId:scope,revision:0})
 const reserve=(runId=named,actor=editor,scope=target(actor),rpc='reserve_workspace_ai_research_run')=>`${context(actor)}select ${rpc}('${runId}','${owner}','${actor}',repeat('a',64),'${JSON.stringify(scope)}','Plan','{}',10,100);`
 const claim=(actor=editor,runId=named)=>`${context(actor)}select claim_workspace_ai_run('${runId}','${actor}');`
 const cancel=(actor=editor,runId=named)=>`${context(actor)}select cancel_workspace_ai_run('${runId}','${owner}','${actor}');`
 assert.equal(JSON.parse(sql(reserve())).created,true)
 assert.equal(JSON.parse(sql(reserve())).created,false)
 assert.equal(JSON.parse(sql(reserve(root,editor,target(editor,null)))).created,true)
 assert.equal(JSON.parse(sql(reserve(owned,owner,target(owner)))).created,true)
 assert.equal(JSON.parse(sql(reserve(legacy,editor,{kind:'document'},'reserve_workspace_ai_run'))).created,true)
 const ledger=()=>sql('select calls from fixture_admission_ledger')
 const before=ledger()
 for(const rpc of ['reserve_workspace_ai_run','reserve_workspace_ai_research_run','reserve_workspace_ai_plan_run']) {
  denied(reserve().replace('reserve_workspace_ai_research_run',rpc).replace(context(editor),context(other)))
 }
 for(const bad of [{kind:'particle_research'}, {...target(),canvasId:12}, {...target(),canvasId:'bad'}])denied(reserve(id(40),editor,bad))
 denied(reserve().replace(context(editor),'set role authenticated;'))
 denied(`${context(editor)}select assert_workspace_ai_admission('${owner}','${editor}','{}');`)
 denied(claim().replace(context(editor),context(other)))
 denied(cancel().replace(context(editor),context(other)))
 denied(`begin isolation level repeatable read;${reserve()}commit;`)
 assert.equal(ledger(),before)
 assert.equal(sql(claim(other)),'f','Other actor cannot claim owned request')
 assert.equal(sql(cancel(other)),'f','Other actor cannot cancel owned request')
 sql(audience(1,[]));sql(audience(1,[],'default'))
 denied(reserve());denied(reserve(id(41)));denied(reserve(root,editor,target(editor,null)))
 denied(reserve(named,editor,{kind:'document'},'reserve_workspace_ai_run'))
 denied(reserve(named,editor,target(editor,id(999)),'reserve_workspace_ai_run'))
 assert.equal(ledger(),before,'No ledger call after revocation, including replay')
 assert.equal(sql(claim()),'f');assert.equal(sql(claim(editor,root)),'f')
 assert.equal(sql(`select status from workspace_ai_runs where id='${named}'`),'reserved')
 assert.equal(sql(cancel()),'t','Canvas-revoked actor can still stop own work')
 assert.equal(sql(cancel()),'t','Cancellation is idempotent')
 assert.equal(sql(claim(editor,legacy)),'t','Legacy document dispatch stays org-scoped')
 assert.equal(sql(claim(owner,owned)),'t','Owner retains canvas access')
 sql(audience(2,grant));sql(audience(2,grant,'default'))
 assert.equal(sql(claim()),'f','Canceled request never restarts')
 sql('update ai_credit_wallets set enabled=false')
 assert.equal(sql(claim(editor,root)),'f')
 sql('update ai_credit_wallets set enabled=true;update ai_credit_policy set enabled=false')
 assert.equal(sql(claim(editor,root)),'f')
 sql('update ai_credit_policy set enabled=true')
 assert.equal(sql(claim(editor,root)),'t');assert.equal(sql(claim(editor,root)),'f','Only one dispatch claim')
 const waiting=id(50);sql(reserve(waiting))
 // Revocation owns the org lock before reservation replay and claim begin.
 let signal;const locked=new Promise(resolve=>{signal=resolve})
 const revoke=new Promise((resolve,reject)=>{
  const child=spawn(join(postgresDirectory,'psql'),args);let out='',err=''
  child.stdout.on('data',data=>{out+=data;if(out.includes('locked'))signal()});child.stderr.on('data',data=>{err+=data})
  child.on('error',reject);child.on('close',code=>code===0?resolve():reject(new Error(err)))
  child.stdin.end(`begin;${audience(3,[])}select 'locked';select pg_sleep(0.3);commit;`)
 })
 await Promise.race([locked,revoke.then(()=>{throw new Error('Missing lock marker')})])
 assert.equal(sql(claim(editor,waiting)),'f');await revoke
 denied(reserve(waiting));assert.equal(sql(`select status from workspace_ai_runs where id='${waiting}'`),'reserved')
 sql(audience(4,grant));sql('update fixture_draft_closure set writable=false')
 denied(reserve(id(51)),/Closure write denied/)
 console.log('[workspace-ai-dispatch-canvas] Actor binding, reservation/replay admission, default/named scopes, View access, owner retention, malformed scope, dispatch/revocation race, single claim, policy/wallet gates and stop-only cancellation passed. Ledger and closure prerequisites controlled; no provider calls.')
}
